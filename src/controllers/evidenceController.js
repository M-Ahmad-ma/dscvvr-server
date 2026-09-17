const { processEvidence, getEvidence, deleteEvidence } = require("../services/reviewEvidence");
const { allowedFileTypes, maxFileSizeBytes } = require("../services/verificationConfig");
const { getPublicEvidenceState, getPublicEvidenceDetails } = require("../services/evidencePublic");

const uploadEvidence = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (field name: \"file\")" });
    }

    if (!allowedFileTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: `Unsupported file type. Allowed: ${allowedFileTypes.join(", ")}` });
    }

    if (req.file.size > maxFileSizeBytes) {
      return res.status(400).json({ error: `File too large. Maximum size: ${maxFileSizeBytes / 1024 / 1024}MB` });
    }

    const { id: productId, reviewId } = req.params;
    const source = reviewId ? "review" : "product";

    if (source === "review") {
      const reviewCheck = await require("../db/pool").query(
        "SELECT id, user_id FROM reviews WHERE id = $1 AND product_id = $2",
        [reviewId, productId]
      );
      if (reviewCheck.rows.length === 0) {
        return res.status(404).json({ error: "REVIEW_NOT_FOUND" });
      }
      if (reviewCheck.rows[0].user_id !== req.user.userId) {
        return res.status(403).json({ error: "UNAUTHORIZED_REVIEW" });
      }
    } else {
      const productCheck = await require("../db/pool").query(
        "SELECT id, user_id FROM products WHERE id = $1",
        [productId]
      );
      if (productCheck.rows.length === 0) {
        return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
      }
      if (productCheck.rows[0].user_id !== req.user.userId) {
        return res.status(403).json({ error: "You can only add evidence to your own products" });
      }
    }

    let ocrResult;
    try {
      const sharp = require("sharp");
      const ocrEngine = req.app.locals.ocrEngine;

      if (!ocrEngine) {
        return res.status(503).json({ error: "OCR service not available" });
      }

      const pngBuffer = await sharp(req.file.buffer).png().toBuffer();
      ocrResult = await ocrEngine.extract(pngBuffer);
    } catch (ocrError) {
      console.error("OCR failed:", ocrError);
      return res.status(500).json({ error: "OCR_FAILED", details: "Failed to process image" });
    }

    const result = await processEvidence({
      ocrResult,
      productId,
      reviewId: reviewId || null,
      userId: req.user.userId,
      source,
    });

    const publicState = getPublicEvidenceState({
      verification_status: result.verification.status,
    });

    res.status(201).json({
      verification: {
        id: result.verification.id,
        status: publicState.status,
        hasEvidence: publicState.hasEvidence,
        badge: publicState.badge,
      },
      receipt: {
        documentType: result.receipt.documentType,
        merchant: result.receipt.merchant,
        purchaseDate: result.receipt.purchaseDate,
        items: result.receipt.items,
        total: result.receipt.total,
      },
      productMatch: {
        matched: result.productMatch.matched,
        confidence: result.productMatch.confidence,
      },
    });
  } catch (error) {
    console.error("Upload evidence error:", error);
    if (error.message === "PRODUCT_NOT_FOUND") {
      return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

const getEvidenceForReview = async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params;

    const reviewCheck = await require("../db/pool").query(
      "SELECT id, user_id, evidence_id FROM reviews WHERE id = $1 AND product_id = $2",
      [reviewId, productId]
    );
    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: "REVIEW_NOT_FOUND" });
    }

    if (!reviewCheck.rows[0].evidence_id) {
      return res.status(404).json({ error: "No evidence found for this review" });
    }

    const evidence = await getEvidence(reviewCheck.rows[0].evidence_id);
    if (!evidence) {
      return res.status(404).json({ error: "EVIDENCE_NOT_FOUND" });
    }

    const isOwner = req.user && req.user.userId === reviewCheck.rows[0].user_id;

    if (isOwner) {
      res.json(getPublicEvidenceDetails(evidence));
    } else {
      const publicState = getPublicEvidenceState({ verification_status: evidence.verification.status });
      res.json({
        status: publicState.status,
        badge: publicState.badge,
      });
    }
  } catch (error) {
    console.error("Get evidence error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getEvidenceForProduct = async (req, res) => {
  try {
    const { id: productId } = req.params;

    const productCheck = await require("../db/pool").query(
      "SELECT id, evidence_id FROM products WHERE id = $1",
      [productId]
    );
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
    }

    if (!productCheck.rows[0].evidence_id) {
      return res.status(404).json({ error: "No evidence found for this product" });
    }

    const evidence = await getEvidence(productCheck.rows[0].evidence_id);
    if (!evidence) {
      return res.status(404).json({ error: "EVIDENCE_NOT_FOUND" });
    }

    const publicState = getPublicEvidenceState({ verification_status: evidence.verification.status });
    res.json({
      status: publicState.status,
      badge: publicState.badge,
      hasEvidence: publicState.hasEvidence,
    });
  } catch (error) {
    console.error("Get product evidence error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteReviewEvidence = async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params;

    const reviewCheck = await require("../db/pool").query(
      "SELECT id, evidence_id FROM reviews WHERE id = $1 AND product_id = $2",
      [reviewId, productId]
    );
    if (reviewCheck.rows.length === 0) {
      return res.status(404).json({ error: "REVIEW_NOT_FOUND" });
    }

    if (!reviewCheck.rows[0].evidence_id) {
      return res.status(404).json({ error: "No evidence found for this review" });
    }

    await deleteEvidence(reviewCheck.rows[0].evidence_id, req.user.userId);
    res.json({ message: "Evidence deleted" });
  } catch (error) {
    console.error("Delete evidence error:", error);
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json({ error: "You can only delete your own evidence" });
    }
    if (error.message === "EVIDENCE_NOT_FOUND") {
      return res.status(404).json({ error: "EVIDENCE_NOT_FOUND" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteProductEvidence = async (req, res) => {
  try {
    const { id: productId } = req.params;

    const productCheck = await require("../db/pool").query(
      "SELECT id, evidence_id FROM products WHERE id = $1",
      [productId]
    );
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
    }

    if (!productCheck.rows[0].evidence_id) {
      return res.status(404).json({ error: "No evidence found for this product" });
    }

    await deleteEvidence(productCheck.rows[0].evidence_id, req.user.userId);
    res.json({ message: "Evidence deleted" });
  } catch (error) {
    console.error("Delete product evidence error:", error);
    if (error.message === "UNAUTHORIZED") {
      return res.status(403).json({ error: "You can only delete your own evidence" });
    }
    if (error.message === "EVIDENCE_NOT_FOUND") {
      return res.status(404).json({ error: "EVIDENCE_NOT_FOUND" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  uploadEvidence,
  getEvidenceForReview,
  getEvidenceForProduct,
  deleteReviewEvidence,
  deleteProductEvidence,
};
