// ocr.js
// ─────────────────────────────────────────────────────────────
// Simple OCR service: upload image → extract text
// Run:   node ocr.js
// Use:   const { OcrEngine } = require('./ocr');
// ─────────────────────────────────────────────────────────────

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const pino = require('pino');
const crypto = require('crypto');

// ── Logger ──────────────────────────────────────────────────
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'ocr' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ── Reusable OCR Engine (no HTTP dependency) ────────────────
class OcrEngine {
  constructor({ lang = 'eng', logger: log = logger } = {}) {
    this.lang = lang;
    this.logger = log;
    this.worker = null;
    this.ready = this._init();
  }

  async _init() {
    this.logger.info({ lang: this.lang }, 'starting tesseract worker');
    this.worker = await createWorker(this.lang);
    this.logger.info('tesseract worker ready');
  }

  /**
   * Extract text from an image buffer (PNG/JPEG/TIFF/BMP).
   * Non-PNG inputs should be converted first with sharp.
   *
   * @param {Buffer} buffer
   * @param {string} [requestId]
   * @returns {Promise<{ requestId, text, confidence, durationMs }>}
   */
  async extract(buffer, requestId = crypto.randomUUID()) {
    const log = this.logger.child({ requestId });
    const started = Date.now();
    try {
      await this.ready;
      log.info({ sizeBytes: buffer.length }, 'ocr started');

      const { data } = await this.worker.recognize(buffer);

      const result = {
        requestId,
        text: data.text.trim(),
        confidence: data.confidence,
        durationMs: Date.now() - started,
      };

      log.info(
        {
          durationMs: result.durationMs,
          confidence: result.confidence,
          chars: result.text.length,
        },
        'ocr finished'
      );

      return result;
    } catch (err) {
      log.error(
        { err: err.message, durationMs: Date.now() - started },
        'ocr failed'
      );
      throw err;
    }
  }

  async close() {
    if (this.worker) await this.worker.terminate();
  }
}

// ── Express App ─────────────────────────────────────────────
function createApp(engine) {
  const app = express();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  });

  // Request ID + child logger per request
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || crypto.randomUUID();
    req.log = logger.child({
      requestId: req.id,
      method: req.method,
      path: req.path,
    });
    res.setHeader('x-request-id', req.id);
    next();
  });

  // Health check
  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // OCR endpoint
  app.post('/ocr', upload.single('image'), async (req, res, next) => {
    try {
      if (!req.file) {
        req.log.warn('no file uploaded');
        return res
          .status(400)
          .json({ error: 'No image uploaded (field name: "image")' });
      }

      req.log.info(
        { mimetype: req.file.mimetype, size: req.file.size },
        'converting image to png'
      );

      // Convert ANY input (AVIF, WEBP, HEIC, JPEG, …) → PNG for Tesseract
      let png;
      try {
        png = await sharp(req.file.buffer).png().toBuffer();
      } catch (convErr) {
        req.log.error({ err: convErr.message }, 'image conversion failed');
        return res
          .status(400)
          .json({ error: 'Unsupported or corrupt image file', requestId: req.id });
      }

      const result = await engine.extract(png, req.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Central error handler
  app.use((err, req, res, _next) => {
    req.log.error({ err: err.message, stack: err.stack }, 'request failed');
    res.status(500).json({ error: err.message, requestId: req.id });
  });

  return app;
}

// ── Crash guards ────────────────────────────────────────────
// tesseract.js can throw from a worker thread via process.nextTick,
// which bypasses try/catch. These prevent a single bad image from
// killing the process.
process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'uncaught exception');
});
process.on('unhandledRejection', (err) => {
  logger.error({ err: err?.message || String(err) }, 'unhandled rejection');
});

// ── Bootstrap (only when run directly) ──────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const engine = new OcrEngine();

  (async () => {
    try {
      await engine.ready;
      const app = createApp(engine);
      const server = app.listen(PORT, () =>
        logger.info({ port: PORT }, 'ocr server listening')
      );

      const shutdown = async (signal) => {
        logger.info({ signal }, 'shutting down');
        server.close();
        await engine.close();
        process.exit(0);
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, 'startup failed');
      process.exit(1);
    }
  })();
}

module.exports = { OcrEngine, createApp };
