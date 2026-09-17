# Product Review API

A RESTful API for products and reviews with JWT authentication.

## Setup

```bash
npm install
npm run dev
```

Server runs on `http://localhost:3000`

---

## Auth Endpoints

### Register

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@example.com", "password": "password123", "role": "Software Engineer"}'
```

Response `201`:
```json
{
  "user": {
    "id": "uuid",
    "name": "John",
    "email": "john@example.com",
    "role": "Software Engineer",
    "created_at": "2026-09-05T..."
  },
  "token": "jwt_token_here"
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "password123"}'
```

Response `200`:
```json
{
  "user": {
    "id": "uuid",
    "name": "John",
    "email": "john@example.com",
    "role": "Software Engineer",
    "created_at": "2026-09-05T..."
  },
  "token": "jwt_token_here"
}
```

---

## User Profile Endpoints (Auth Required)

### Get My Profile

```bash
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update My Profile

```bash
curl -X PUT http://localhost:3000/api/users/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "John Doe", "role": "Product Manager"}'
```

### My Uploaded Products

```bash
curl http://localhost:3000/api/users/me/products \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### My Written Reviews

```bash
curl http://localhost:3000/api/users/me/reviews \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### My Saved Items

```bash
curl http://localhost:3000/api/users/me/saved \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Product Endpoints

### Search Products

```bash
curl "http://localhost:3000/api/products/search?q=laptop"
```

### List All Products

```bash
curl http://localhost:3000/api/products
```

Response `200`:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "MacBook Pro",
    "description": "Apple laptop",
    "image_url": "https://...",
    "category": "electronics",
    "created_at": "...",
    "updated_at": "...",
    "author_name": "John",
    "avg_rating": "7.5000000000000000",
    "review_count": "2"
  }
]
```

### Get Single Product

```bash
curl http://localhost:3000/api/products/PRODUCT_ID
```

### Create Product (Auth Required)

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "MacBook Pro", "description": "Apple laptop", "image_url": "https://...", "category": "electronics"}'
```

### Update Product (Auth Required, Owner Only)

```bash
curl -X PUT http://localhost:3000/api/products/PRODUCT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"description": "Updated description"}'
```

### Delete Product (Auth Required, Owner Only)

```bash
curl -X DELETE http://localhost:3000/api/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Review Endpoints

### Add Review (Auth Required)

```bash
curl -X POST http://localhost:3000/api/products/PRODUCT_ID/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "duration_used": "a few months",
    "review_text": "Great laptop for development. Battery life is impressive.",
    "build_integrity": 9,
    "longevity": 8,
    "value_ratio": 7,
    "recommendation": "buy",
    "goods": ["Excellent build quality", "Great battery life", "Fast performance"],
    "tradeoffs": ["Expensive", "Limited ports", "No touchscreen"]
  }'
```

Duration options: `a few days`, `a few weeks`, `a few months`, `a year`, `more than a year`

Recommendation options: `buy`, `pass`, `consider`

Rating fields: 1-10

### Get Reviews for Product

```bash
curl http://localhost:3000/api/products/PRODUCT_ID/reviews
```

Response `200`:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "product_id": "uuid",
    "duration_used": "a few months",
    "review_text": "Great laptop...",
    "build_integrity": 9,
    "longevity": 8,
    "value_ratio": 7,
    "recommendation": "buy",
    "goods": ["Excellent build quality", "Great battery life"],
    "tradeoffs": ["Expensive", "Limited ports"],
    "created_at": "...",
    "updated_at": "...",
    "reviewer_name": "John",
    "reviewer_role": "Software Engineer"
  }
]
```

### Update Review (Auth Required, Owner Only)

```bash
curl -X PUT http://localhost:3000/api/products/PRODUCT_ID/reviews/REVIEW_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"recommendation": "consider", "value_ratio": 8}'
```

### Delete Review (Auth Required, Owner Only)

```bash
curl -X DELETE http://localhost:3000/api/products/PRODUCT_ID/reviews/REVIEW_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Saved Items Endpoints (Auth Required)

### Save Product

```bash
curl -X POST http://localhost:3000/api/products/PRODUCT_ID/save \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Unsave Product

```bash
curl -X DELETE http://localhost:3000/api/products/PRODUCT_ID/save \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Health Check

```bash
curl http://localhost:3000/health
```

---

## Error Responses

| Status | Meaning |
|--------|---------|
| `400` | Missing or invalid fields |
| `401` | No token or invalid token |
| `403` | Not owner of resource |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, already reviewed, etc.) |
| `500` | Server error |

---

## Quick Test Flow

```bash
# 1. Register
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@example.com", "password": "password123", "role": "Developer"}' | jq -r '.token')

# 2. Create a product
PRODUCT_ID=$(curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "MacBook Pro", "description": "Apple laptop", "category": "electronics"}' | jq -r '.id')

# 3. Add a review
curl -X POST http://localhost:3000/api/products/$PRODUCT_ID/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "duration_used": "a few months",
    "review_text": "Great laptop for development.",
    "build_integrity": 9,
    "longevity": 8,
    "value_ratio": 7,
    "recommendation": "buy",
    "goods": ["Fast", "Great battery"],
    "tradeoffs": ["Expensive"]
  }'

# 4. Save the product
curl -X POST http://localhost:3000/api/products/$PRODUCT_ID/save \
  -H "Authorization: Bearer $TOKEN"

# 5. Get my profile with saved items
curl http://localhost:3000/api/users/me/saved \
  -H "Authorization: Bearer $TOKEN" | jq
```

> Requires `jq` installed. Install with `sudo apt install jq`.
