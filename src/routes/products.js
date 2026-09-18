const express = require("express");
const auth = require("../middleware/auth");
const {
  createProduct,
  getProducts,
  searchProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  saveProduct,
  unsaveProduct,
  globalSearch,
} = require("../controllers/productController");
const {
  addReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");

const router = express.Router();

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     tags: [Products]
 *     summary: Search and filter products
 *     description: |
 *       Multi-step search with filters. All params are optional — use any combination.
 *       - Text search matches against name, category, and description
 *       - Category filters to exact match
 *       - Min rating filters by average review score (1-10)
 *       - Duration filters by how long reviewers used the product
 *       - Sort by newest, rating, reviews, or trending (recent review activity)
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (matches name, category, description)
 *         example: sony headphones
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category (exact match)
 *         example: Headphones
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 10
 *         description: Minimum average rating (1-10)
 *         example: 7
 *       - in: query
 *         name: duration
 *         schema:
 *           type: string
 *           enum: [a few days, a few weeks, a few months, a year, more than a year]
 *         description: Filter by how long reviewers used the product
 *         example: a year
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, rating, reviews, trending]
 *           default: newest
 *         description: |
 *           Sort order:
 *           - newest: most recently created (default)
 *           - rating: highest average rating
 *           - reviews: most reviews
 *           - trending: most reviews in last 30 days
 *     responses:
 *       200:
 *         description: Filtered and sorted products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid filter parameters
 */
router.get("/search", searchProducts);

router.get("/global-search", globalSearch);

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     tags: [Products]
 *     summary: Get all categories with images and taglines
 *     description: Returns predefined categories with metadata. Product counts are derived from actual products.
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: Headphones
 *                   image:
 *                     type: string
 *                     format: uri
 *                     example: https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400
 *                   tagline:
 *                     type: string
 *                     example: Immerse yourself in sound
 *                   product_count:
 *                     type: integer
 *                     example: 5
 */
router.get("/categories", getCategories);

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: Get all products
 *     responses:
 *       200:
 *         description: List of all products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get("/", getProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get a product by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
router.get("/:id", getProduct);

/**
 * @swagger
 * /api/products:
 *   post:
 *     tags: [Products]
 *     summary: Create a new product
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Sony WH-1000XM6
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category:
 *                 type: string
 *                 example: Headphones
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Name is required
 */
router.post("/", auth, createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product updated
 *       403:
 *         description: Not the product owner
 *       404:
 *         description: Product not found
 */
router.put("/:id", auth, updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a product
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
 *         description: Product deleted
 *       403:
 *         description: Not the product owner
 *       404:
 *         description: Product not found
 */
router.delete("/:id", auth, deleteProduct);

/**
 * @swagger
 * /api/products/{id}/save:
 *   post:
 *     tags: [Products]
 *     summary: Save a product to your collection
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
 *       201:
 *         description: Product saved
 *       409:
 *         description: Product already saved
 */
router.post("/:id/save", auth, saveProduct);

/**
 * @swagger
 * /api/products/{id}/save:
 *   delete:
 *     tags: [Products]
 *     summary: Remove a product from your collection
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
 *         description: Product unsaved
 *       404:
 *         description: Saved item not found
 */
router.delete("/:id/save", auth, unsaveProduct);

/**
 * @swagger
 * /api/products/{id}/reviews:
 *   get:
 *     tags: [Reviews]
 *     summary: Get reviews for a product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     responses:
 *       200:
 *         description: List of reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 *       404:
 *         description: Product not found
 */
router.get("/:id/reviews", getReviews);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}:
 *   get:
 *     tags: [Reviews]
 *     summary: Get a single review with full details
 *     description: |
 *       Returns the complete review including ratings, goods, tradeoffs, and verification status.
 *       Also returns up to 3 other reviews for the same product.
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
 *     responses:
 *       200:
 *         description: Review details with more reviews
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Review'
 *                 - type: object
 *                   properties:
 *                     owner_id:
 *                       type: string
 *                       format: uuid
 *                     owner_name:
 *                       type: string
 *                     product_name:
 *                       type: string
 *                     product_category:
 *                       type: string
 *                     more_reviews:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           review_text:
 *                             type: string
 *                           recommendation:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           owner_name:
 *                             type: string
 *       404:
 *         description: Review not found
 */
router.get("/:id/reviews/:reviewId", getReview);

/**
 * @swagger
 * /api/products/{id}/reviews:
 *   post:
 *     tags: [Reviews]
 *     summary: Write a review for a product
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [duration_used, review_text, build_integrity, longevity, value_ratio, recommendation]
 *             properties:
 *               duration_used:
 *                 type: string
 *                 enum: [a few days, a few weeks, a few months, a year, more than a year]
 *               review_text:
 *                 type: string
 *               build_integrity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               longevity:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               value_ratio:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *               recommendation:
 *                 type: string
 *                 enum: [buy, pass, consider]
 *               goods:
 *                 type: array
 *                 items:
 *                   type: string
 *               tradeoffs:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Review created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Review'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Already reviewed this product
 */
router.post("/:id/reviews", auth, addReview);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}:
 *   put:
 *     tags: [Reviews]
 *     summary: Update your review
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
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration_used:
 *                 type: string
 *               review_text:
 *                 type: string
 *               build_integrity:
 *                 type: integer
 *               longevity:
 *                 type: integer
 *               value_ratio:
 *                 type: integer
 *               recommendation:
 *                 type: string
 *               goods:
 *                 type: array
 *                 items:
 *                   type: string
 *               tradeoffs:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Review updated
 *       403:
 *         description: Not the review owner
 *       404:
 *         description: Review not found
 */
router.put("/:id/reviews/:reviewId", auth, updateReview);

/**
 * @swagger
 * /api/products/{id}/reviews/{reviewId}:
 *   delete:
 *     tags: [Reviews]
 *     summary: Delete your review
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
 *         description: Review deleted
 *       403:
 *         description: Not the review owner
 *       404:
 *         description: Review not found
 */
router.delete("/:id/reviews/:reviewId", auth, deleteReview);

module.exports = router;
