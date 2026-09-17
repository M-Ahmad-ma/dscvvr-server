# Product Review API - Complete Documentation

## Project Structure

```
server/
├── .env                    # Environment variables (DB creds, JWT secret)
├── .gitignore
├── package.json
├── seed.js                 # Database seeder (5 users, 10 products, 20 reviews)
├── test.sh
├── README.md
└── src/
    ├── index.js            # Express app entry point
    ├── db/
    │   ├── init.sql        # Database schema (tables + indexes)
    │   └── pool.js         # PostgreSQL connection pool
    ├── middleware/
    │   └── auth.js         # JWT auth middleware
    ├── controllers/
    │   ├── authController.js
    │   ├── productController.js
    │   ├── reviewController.js
    │   └── userController.js
    └── routes/
        ├── auth.js
        ├── products.js
        ├── users.js
        └── reviews.js
```

## Tech Stack

| Component | Tech |
|-----------|------|
| Runtime | Node.js |
| Framework | Express 5.2 |
| Database | PostgreSQL (via `pg`) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| CORS | `cors` |

## Environment Variables (.env)

```
PORT=3000
PGHOST=...
PGPORT=...
PGDATABASE=...
PGUSER=...
PGPASSWORD=...
JWT_SECRET=...
```

---

## Database Schema (init.sql)

### Table: `users`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY, auto-generated |
| `name` | VARCHAR(255) | NOT NULL |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL |
| `password` | VARCHAR(255) | NOT NULL (bcrypt hashed) |
| `role` | VARCHAR(255) | nullable (e.g. job title) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Index:** `idx_users_email` on `email`

### Table: `products`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY, auto-generated |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `name` | VARCHAR(255) | NOT NULL |
| `description` | TEXT | nullable |
| `image_url` | TEXT | nullable |
| `category` | VARCHAR(100) | nullable |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Indexes:** `idx_products_user_id`, `idx_products_name`

### Table: `reviews`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY, auto-generated |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `product_id` | UUID | NOT NULL, FK -> products(id) ON DELETE CASCADE |
| `duration_used` | VARCHAR(50) | NOT NULL, CHECK IN ('a few days','a few weeks','a few months','a year','more than a year') |
| `review_text` | TEXT | NOT NULL |
| `build_integrity` | INTEGER | NOT NULL, CHECK 1-10 |
| `longevity` | INTEGER | NOT NULL, CHECK 1-10 |
| `value_ratio` | INTEGER | NOT NULL, CHECK 1-10 |
| `recommendation` | VARCHAR(20) | NOT NULL, CHECK IN ('buy','pass','consider') |
| `goods` | JSONB | DEFAULT '[]' |
| `tradeoffs` | JSONB | DEFAULT '[]' |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Constraints:** `UNIQUE(user_id, product_id)` — one review per user per product
**Indexes:** `idx_reviews_product_id`, `idx_reviews_user_id`

### Table: `saved_items`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PRIMARY KEY, auto-generated |
| `user_id` | UUID | NOT NULL, FK -> users(id) ON DELETE CASCADE |
| `product_id` | UUID | NOT NULL, FK -> products(id) ON DELETE CASCADE |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**Constraints:** `UNIQUE(user_id, product_id)`
**Index:** `idx_saved_items_user_id`

---

## API Endpoints

Base URL: `http://localhost:3000`

### Root & Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | API status check |
| GET | `/health` | No | DB connection health check |

