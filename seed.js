require("dotenv").config();
const pool = require("./src/db/pool");
const bcrypt = require("bcrypt");
const fs = require("fs");
const path = require("path");

const users = [
  { name: "John Doe", email: "john@test.com", password: "pass123", role: "Software Engineer" },
  { name: "Jane Smith", email: "jane@test.com", password: "pass123", role: "Product Manager" },
  { name: "Alex Johnson", email: "alex@test.com", password: "pass123", role: "UX Designer" },
  { name: "Sarah Williams", email: "sarah@test.com", password: "pass123", role: "Data Scientist" },
  { name: "Mike Brown", email: "mike@test.com", password: "pass123", role: "DevOps Engineer" },
];

const products = [
  {
    user_idx: 0,
    name: "MacBook Pro 16\"",
    description: "Apple's flagship laptop with M3 Pro chip. Excellent for development and creative work.",
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
    category: "electronics",
  },
  {
    user_idx: 1,
    name: "Sony WH-1000XM5",
    description: "Industry-leading noise canceling headphones with exceptional sound quality.",
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
    category: "electronics",
  },
  {
    user_idx: 2,
    name: "Herman Miller Aeron",
    description: "Ergonomic office chair loved by professionals. Worth every penny.",
    image_url: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800",
    category: "furniture",
  },
  {
    user_idx: 3,
    name: "Notion",
    description: "All-in-one workspace for notes, docs, wikis, and project management.",
    image_url: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800",
    category: "software",
  },
  {
    user_idx: 4,
    name: "Docker Desktop",
    description: "Containerization platform for building and deploying applications.",
    image_url: "https://images.unsplash.com/photo-1605745341112-85968b19335b?w=800",
    category: "software",
  },
  {
    user_idx: 0,
    name: "Logitech MX Master 3S",
    description: "Wireless ergonomic mouse with electromagnetic scroll wheel. Perfect for productivity.",
    image_url: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800",
    category: "electronics",
  },
  {
    user_idx: 1,
    name: "Standing Desk Pro",
    description: "Electric height-adjustable desk with memory presets. Great for health.",
    image_url: "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800",
    category: "furniture",
  },
  {
    user_idx: 2,
    name: "iPad Pro 12.9\"",
    description: "Powerful tablet with M2 chip. Great for design and note-taking.",
    image_url: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800",
    category: "electronics",
  },
  {
    user_idx: 3,
    name: "Figma",
    description: "Collaborative interface design tool. Essential for UI/UX work.",
    image_url: "https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=800",
    category: "software",
  },
  {
    user_idx: 4,
    name: "Keychron K2",
    description: "Mechanical keyboard with wireless connectivity. Great typing experience.",
    image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800",
    category: "electronics",
  },
];

