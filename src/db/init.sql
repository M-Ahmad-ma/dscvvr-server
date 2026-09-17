CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  image TEXT,
  tagline VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  category VARCHAR(100),
  evidence_id UUID,
  evidence_score INTEGER,
  verification_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'PUBLISHED',
  duration_used VARCHAR(50) NOT NULL CHECK (duration_used IN ('a few days', 'a few weeks', 'a few months', 'a year', 'more than a year')),
  review_text TEXT NOT NULL,
  build_integrity INTEGER NOT NULL CHECK (build_integrity >= 1 AND build_integrity <= 10),
  longevity INTEGER NOT NULL CHECK (longevity >= 1 AND longevity <= 10),
  value_ratio INTEGER NOT NULL CHECK (value_ratio >= 1 AND value_ratio <= 10),
  recommendation VARCHAR(20) NOT NULL CHECK (recommendation IN ('buy', 'pass', 'consider')),
  goods JSONB DEFAULT '[]'::jsonb,
  tradeoffs JSONB DEFAULT '[]'::jsonb,
  evidence_id UUID,
  evidence_score INTEGER,
  verification_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS saved_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  review_id UUID,
  source VARCHAR(20) NOT NULL CHECK (source IN ('product', 'review')),
  request_id VARCHAR(255),
  document_type VARCHAR(50) DEFAULT 'receipt',
  raw_ocr_text TEXT,
  ocr_confidence INTEGER,
  merchant_name VARCHAR(255),
  merchant_address TEXT,
  purchase_date VARCHAR(50),
  subtotal DECIMAL(12,2),
  tax DECIMAL(12,2),
  total DECIMAL(12,2),
  currency VARCHAR(10) DEFAULT 'USD',
  order_number VARCHAR(255),
  transaction_number VARCHAR(255),
  fingerprint VARCHAR(64),
  validation_status VARCHAR(50),
  evidence_score INTEGER,
  verification_status VARCHAR(50),
  signals JSONB DEFAULT '[]'::jsonb,
  risk_flags JSONB DEFAULT '[]'::jsonb,
  scoring_version VARCHAR(20) DEFAULT '1.0',
  parser_version VARCHAR(20) DEFAULT '1.0',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  price DECIMAL(12,2),
  quantity INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS verification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  review_id UUID,
  evidence_id UUID,
  score INTEGER,
  status VARCHAR(50),
  risk_flags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PUBLISHED';
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS risk_flags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
DROP INDEX IF EXISTS idx_evidence_fingerprint_unique;

INSERT INTO categories (name, image, tagline) VALUES
  ('Headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', 'Immerse yourself in sound'),
  ('Laptops', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400', 'Power meets portability'),
  ('Keyboards', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', 'Type with precision'),
  ('Phones', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400', 'Connected everywhere'),
  ('Cameras', 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400', 'Capture every moment'),
  ('Wearables', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', 'Track your lifestyle'),
  ('Gaming', 'https://images.unsplash.com/photo-1592840496694-26d035b52b48?w=400', 'Level up your play'),
  ('Audio', 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400', 'Hear the difference'),
  ('Tablets', 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400', 'Your canvas, anywhere'),
  ('Accessories', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', 'Complete your setup')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_review_id ON evidence(review_id);
CREATE INDEX IF NOT EXISTS idx_evidence_product_id ON evidence(product_id);
CREATE INDEX IF NOT EXISTS idx_evidence_fingerprint ON evidence(fingerprint);
CREATE INDEX IF NOT EXISTS idx_evidence_order_number ON evidence(order_number);
CREATE INDEX IF NOT EXISTS idx_evidence_transaction_number ON evidence(transaction_number);
CREATE INDEX IF NOT EXISTS idx_evidence_verification_status ON evidence(verification_status);
CREATE INDEX IF NOT EXISTS idx_evidence_fingerprint_user ON evidence(fingerprint, user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_evidence_id ON evidence_items(evidence_id);
CREATE INDEX IF NOT EXISTS idx_verification_history_user_id ON verification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_history_evidence_id ON verification_history(evidence_id);
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