**GET /** Response:
```json
{ "message": "API is running" }
```

**GET /health** Response:
```json
{ "status": "ok", "timestamp": "2026-09-09T..." }
```

---

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |

#### POST `/api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@test.com",
  "password": "pass123",
  "role": "Software Engineer"   // optional
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@test.com",
    "role": "Software Engineer",
    "created_at": "2026-09-09T..."
  },
  "token": "jwt_token"
}
```

**Errors:** 400 (missing fields), 409 (email exists), 500

#### POST `/api/auth/login`

**Request Body:**
```json
{
  "email": "john@test.com",
  "password": "pass123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@test.com",
    "role": "Software Engineer",
    "created_at": "2026-09-09T..."
  },
  "token": "jwt_token"
}
```

**Errors:** 400 (missing fields), 401 (invalid credentials), 500

---

### Products (`/api/products`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/products` | No | List all products |
| GET | `/api/products/search?q=...` | No | Search products |
| GET | `/api/products/:id` | No | Get single product |
| POST | `/api/products` | Yes | Create product |
| PUT | `/api/products/:id` | Yes | Update product (owner only) |
| DELETE | `/api/products/:id` | Yes | Delete product (owner only) |
| POST | `/api/products/:id/save` | Yes | Save product |
| DELETE | `/api/products/:id/save` | Yes | Unsave product |
| GET | `/api/products/:id/reviews` | No | Get reviews for product |
| POST | `/api/products/:id/reviews` | Yes | Add review to product |
| PUT | `/api/products/:id/reviews/:reviewId` | Yes | Update review (owner only) |
| DELETE | `/api/products/:id/reviews/:reviewId` | Yes | Delete review (owner only) |

#### GET `/api/products` / GET `/api/products/search?q=macbook`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "MacBook Pro 16\"",
    "description": "...",
    "image_url": "https://...",
    "category": "electronics",
    "created_at": "...",
    "updated_at": "...",
    "author_name": "John Doe",
    "avg_rating": 8.5,
    "review_count": 3
  }
]
```

`avg_rating` = average of `(build_integrity + longevity + value_ratio) / 3` across all reviews.

#### POST `/api/products`

**Request Body:**
```json
{
  "name": "MacBook Pro 16\"",
  "description": "Apple's flagship laptop",
  "image_url": "https://...",
  "category": "electronics"
}
```

**Response (201):** Full product object.

**Errors:** 400 (name required), 401, 500

---

### Users (`/api/users`)

All endpoints require auth.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update profile |
| GET | `/api/users/me/products` | Get user's products |
| GET | `/api/users/me/reviews` | Get user's reviews |
| GET | `/api/users/me/saved` | Get user's saved products |

#### GET `/api/users/me`

**Response (200):**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@test.com",
  "role": "Software Engineer",
  "created_at": "..."
}
```

#### PUT `/api/users/me`

**Request Body (all optional):**
```json
{
  "name": "New Name",
  "email": "new@email.com",
  "role": "New Role"
}
```

**Response (200):** Updated user object.

**Errors:** 409 (email in use), 500

#### GET `/api/users/me/products`

**Response (200):** Array of products with `avg_rating` and `review_count`.

#### GET `/api/users/me/reviews`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "product_id": "uuid",
    "duration_used": "a few months",
    "review_text": "...",
    "build_integrity": 9,
    "longevity": 9,
    "value_ratio": 7,
    "recommendation": "buy",
    "goods": ["..."],
    "tradeoffs": ["..."],
    "created_at": "...",
    "updated_at": "...",
    "product_name": "MacBook Pro 16\"",
    "product_category": "electronics"
  }
]
```

#### GET `/api/users/me/saved`

**Response (200):** Array of saved products with `saved_at`, `author_name`, `avg_rating`, `review_count`.

---

### Reviews (`/api/reviews`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/reviews/public` | No | Get latest 6 reviews (homepage feed) |
| GET | `/api/reviews?page=1&limit=10` | Yes | Get all reviews (paginated, with related data) |

#### GET `/api/reviews/public`

Returns the 6 most recent reviews. Each review includes:

**Response (200):**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "review_text": "...",
      "duration_used": "a few months",
      "build_integrity": 9,
      "longevity": 9,
      "value_ratio": 7,
      "recommendation": "buy",
      "goods": ["..."],
      "tradeoffs": ["..."],
      "created_at": "...",
      "updated_at": "...",
      "owner": {
        "id": "uuid",
        "name": "Jane Smith",
        "role": "Product Manager"
      },
      "product": {
        "id": "uuid",
        "name": "MacBook Pro 16\"",
        "description": "...",
        "image_url": "https://...",
        "category": "electronics",
        "avg_rating": 8.5,
        "review_count": 3
      },
      "more_reviews": [
        {
          "id": "uuid",
          "review_text": "...",
          "recommendation": "buy",
          "created_at": "...",
          "owner_name": "Alex Johnson"
        }
      ],
      "related_products": [
        {
          "id": "uuid",
          "name": "Sony WH-1000XM5",
          "image_url": "https://...",
          "category": "electronics",
          "avg_rating": 8.0,
          "review_count": 2
        }
      ]
    }
  ]
}
```

- `more_reviews`: Up to 3 other reviews for the same product
- `related_products`: Up to 5 products in the same category

#### GET `/api/reviews?page=1&limit=10` (Auth required)

Same response shape as public, but paginated with metadata:

```json
{
  "reviews": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 20,
    "totalPages": 2
  }
}
```

---

## Auth Middleware

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

JWT payload: `{ userId: "uuid" }`, expires in 7 days.

Middleware extracts `userId` and attaches it to `req.user.userId`.

---

## Request/Response Schemas Summary

### User Object
```typescript
{
  id: string;           // UUID
  name: string;
  email: string;
  role: string | null;
  created_at: string;   // ISO timestamp
}
```

### Product Object
```typescript
{
  id: string;           // UUID
  user_id: string;      // UUID (owner)
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  author_name: string;           // joined from users
  avg_rating: number;            // computed (1-10)
  review_count: number;          // computed
}
```

### Review Object
```typescript
{
  id: string;           // UUID
  user_id: string;      // UUID (reviewer)
  product_id: string;   // UUID
  duration_used: "a few days" | "a few weeks" | "a few months" | "a year" | "more than a year";
  review_text: string;
  build_integrity: number;   // 1-10
  longevity: number;         // 1-10
  value_ratio: number;       // 1-10
  recommendation: "buy" | "pass" | "consider";
  goods: string[];           // JSONB array
  tradeoffs: string[];       // JSONB array
  created_at: string;
  updated_at: string;
  // Joined fields (in list endpoints):
  reviewer_name?: string;
  reviewer_role?: string;
}
```

### Saved Item Object
```typescript
{
  id: string;           // UUID
  user_id: string;
  product_id: string;
  created_at: string;
  // Joined fields:
  saved_at: string;
  author_name: string;
  avg_rating: number;
  review_count: number;
}
```

---

## Seed Data

Run `npm run seed` to populate the database with:

- **5 users** (password: `pass123` for all)
  - john@test.com — Software Engineer
  - jane@test.com — Product Manager
  - alex@test.com — UX Designer
  - sarah@test.com — Data Scientist
  - mike@test.com — DevOps Engineer

- **10 products** (electronics, furniture, software)

- **20 reviews** with goods/tradeoffs arrays

---

## Rating Calculation

Average rating per product:
```
avg_rating = ROUND(AVG((build_integrity + longevity + value_ratio) / 3), 1)
```

Each review has 3 ratings (1-10): `build_integrity`, `longevity`, `value_ratio`. The product avg is the mean of all review averages.
