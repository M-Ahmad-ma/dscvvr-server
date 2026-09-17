const pool = require("../db/pool");

const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, role, avatar_url, bio, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, role, avatar_url, bio } = req.body;

    if (email) {
      const existing = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email, req.user.userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }
    }

    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           avatar_url = COALESCE($4, avatar_url),
           bio = COALESCE($5, bio)
       WHERE id = $6
       RETURNING id, name, email, role, avatar_url, bio, created_at`,
      [name || null, email || null, role || null, avatar_url || null, bio || null, req.user.userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getMyProducts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
              COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM products p
       LEFT JOIN reviews r ON p.id = r.product_id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get my products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getMyReviews = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.name AS product_name, p.category AS product_category
       FROM reviews r
       JOIN products p ON r.product_id = p.id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get my reviews error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getMySaved = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, s.created_at AS saved_at,
              u.name AS author_name,
              COALESCE(ROUND(AVG((r.build_integrity + r.longevity + r.value_ratio)::DECIMAL / 3), 1), 0) AS avg_rating,
              COUNT(r.id) AS review_count
       FROM saved_items s
       JOIN products p ON s.product_id = p.id
       JOIN users u ON p.user_id = u.id
       LEFT JOIN reviews r ON p.id = r.product_id
       WHERE s.user_id = $1
       GROUP BY p.id, u.name, s.created_at
       ORDER BY s.created_at DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get my saved error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getProfile, updateProfile, getMyProducts, getMyReviews, getMySaved };
