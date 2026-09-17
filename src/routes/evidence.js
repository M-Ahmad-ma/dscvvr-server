const express = require("express");
const multer = require("multer");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  uploadEvidence,
  getEvidenceForReview,
  getEvidenceForProduct,
  deleteReviewEvidence,
  deleteProductEvidence,
} = require("../controllers/evidenceController");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * @swagger
 * /api/products/{id}/evidence:
 *   post:
 *     tags: [Evidence]
 *     summary: Upload purchase evidence for a product
 *     description: |
 *       Upload a receipt image as product-level evidence.
 *       The receipt is processed through OCR, parsed, validated, and scored.
 *       Only the product owner can upload evidence.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Receipt image (JPEG, PNG, WEBP, AVIF, PDF — max 10MB)
 *     responses:
 *       201:
 *         description: Evidence processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EvidenceUploadResponse'
 *       400:
 *         description: Invalid file or missing upload
 *       403:
 *         description: Not the product owner
 *       404:
 *         description: Product not found
 *       503:
 *         description: OCR service not available
 */
router.post(
  "/api/products/:id/evidence",
  auth,
  upload.single("file"),
  uploadEvidence
);

/**
 * @swagger
 * /api/products/{id}/evidence:
 *   get:
 *     tags: [Evidence]
 *     summary: Get product-level evidence (public)
 *     description: Returns sanitized evidence status. No raw scores or internal data exposed.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Evidence status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [NO_EVIDENCE, STRONG_EVIDENCE, GOOD_EVIDENCE, WEAK_EVIDENCE, SUSPICIOUS]
 *                 badge:
 *                   type: string
 *                   nullable: true
 *                 hasEvidence:
 *                   type: boolean
 *       404:
 *         description: No evidence found
 */
router.get(
  "/api/products/:id/evidence",
  getEvidenceForProduct
);

/**
 * @swagger
 * /api/products/{id}/evidence:
 *   delete:
 *     tags: [Evidence]
 *     summary: Delete product-level evidence
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Evidence deleted
 *       403:
 *         description: Not the evidence owner
 *       404:
 *         description: Evidence not found
 */
router.delete(
  "/api/products/:id/evidence",
  auth,
  deleteProductEvidence
);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}/evidence:
 *   post:
 *     tags: [Evidence]
 *     summary: Upload purchase evidence for a review
 *     description: |
 *       Upload a receipt image as review-level evidence.
 *       The receipt is processed through OCR, parsed, validated, and scored.
 *       Only the review owner can upload evidence.
 *       Duplicate detection works across all evidence (product + review level).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Review ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Receipt image (JPEG, PNG, WEBP, AVIF, PDF — max 10MB)
 *     responses:
 *       201:
 *         description: Evidence processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EvidenceUploadResponse'
 *       400:
 *         description: Invalid file
 *       403:
 *         description: Not the review owner
 *       404:
 *         description: Review not found
 *       503:
 *         description: OCR service not available
 */
router.post(
  "/api/products/:id/reviews/:reviewId/evidence",
  auth,
  upload.single("file"),
  uploadEvidence
);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}/evidence:
 *   get:
 *     tags: [Evidence]
 *     summary: Get evidence details for a review
 *     description: |
 *       Authenticated review owner receives detailed per-check breakdown.
 *       Other authenticated users receive only the public status and badge.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Evidence details (owner) or public status (others)
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/EvidenceDetails'
 *                 - type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     badge:
 *                       type: string
 *                       nullable: true
 *       404:
 *         description: Evidence not found
 */
router.get(
  "/api/products/:id/reviews/:reviewId/evidence",
  auth,
  getEvidenceForReview
);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}/evidence:
 *   delete:
 *     tags: [Evidence]
 *     summary: Delete evidence from a review
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Evidence deleted
 *       403:
 *         description: Not the evidence owner
 *       404:
 *         description: Evidence not found
 */
router.delete(
  "/api/products/:id/reviews/:reviewId/evidence",
  auth,
  deleteReviewEvidence
);

module.exports = router;
