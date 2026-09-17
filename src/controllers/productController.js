const pool = require("../db/pool");

const createProduct = async (req, res) => {
  try {
    const { name, description, image_url, category } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await pool.query(
      `INSERT INTO products (user_id, name, description, image_url, category)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.userId, name, description || null, image_url || null, category || null]
    );

    const product = result.rows[0];
    product.verification = product.evidence_id
      ? { score: product.evidence_score, status: product.verification_status, hasEvidence: true }
      : { score: null, status: null, hasEvidence: false };

    res.status(201).json(product);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getProducts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.name AS author_name,
              COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM products p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN reviews r ON p.id = r.product_id
       GROUP BY p.id, u.name
       ORDER BY p.created_at DESC`
    );

    const products = result.rows.map((p) => ({
      ...p,
      verification: p.evidence_id
        ? { score: p.evidence_score, status: p.verification_status, hasEvidence: true }
        : { score: null, status: null, hasEvidence: false },
    }));

    res.json(products);
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const searchProducts = async (req, res) => {
  try {
    const { q, category, minRating, duration, sort, page = 1, limit = 6 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 6));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (q) {
      whereConditions.push(
        `(p.name ILIKE $${paramIndex} OR p.category ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`
      );
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (category) {
      whereConditions.push(`p.category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (duration) {
      whereConditions.push(
        `r.duration_used = $${paramIndex}`
      );
      params.push(duration);
      paramIndex++;
    }

    let havingConditions = [];
    if (minRating) {
      havingConditions.push(
        `COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) >= $${paramIndex}`
      );
      params.push(parseFloat(minRating));
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(" AND ")}`
      : "";
    const havingClause = havingConditions.length > 0
      ? `HAVING ${havingConditions.join(" AND ")}`
      : "";

    let orderBy;
    switch (sort) {
      case "rating":
        orderBy = "avg_rating DESC, review_count DESC";
        break;
      case "reviews":
        orderBy = "review_count DESC, avg_rating DESC";
        break;
      case "trending":
        orderBy = "recent_reviews DESC, avg_rating DESC, review_count DESC";
        break;
      case "newest":
      default:
        orderBy = "p.created_at DESC";
        break;
    }

    const countResult = await pool.query(
      `WITH product_stats AS (
         SELECT p.id
         FROM products p
         JOIN users u ON p.user_id = u.id
         LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'PUBLISHED'
         ${whereClause}
         GROUP BY p.id
         ${havingClause}
       )
       SELECT COUNT(*)::INT AS total FROM product_stats`,
      params
    );

    const total = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    const paginatedParams = [...params, limitNum, offset];
    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;

    const result = await pool.query(
      `WITH product_stats AS (
         SELECT p.*, u.name AS author_name,
                COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
                COUNT(r.id) AS review_count,
                COUNT(CASE WHEN r.created_at > NOW() - INTERVAL '30 days' THEN 1 END) AS recent_reviews
         FROM products p
         JOIN users u ON p.user_id = u.id
         LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'PUBLISHED'
         ${whereClause}
         GROUP BY p.id, u.name
         ${havingClause}
         ORDER BY ${orderBy}
         LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
       )
       SELECT * FROM product_stats`,
      paginatedParams
    );

    const products = result.rows.map((p) => ({
      ...p,
      verification: p.evidence_id
        ? { score: p.evidence_score, status: p.verification_status, hasEvidence: true }
        : { score: null, status: null, hasEvidence: false },
    }));

    res.json({ products, total, page: pageNum, limit: limitNum, totalPages });
  } catch (error) {
    console.error("Search products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.*, u.name AS author_name,
              COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM products p
       JOIN users u ON p.user_id = u.id
       LEFT JOIN reviews r ON p.id = r.product_id
       WHERE p.id = $1
       GROUP BY p.id, u.name`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const product = result.rows[0];
    product.verification = product.evidence_id
      ? { score: product.evidence_score, status: product.verification_status, hasEvidence: true }
      : { score: null, status: null, hasEvidence: false };

    res.json(product);
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, category } = req.body;

    const existing = await pool.query("SELECT user_id FROM products WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: "You can only update your own products" });
    }

    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           image_url = COALESCE($3, image_url),
           category = COALESCE($4, category),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name || null, description || null, image_url || null, category || null, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await pool.query("SELECT user_id FROM products WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (existing.rows[0].user_id !== req.user.userId) {
      return res.status(403).json({ error: "You can only delete your own products" });
    }

    await pool.query("DELETE FROM products WHERE id = $1", [id]);
    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const saveProduct = async (req, res) => {
  try {
    const { id: productId } = req.params;

    const product = await pool.query("SELECT id FROM products WHERE id = $1", [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const existing = await pool.query(
      "SELECT id FROM saved_items WHERE user_id = $1 AND product_id = $2",
      [req.user.userId, productId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Product already saved" });
    }

    await pool.query(
      "INSERT INTO saved_items (user_id, product_id) VALUES ($1, $2)",
      [req.user.userId, productId]
    );

    res.status(201).json({ message: "Product saved" });
  } catch (error) {
    console.error("Save product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.name, c.image, c.tagline,
              COUNT(p.id)::INT AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category = c.name
       GROUP BY c.id, c.name, c.image, c.tagline
       ORDER BY product_count DESC, c.name ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const unsaveProduct = async (req, res) => {
  try {
    const { id: productId } = req.params;

    const result = await pool.query(
      "DELETE FROM saved_items WHERE user_id = $1 AND product_id = $2",
      [req.user.userId, productId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Saved item not found" });
    }

    res.json({ message: "Product unsaved" });
  } catch (error) {
    console.error("Unsave product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createProduct,
  getProducts,
  searchProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  saveProduct,
  unsaveProduct,
};
