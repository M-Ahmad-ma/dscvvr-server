const express = require("express");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const userRoutes = require("./routes/users");
const reviewRoutes = require("./routes/reviews");
const evidenceRoutes = require("./routes/evidence");
const uploadRoutes = require("./routes/upload");
const pool = require("./db/pool");
const cors = require("cors");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: ".swagger-ui .topbar { display: none }",
  customSiteTitle: "Product Review API Docs",
}));
app.get("/docs.json", (req, res) => res.json(swaggerSpec));

let ocrEngine = null;

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: "error", message: "Database connection failed" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/upload", uploadRoutes);
app.use(evidenceRoutes);

const startServer = async () => {
  try {
    const initSql = fs.readFileSync(path.join(__dirname, "db/init.sql"), "utf8");
    await pool.query(initSql);
    console.log("Database initialized");

    try {
      const { OcrEngine } = require("../ocr");
      ocrEngine = new OcrEngine();
      await ocrEngine.ready;
      app.locals.ocrEngine = ocrEngine;
      console.log("OCR engine initialized");
    } catch (ocrError) {
      console.warn("OCR engine failed to initialize:", ocrError.message);
      console.warn("Evidence upload will return 503 until OCR is available");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