const reviews = [
  // MacBook Pro
  { product_idx: 0, user_idx: 1, duration_used: "a few months", review_text: "Incredible machine. The M3 Pro handles everything I throw at it. Battery life is outstanding.", build_integrity: 9, longevity: 9, value_ratio: 7, recommendation: "buy", goods: ["Blazing fast performance", "Amazing battery life", "Premium build quality"], tradeoffs: ["Expensive", "Limited port selection", "No touchscreen"] },
  { product_idx: 0, user_idx: 2, duration_used: "a year", review_text: "Still going strong after a year. Best laptop I've ever owned.", build_integrity: 9, longevity: 9, value_ratio: 8, recommendation: "buy", goods: ["Reliable performance", "Great display", "Silent operation"], tradeoffs: ["Pricey repair costs", "RAM not upgradeable"] },
  { product_idx: 0, user_idx: 3, duration_used: "a few weeks", review_text: "Just got it and already love it. Setup was seamless.", build_integrity: 9, longevity: 8, value_ratio: 7, recommendation: "buy", goods: ["Easy setup", "Fast", "Beautiful screen"], tradeoffs: ["Still getting used to macOS", "Expensive"] },

  // Sony WH-1000XM5
  { product_idx: 1, user_idx: 0, duration_used: "a few months", review_text: "Best noise canceling headphones on the market. Comfortable for long sessions.", build_integrity: 8, longevity: 8, value_ratio: 8, recommendation: "buy", goods: ["Incredible ANC", "Comfortable", "Great sound"], tradeoffs: ["No foldable design", "Touch controls can be finicky"] },
  { product_idx: 1, user_idx: 3, duration_used: "a few weeks", review_text: "Sound quality is phenomenal. ANC blocks out everything.", build_integrity: 8, longevity: 7, value_ratio: 8, recommendation: "buy", goods: ["Top-tier sound", "Effective noise canceling", "Long battery"], tradeoffs: ["Feels plasticky", "Case is bulky"] },

  // Herman Miller Aeron
  { product_idx: 2, user_idx: 0, duration_used: "more than a year", review_text: "Changed my life. No more back pain after long coding sessions.", build_integrity: 10, longevity: 10, value_ratio: 6, recommendation: "buy", goods: ["Ergonomic perfection", "Built to last 12+ years", "Adjustable everything"], tradeoffs: ["Very expensive", "Heavy", "Takes time to adjust"] },
  { product_idx: 2, user_idx: 4, duration_used: "a few months", review_text: "Worth the investment. My back thanks me every day.", build_integrity: 9, longevity: 9, value_ratio: 6, recommendation: "buy", goods: ["Incredible comfort", "Premium materials", "Great warranty"], tradeoffs: ["High price point", "No headrest included"] },

  // Notion
  { product_idx: 3, user_idx: 0, duration_used: "more than a year", review_text: "All my notes, docs, and project management in one place. Can't imagine going back.", build_integrity: 8, longevity: 8, value_ratio: 9, recommendation: "buy", goods: ["Incredibly versatile", "Great templates", "Collaborative"], tradeoffs: ["Can be slow with large databases", "Steep learning curve"] },
  { product_idx: 3, user_idx: 4, duration_used: "a few months", review_text: "Replaced 5 different tools for me. Learning curve is worth it.", build_integrity: 8, longevity: 7, value_ratio: 9, recommendation: "buy", goods: ["Replaces multiple apps", "Customizable", "Good free tier"], tradeoffs: ["Offline mode is limited", "Mobile app could be better"] },

  // Docker Desktop
  { product_idx: 4, user_idx: 0, duration_used: "more than a year", review_text: "Essential for any developer. Containers make environment setup trivial.", build_integrity: 8, longevity: 8, value_ratio: 9, recommendation: "buy", goods: ["Simplifies deployments", "Great for teams", "Huge ecosystem"], tradeoffs: ["Resource hungry", "Can be complex for beginners"] },
  { product_idx: 4, user_idx: 1, duration_used: "a few months", review_text: "Game changer for our deployment pipeline.", build_integrity: 8, longevity: 8, value_ratio: 9, recommendation: "buy", goods: ["Consistent environments", "Easy rollback", "Great documentation"], tradeoffs: ["Docker Desktop licensing changed", "Mac version uses more RAM"] },

  // Logitech MX Master 3S
  { product_idx: 5, user_idx: 2, duration_used: "a year", review_text: "The scroll wheel alone is worth it. Ergonomic and precise.", build_integrity: 9, longevity: 9, value_ratio: 8, recommendation: "buy", goods: ["Incredible scroll wheel", "Comfortable", "Multi-device support"], tradeoffs: ["Software can be buggy", "Not ideal for gaming"] },
  { product_idx: 5, user_idx: 3, duration_used: "a few weeks", review_text: "Best productivity mouse. The gesture buttons are genius.", build_integrity: 9, longevity: 8, value_ratio: 8, recommendation: "buy", goods: ["Productivity features", "USB-C charging", "Works on any surface"], tradeoffs: ["A bit heavy", "Pricey for a mouse"] },

  // Standing Desk Pro
  { product_idx: 6, user_idx: 0, duration_used: "a few months", review_text: "Love switching between sitting and standing. Memory presets are convenient.", build_integrity: 8, longevity: 8, value_ratio: 7, recommendation: "buy", goods: ["Smooth height adjustment", "Sturdy", "Memory presets"], tradeoffs: ["Assembly takes time", "Cable management could be better"] },
  { product_idx: 6, user_idx: 2, duration_used: "a year", review_text: "Back and neck pain gone. Essential for desk workers.", build_integrity: 8, longevity: 8, value_ratio: 8, recommendation: "buy", goods: ["Health benefits", "Solid construction", "Quiet motor"], tradeoffs: ["Needs a good mat", "Desk wobbles slightly at max height"] },

  // iPad Pro
  { product_idx: 7, user_idx: 0, duration_used: "a few months", review_text: "Apple Pencil makes this incredible for design work and note-taking.", build_integrity: 9, longevity: 8, value_ratio: 7, recommendation: "consider", goods: ["Stunning display", "Apple Pencil support", "Portable"], tradeoffs: ["iPadOS limitations", "Accessories add up in cost"] },
  { product_idx: 7, user_idx: 4, duration_used: "a few weeks", review_text: "Great tablet but still can't replace my laptop for serious work.", build_integrity: 9, longevity: 8, value_ratio: 7, recommendation: "consider", goods: ["Beautiful screen", "Fast", "Good for media consumption"], tradeoffs: ["Not a laptop replacement", "Files app needs work"] },

  // Figma
  { product_idx: 8, user_idx: 1, duration_used: "more than a year", review_text: "The best design tool out there. Collaboration features are unmatched.", build_integrity: 9, longevity: 9, value_ratio: 9, recommendation: "buy", goods: ["Real-time collaboration", "Browser-based", "Huge plugin ecosystem"], tradeoffs: ["Can lag with complex files", "Internet required"] },
  { product_idx: 8, user_idx: 3, duration_used: "a few months", review_text: "Switched from Sketch and never looked back. So much better for teams.", build_integrity: 9, longevity: 8, value_ratio: 9, recommendation: "buy", goods: ["Team-friendly", "Free for small teams", "Cross-platform"], tradeoffs: ["Learning curve for Sketch users", "Performance with large files"] },

  // Keychron K2
  { product_idx: 9, user_idx: 1, duration_used: "a year", review_text: "Perfect balance of features and price. Great for coding.", build_integrity: 8, longevity: 8, value_ratio: 9, recommendation: "buy", goods: ["Great typing feel", "Wireless + wired", "Mac/Windows compatible"], tradeoffs: ["Bluetooth can be flaky", "No backlit on some keys"] },
  { product_idx: 9, user_idx: 4, duration_used: "a few months", review_text: "Best budget mechanical keyboard. Switches are hot-swappable.", build_integrity: 8, longevity: 7, value_ratio: 9, recommendation: "buy", goods: ["Affordable", "Hot-swappable switches", "Good build quality"], tradeoffs: ["Stock keycaps are mediocre", "No USB passthrough"] },
];

