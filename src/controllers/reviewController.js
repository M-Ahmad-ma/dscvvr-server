const pool = require("../db/pool");
const { getPublicEvidenceState } = require("../services/evidencePublic");

const addReview = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const {
      duration_used,
      review_text,
      build_integrity,
      longevity,
      value_ratio,
      recommendation,
      goods,
      tradeoffs,
    } = req.body;

    if (!duration_used || !review_text || !build_integrity || !longevity || !value_ratio || !recommendation) {
      return res.status(400).json({
        error: "duration_used, review_text, build_integrity, longevity, value_ratio, and recommendation are required",
      });
    }

    const validDurations = ["a few days", "a few weeks", "a few months", "a year", "more than a year"];
    if (!validDurations.includes(duration_used)) {
      return res.status(400).json({ error: `duration_used must be one of: ${validDurations.join(", ")}` });
    }

    if (build_integrity < 1 || build_integrity > 10 || longevity < 1 || longevity > 10 || value_ratio < 1 || value_ratio > 10) {
      return res.status(400).json({ error: "Ratings must be between 1 and 10" });
    }

    const validRecommendations = ["buy", "pass", "consider"];
    if (!validRecommendations.includes(recommendation)) {
      return res.status(400).json({ error: `recommendation must be one of: ${validRecommendations.join(", ")}` });
    }

    const product = await pool.query("SELECT id FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existingReview = await pool.query(
      "SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2",
      [req.user.userId, productId]
    );
    if (existingReview.rows.length > 0) {
      return res.status(409).json({ error: "You already reviewed this product" });
    }

    const result = await pool.query(
      `INSERT INTO reviews (user_id, product_id, duration_used, review_text, build_integrity, longevity, value_ratio, recommendation, goods, tradeoffs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        req.user.userId,
        productId,
        duration_used,
        review_text,
        build_integrity,
        longevity,
        value_ratio,
        recommendation,
        JSON.stringify(goods || []),
        JSON.stringify(tradeoffs || []),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Add review error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getReviews = async (req, res) => {
  try {
    const { id: productId } = req.params;

    const product = await pool.query("SELECT id FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const result = await pool.query(
      `SELECT r.*, u.name AS reviewer_name, u.role AS reviewer_role, u.avatar_url AS reviewer_avatar
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = $1 AND r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC`,
      [productId]
    );

    const reviews = result.rows.map((r) => ({
      ...r,
      verification: getPublicEvidenceState(r.evidence_id ? { verification_status: r.verification_status } : null),
    }));

    res.json(reviews);
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getReview = async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params;

    const product = await pool.query("SELECT id FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const result = await pool.query(
      `SELECT r.*,
              u.id AS owner_id, u.name AS owner_name, u.role AS owner_role, u.avatar_url AS owner_avatar,
              p.name AS product_name, p.image_url AS product_image_url, p.category AS product_category
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       WHERE r.id = $1 AND r.product_id = $2 AND r.status = 'PUBLISHED'`,
      [reviewId, productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    const review = result.rows[0];

    const moreReviewsResult = await pool.query(
      `SELECT r.id, r.review_text, r.recommendation, r.created_at,
              u.name AS owner_name, u.avatar_url AS owner_avatar, p.image_url AS product_image_url
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       WHERE r.product_id = $2 AND r.id != $1 AND r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC
       LIMIT 3`,
      [reviewId, productId]
    );

    const relatedResult = await pool.query(
      `SELECT p.id, p.name, p.image_url, p.category,
              COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM products p
       LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'PUBLISHED'
       WHERE p.category = $1 AND p.id != $2
       GROUP BY p.id
       ORDER BY RANDOM()
       LIMIT 4`,
      [review.product_category, productId]
    );

    res.json({
      ...review,
      verification: getPublicEvidenceState(review.evidence_id ? { verification_status: review.verification_status } : null),
      more_reviews: moreReviewsResult.rows,
      related_products: relatedResult.rows,
    });
  } catch (error) {
    console.error("Get review error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateReview = async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params;
    const {
      duration_used,
      review_text,
      build_integrity,
      longevity,
      value_ratio,
      recommendation,
      goods,
      tradeoffs,
    } = req.body;

    if (duration_used) {
      const validDurations = ["a few days", "a few weeks", "a few months", "a year", "more than a year"];
      if (!validDurations.includes(duration_used)) {
        return res.status(400).json({ error: `duration_used must be one of: ${validDurations.join(", ")}` });
      }
    }

    if (build_integrity !== undefined && (build_integrity < 1 || build_integrity > 10)) {
      return res.status(400).json({ error: "build_integrity must be between 1 and 10" });
    }
    if (longevity !== undefined && (longevity < 1 || longevity > 10)) {
      return res.status(400).json({ error: "longevity must be between 1 and 10" });
    }
    if (value_ratio !== undefined && (value_ratio < 1 || value_ratio > 10)) {
      return res.status(400).json({ error: "value_ratio must be between 1 and 10" });
    }

    if (recommendation) {
      const validRecommendations = ["buy", "pass", "consider"];
      if (!validRecommendations.includes(recommendation)) {
        return res.status(400).json({ error: `recommendation must be one of: ${validRecommendations.join(", ")}` });
      }
    }

    const existing = await pool.query(
      "SELECT user_id FROM reviews WHERE id = $1 AND product_id = $2",
      [reviewId, productId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: "You can only update your own reviews" });
    }

    const result = await pool.query(
      `UPDATE reviews
       SET duration_used = COALESCE($1, duration_used),
           review_text = COALESCE($2, review_text),
           build_integrity = COALESCE($3, build_integrity),
           longevity = COALESCE($4, longevity),
           value_ratio = COALESCE($5, value_ratio),
           recommendation = COALESCE($6, recommendation),
           goods = COALESCE($7, goods),
           tradeoffs = COALESCE($8, tradeoffs),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        duration_used || null,
        review_text || null,
        build_integrity || null,
        longevity || null,
        value_ratio || null,
        recommendation || null,
        goods ? JSON.stringify(goods) : null,
        tradeoffs ? JSON.stringify(tradeoffs) : null,
        reviewId,
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params;

    const existing = await pool.query(
      "SELECT user_id FROM reviews WHERE id = $1 AND product_id = $2",
      [reviewId, productId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: "You can only delete your own reviews" });
    }

    await pool.query("DELETE FROM reviews WHERE id = $1", [reviewId]);
    res.json({ message: "Review deleted" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllReviews = async (req, res) => {
  try {
    let { page, limit } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    if (page < 1) {
      return res.status(400).json({ error: "page must be >= 1" });
    }
    if (limit < 1 || limit > 50) {
      return res.status(400).json({ error: "limit must be between 1 and 50" });
    }

    const offset = (page - 1) * limit;

    const countResult = await pool.query("SELECT COUNT(*) FROM reviews WHERE status = 'PUBLISHED'");
    const total = parseInt(countResult.rows[0].count);

    const reviewsResult = await pool.query(
      `SELECT r.*,
              u.id AS owner_id, u.name AS owner_name, u.role AS owner_role, u.avatar_url AS owner_avatar,
              p.id AS product_id, p.name AS product_name, p.description AS product_description,
              p.image_url AS product_image_url, p.category AS product_category,
              COALESCE(pr.avg_rating, 0) AS product_avg_rating,
              COALESCE(pr.review_count, 0) AS product_review_count
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       LEFT JOIN (
         SELECT product_id,
                ROUND(AVG((build_integrity + longevity + value_ratio)::DECIMAL / 3), 1) AS avg_rating,
                COUNT(*) AS review_count
         FROM reviews
         WHERE status = 'PUBLISHED'
         GROUP BY product_id
       ) pr ON pr.product_id = r.product_id
       WHERE r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    if (reviewsResult.rows.length === 0) {
      return res.json({ reviews: [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }

    const reviewIds = reviewsResult.rows.map((r) => r.id);
    const productIds = [...new Set(reviewsResult.rows.map((r) => r.product_id))];
    const categories = [...new Set(reviewsResult.rows.map((r) => r.product_category).filter(Boolean))];

    const moreReviewsResult = await pool.query(
      `SELECT r.id, r.product_id, r.review_text, r.recommendation, r.created_at, u.name AS owner_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ANY($1) AND r.id != ALL($2) AND r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC`,
      [productIds, reviewIds]
    );

    const moreReviewsMap = {};
    for (const row of moreReviewsResult.rows) {
      if (!moreReviewsMap[row.product_id]) {
        moreReviewsMap[row.product_id] = [];
      }
      if (moreReviewsMap[row.product_id].length < 3) {
        moreReviewsMap[row.product_id].push({
          id: row.id,
          review_text: row.review_text,
          recommendation: row.recommendation,
          created_at: row.created_at,
          owner_name: row.owner_name,
        });
      }
    }

    let relatedProductsResult = { rows: [] };
    if (categories.length > 0) {
      relatedProductsResult = await pool.query(
        `SELECT p.id, p.name, p.image_url, p.category,
                COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
                COUNT(r.id) AS review_count
         FROM products p
         LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'PUBLISHED'
         WHERE p.category = ANY($1) AND p.id != ALL($2)
         GROUP BY p.id
         ORDER BY RANDOM()`,
        [categories, productIds]
      );
    }

    const relatedProductsMap = {};
    for (const row of relatedProductsResult.rows) {
      if (!relatedProductsMap[row.category]) {
        relatedProductsMap[row.category] = [];
      }
      if (relatedProductsMap[row.category].length < 5) {
        relatedProductsMap[row.category].push({
          id: row.id,
          name: row.name,
          image_url: row.image_url,
          category: row.category,
          avg_rating: parseFloat(row.avg_rating),
          review_count: parseInt(row.review_count),
        });
      }
    }

    const reviews = reviewsResult.rows.map((r) => ({
      id: r.id,
      review_text: r.review_text,
      duration_used: r.duration_used,
      build_integrity: r.build_integrity,
      longevity: r.longevity,
      value_ratio: r.value_ratio,
      recommendation: r.recommendation,
      goods: r.goods,
      tradeoffs: r.tradeoffs,
      created_at: r.created_at,
      updated_at: r.updated_at,
      owner: {
        id: r.owner_id,
        name: r.owner_name,
        role: r.owner_role,
        avatar_url: r.owner_avatar,
      },
      product: {
        id: r.product_id,
        name: r.product_name,
        description: r.product_description,
        image_url: r.product_image_url,
        category: r.product_category,
        avg_rating: parseFloat(r.product_avg_rating),
        review_count: parseInt(r.product_review_count),
      },
      verification: getPublicEvidenceState(r.evidence_id ? { verification_status: r.verification_status } : null),
      more_reviews: moreReviewsMap[r.product_id] || [],
      related_products: (r.product_category && relatedProductsMap[r.product_category]) || [],
    }));

    res.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all reviews error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getPublicReviews = async (req, res) => {
  try {
    const limit = 6;

    const reviewsResult = await pool.query(
      `SELECT r.*,
              u.id AS owner_id, u.name AS owner_name, u.role AS owner_role, u.avatar_url AS owner_avatar,
              p.id AS product_id, p.name AS product_name, p.description AS product_description,
              p.image_url AS product_image_url, p.category AS product_category,
              COALESCE(pr.avg_rating, 0) AS product_avg_rating,
              COALESCE(pr.review_count, 0) AS product_review_count
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN products p ON r.product_id = p.id
       LEFT JOIN (
         SELECT product_id,
                ROUND(AVG((build_integrity + longevity + value_ratio)::DECIMAL / 3), 1) AS avg_rating,
                COUNT(*) AS review_count
         FROM reviews
         WHERE status = 'PUBLISHED'
         GROUP BY product_id
       ) pr ON pr.product_id = r.product_id
       WHERE r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC
       LIMIT $1`,
      [limit]
    );

    const reviewIds = reviewsResult.rows.map((r) => r.id);
    const productIds = [...new Set(reviewsResult.rows.map((r) => r.product_id))];
    const categories = [...new Set(reviewsResult.rows.map((r) => r.product_category).filter(Boolean))];

    const moreReviewsResult = await pool.query(
      `SELECT r.id, r.product_id, r.review_text, r.recommendation, r.created_at, u.name AS owner_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ANY($1) AND r.id != ALL($2) AND r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC`,
      [productIds, reviewIds]
    );

    const moreReviewsMap = {};
    for (const row of moreReviewsResult.rows) {
      if (!moreReviewsMap[row.product_id]) {
        moreReviewsMap[row.product_id] = [];
      }
      if (moreReviewsMap[row.product_id].length < 3) {
        moreReviewsMap[row.product_id].push({
          id: row.id,
          review_text: row.review_text,
          recommendation: row.recommendation,
          created_at: row.created_at,
          owner_name: row.owner_name,
        });
      }
    }

    let relatedProductsResult = { rows: [] };
    if (categories.length > 0) {
      relatedProductsResult = await pool.query(
        `SELECT p.id, p.name, p.image_url, p.category,
                COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
                COUNT(r.id) AS review_count
         FROM products p
         LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'PUBLISHED'
         WHERE p.category = ANY($1) AND p.id != ALL($2)
         GROUP BY p.id
         ORDER BY RANDOM()`,
        [categories, productIds]
      );
    }

    const relatedProductsMap = {};
    for (const row of relatedProductsResult.rows) {
      if (!relatedProductsMap[row.category]) {
        relatedProductsMap[row.category] = [];
      }
      if (relatedProductsMap[row.category].length < 5) {
        relatedProductsMap[row.category].push({
          id: row.id,
          name: row.name,
          image_url: row.image_url,
          category: row.category,
          avg_rating: parseFloat(row.avg_rating),
          review_count: parseInt(row.review_count),
        });
      }
    }

    const reviews = reviewsResult.rows.map((r) => ({
      id: r.id,
      review_text: r.review_text,
      duration_used: r.duration_used,
      build_integrity: r.build_integrity,
      longevity: r.longevity,
      value_ratio: r.value_ratio,
      recommendation: r.recommendation,
      goods: r.goods,
      tradeoffs: r.tradeoffs,
      created_at: r.created_at,
      updated_at: r.updated_at,
      owner: {
        id: r.owner_id,
        name: r.owner_name,
        role: r.owner_role,
        avatar_url: r.owner_avatar,
      },
      product: {
        id: r.product_id,
        name: r.product_name,
        description: r.product_description,
        image_url: r.product_image_url,
        category: r.product_category,
        avg_rating: parseFloat(r.product_avg_rating),
        review_count: parseInt(r.product_review_count),
      },
      verification: getPublicEvidenceState(r.evidence_id ? { verification_status: r.verification_status } : null),
      more_reviews: moreReviewsMap[r.product_id] || [],
      related_products: (r.product_category && relatedProductsMap[r.product_category]) || [],
    }));

    res.json({ reviews });
  } catch (error) {
    console.error("Get public reviews error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { addReview, getReviews, getReview, updateReview, deleteReview, getAllReviews, getPublicReviews };
