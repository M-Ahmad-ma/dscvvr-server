const express = require("express");
const auth = require("../middleware/auth");
const {
  getProfile,
  updateProfile,
  getMyProducts,
  getMyReviews,
  getMySaved,
} = require("../controllers/userController");

const router = express.Router();

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get your profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Your profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get("/me", auth, getProfile);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     tags: [Users]
 *     summary: Update your profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Not authenticated
 */
router.put("/me", auth, updateProfile);

/**
 * @swagger
 * /api/users/me/products:
 *   get:
 *     tags: [Users]
 *     summary: Get your products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Your products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get("/me/products", auth, getMyProducts);

/**
 * @swagger
 * /api/users/me/reviews:
 *   get:
 *     tags: [Users]
 *     summary: Get your reviews
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Your reviews
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 */
router.get("/me/reviews", auth, getMyReviews);

/**
 * @swagger
 * /api/users/me/saved:
 *   get:
 *     tags: [Users]
 *     summary: Get your saved products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Your saved products
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get("/me/saved", auth, getMySaved);

module.exports = router;