async function seed() {
  try {
    console.log("Seeding database...");

    const initSql = fs.readFileSync(path.join(__dirname, "src/db/init.sql"), "utf8");
    await pool.query("DROP TABLE IF EXISTS saved_items CASCADE");
    await pool.query("DROP TABLE IF EXISTS reviews CASCADE");
    await pool.query("DROP TABLE IF EXISTS products CASCADE");
    await pool.query("DROP TABLE IF EXISTS users CASCADE");
    await pool.query(initSql);
    console.log("Tables recreated");

    // Insert users
    const userIds = [];
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 10);
      const res = await pool.query(
        "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id",
        [u.name, u.email, hash, u.role]
      );
      userIds.push(res.rows[0].id);
    }
    console.log(`Inserted ${users.length} users`);

    // Insert products
    const productIds = [];
    for (const p of products) {
      const res = await pool.query(
        "INSERT INTO products (user_id, name, description, image_url, category) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [userIds[p.user_idx], p.name, p.description, p.image_url, p.category]
      );
      productIds.push(res.rows[0].id);
    }
    console.log(`Inserted ${products.length} products`);

    // Insert reviews
    for (const r of reviews) {
      await pool.query(
        `INSERT INTO reviews (user_id, product_id, duration_used, review_text, build_integrity, longevity, value_ratio, recommendation, goods, tradeoffs)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userIds[r.user_idx],
          productIds[r.product_idx],
          r.duration_used,
          r.review_text,
          r.build_integrity,
          r.longevity,
          r.value_ratio,
          r.recommendation,
          JSON.stringify(r.goods),
          JSON.stringify(r.tradeoffs),
        ]
      );
    }
    console.log(`Inserted ${reviews.length} reviews`);

    console.log("\nSeed complete!");
    console.log("Test accounts (password: pass123):");
    users.forEach((u) => console.log(`  ${u.email}`));

    await pool.end();
  } catch (error) {
    console.error("Seed failed:", error);
    await pool.end();
    process.exit(1);
  }
}

seed();
