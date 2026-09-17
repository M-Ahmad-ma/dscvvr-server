#!/bin/bash

BASE_URL="http://localhost:3000"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

echo "=============================="
echo "  Product Review API Tests"
echo "=============================="
echo ""

# Cleanup: login with existing test users or register fresh
info "Logging in / registering test users..."

LOGIN1=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "john@test.com", "password": "pass123"}')
TOKEN1=$(echo "$LOGIN1" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN1" ]; then
  REG1=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name": "John Doe", "email": "john@test.com", "password": "pass123", "role": "Software Engineer"}')
  TOKEN1=$(echo "$REG1" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

LOGIN2=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@test.com", "password": "pass123"}')
TOKEN2=$(echo "$LOGIN2" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN2" ]; then
  REG2=$(curl -s -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"name": "Jane Smith", "email": "jane@test.com", "password": "pass123", "role": "Product Manager"}')
  TOKEN2=$(echo "$REG2" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
fi

# Get user IDs
USER1_ID=$(echo "$LOGIN1$REG1" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
USER2_ID=$(echo "$LOGIN2$REG2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Cleanup old products from previous runs
OLD_PRODUCTS=$(curl -s "$BASE_URL/api/users/me/products" \
  -H "Authorization: Bearer $TOKEN1" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
for pid in $OLD_PRODUCTS; do
  curl -s -X DELETE "$BASE_URL/api/products/$pid" \
    -H "Authorization: Bearer $TOKEN1" > /dev/null 2>&1
done

OLD_PRODUCTS2=$(curl -s "$BASE_URL/api/users/me/products" \
  -H "Authorization: Bearer $TOKEN2" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
for pid in $OLD_PRODUCTS2; do
  curl -s -X DELETE "$BASE_URL/api/products/$pid" \
    -H "Authorization: Bearer $TOKEN2" > /dev/null 2>&1
done

echo ""
pass "Test users ready"
echo ""

# 1. Health check
info "1. Health check"
HEALTH=$(curl -s "$BASE_URL/health")
if echo "$HEALTH" | grep -q '"ok"'; then
  pass "Server is running"
else
  fail "Server is not running. Start it with: npm run dev"
  exit 1
fi

# 2. Register user 1
info "2. Register user 1 (John)"
REG_CHECK=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@test.com", "password": "pass123", "role": "Software Engineer"}')
if echo "$REG_CHECK" | grep -q "already exists"; then
  pass "User 1 already exists (using login token)"
else
  pass "User 1 registered"
fi

# 3. Register user 2
info "3. Register user 2 (Jane)"
REG_CHECK2=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Smith", "email": "jane@test.com", "password": "pass123", "role": "Product Manager"}')
if echo "$REG_CHECK2" | grep -q "already exists"; then
  pass "User 2 already exists (using login token)"
else
  pass "User 2 registered"
fi

# 4. Login user 1
info "4. Login user 1"
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "john@test.com", "password": "pass123"}')
LOGIN_TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$LOGIN_TOKEN" ]; then
  pass "User 1 logged in"
else
  fail "Login failed"
  echo "$LOGIN"
fi

# 5. Duplicate email
info "5. Register with duplicate email"
DUP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bad User", "email": "john@test.com", "password": "pass123"}')
if echo "$DUP" | grep -q "already exists"; then
  pass "Duplicate email rejected"
else
  fail "Duplicate email should be rejected"
fi

# 6. Get profile
info "6. Get profile"
PROFILE=$(curl -s "$BASE_URL/api/users/me" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$PROFILE" | grep -q "John Doe"; then
  pass "Got profile"
else
  fail "Get profile failed"
fi

# 7. Update profile
info "7. Update profile"
UPDATED=$(curl -s -X PUT "$BASE_URL/api/users/me" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{"role": "Senior Engineer"}')
if echo "$UPDATED" | grep -q "Senior Engineer"; then
  pass "Profile updated"
else
  fail "Update profile failed"
fi

# 8. Create product
info "8. Create product (MacBook Pro)"
PRODUCT=$(curl -s -X POST "$BASE_URL/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{"name": "MacBook Pro", "description": "Apple laptop for developers", "category": "electronics", "image_url": "https://example.com/macbook.jpg"}')
PRODUCT_ID=$(echo "$PRODUCT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PRODUCT_ID" ]; then
  pass "Product created (id: $PRODUCT_ID)"
else
  fail "Create product failed"
  echo "$PRODUCT"
fi

# 9. Create second product
info "9. Create product (AirPods)"
PRODUCT2=$(curl -s -X POST "$BASE_URL/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{"name": "AirPods Pro", "description": "Wireless earbuds", "category": "electronics"}')
PRODUCT2_ID=$(echo "$PRODUCT2" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PRODUCT2_ID" ]; then
  pass "Product 2 created (id: $PRODUCT2_ID)"
else
  fail "Create product 2 failed"
fi

# 10. Search products
info "10. Search products"
SEARCH=$(curl -s "$BASE_URL/api/products/search?q=MacBook")
if echo "$SEARCH" | grep -q "MacBook"; then
  pass "Search works"
else
  fail "Search failed"
fi

# 11. List all products
info "11. List all products"
PRODUCTS=$(curl -s "$BASE_URL/api/products")
if echo "$PRODUCTS" | grep -q "MacBook"; then
  pass "Listed products"
else
  fail "List products failed"
fi

# 12. Get single product
info "12. Get single product"
SINGLE=$(curl -s "$BASE_URL/api/products/$PRODUCT_ID")
if echo "$SINGLE" | grep -q "MacBook"; then
  pass "Got single product"
else
  fail "Get product failed"
fi

# 13. Update product (owner)
info "13. Update product (owner)"
UPDATED_PROD=$(curl -s -X PUT "$BASE_URL/api/products/$PRODUCT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{"description": "Updated description for MacBook Pro"}')
if echo "$UPDATED_PROD" | grep -q "Updated description"; then
  pass "Product updated by owner"
else
  fail "Update product failed"
fi

# 14. Update product (non-owner)
info "14. Update product (non-owner - should fail)"
NOT_OWNER=$(curl -s -X PUT "$BASE_URL/api/products/$PRODUCT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{"description": "Hacked!"}')
if echo "$NOT_OWNER" | grep -q "only update"; then
  pass "Non-owner update rejected"
else
  fail "Non-owner should be rejected"
fi

# 15. Add review (user 2 reviews user 1's product)
info "15. Add review"
REVIEW=$(curl -s -X POST "$BASE_URL/api/products/$PRODUCT_ID/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{
    "duration_used": "a few months",
    "review_text": "Excellent laptop for software development. Battery life is impressive and the build quality is top notch.",
    "build_integrity": 9,
    "longevity": 8,
    "value_ratio": 7,
    "recommendation": "buy",
    "goods": ["Fast performance", "Great battery", "Excellent build quality"],
    "tradeoffs": ["Expensive", "Limited ports"]
  }')
REVIEW_ID=$(echo "$REVIEW" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$REVIEW_ID" ]; then
  pass "Review added (id: $REVIEW_ID)"
else
  fail "Add review failed"
  echo "$REVIEW"
fi

# 16. Duplicate review (same user, same product)
info "16. Duplicate review (should fail)"
DUP_REVIEW=$(curl -s -X POST "$BASE_URL/api/products/$PRODUCT_ID/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{"duration_used": "a year", "review_text": "Still good", "build_integrity": 8, "longevity": 8, "value_ratio": 8, "recommendation": "buy"}')
if echo "$DUP_REVIEW" | grep -q "already reviewed"; then
  pass "Duplicate review rejected"
else
  fail "Duplicate review should be rejected"
fi

# 17. Add review with invalid rating
info "17. Invalid rating (should fail)"
BAD_RATING=$(curl -s -X POST "$BASE_URL/api/products/$PRODUCT_ID/reviews" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{"duration_used": "a few days", "review_text": "Bad", "build_integrity": 15, "longevity": 8, "value_ratio": 8, "recommendation": "buy"}')
if echo "$BAD_RATING" | grep -q "between 1 and 10"; then
  pass "Invalid rating rejected"
else
  fail "Invalid rating should be rejected"
fi

# 18. Get reviews for product
info "18. Get reviews"
REVIEWS=$(curl -s "$BASE_URL/api/products/$PRODUCT_ID/reviews")
if echo "$REVIEWS" | grep -q "Excellent laptop"; then
  pass "Got reviews"
else
  fail "Get reviews failed"
fi

# 19. Update review (owner)
info "19. Update review (owner)"
UPDATED_REVIEW=$(curl -s -X PUT "$BASE_URL/api/products/$PRODUCT_ID/reviews/$REVIEW_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{"recommendation": "consider", "value_ratio": 8}')
if echo "$UPDATED_REVIEW" | grep -q "consider"; then
  pass "Review updated by owner"
else
  fail "Update review failed"
fi

# 20. Update review (non-owner)
info "20. Update review (non-owner - should fail)"
NOT_OWNER_REVIEW=$(curl -s -X PUT "$BASE_URL/api/products/$PRODUCT_ID/reviews/$REVIEW_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN1" \
  -d '{"review_text": "Hacked!"}')
if echo "$NOT_OWNER_REVIEW" | grep -q "only update"; then
  pass "Non-owner review update rejected"
else
  fail "Non-owner should be rejected"
fi

# 21. Save product
info "21. Save product"
SAVE=$(curl -s -X POST "$BASE_URL/api/products/$PRODUCT_ID/save" \
  -H "Authorization: Bearer $TOKEN2")
if echo "$SAVE" | grep -q "saved"; then
  pass "Product saved"
else
  fail "Save product failed"
fi

# 22. Duplicate save
info "22. Duplicate save (should fail)"
DUP_SAVE=$(curl -s -X POST "$BASE_URL/api/products/$PRODUCT_ID/save" \
  -H "Authorization: Bearer $TOKEN2")
if echo "$DUP_SAVE" | grep -q "already saved"; then
  pass "Duplicate save rejected"
else
  fail "Duplicate save should be rejected"
fi

# 23. Get saved items
info "23. Get saved items"
SAVED=$(curl -s "$BASE_URL/api/users/me/saved" \
  -H "Authorization: Bearer $TOKEN2")
if echo "$SAVED" | grep -q "MacBook"; then
  pass "Got saved items"
else
  fail "Get saved items failed"
fi

# 24. Get my reviews
info "24. Get my reviews"
MY_REVIEWS=$(curl -s "$BASE_URL/api/users/me/reviews" \
  -H "Authorization: Bearer $TOKEN2")
if echo "$MY_REVIEWS" | grep -q "Excellent laptop"; then
  pass "Got my reviews"
else
  fail "Get my reviews failed"
fi

# 25. Get my products
info "25. Get my products"
MY_PRODUCTS=$(curl -s "$BASE_URL/api/users/me/products" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$MY_PRODUCTS" | grep -q "MacBook"; then
  pass "Got my products"
else
  fail "Get my products failed"
fi

# 26. Unsave product
info "26. Unsave product"
UNSAVE=$(curl -s -X DELETE "$BASE_URL/api/products/$PRODUCT_ID/save" \
  -H "Authorization: Bearer $TOKEN2")
if echo "$UNSAVE" | grep -q "unsaved"; then
  pass "Product unsaved"
else
  fail "Unsave product failed"
fi

# 27. Delete review (owner)
info "27. Delete review (owner)"
DEL_REVIEW=$(curl -s -X DELETE "$BASE_URL/api/products/$PRODUCT_ID/reviews/$REVIEW_ID" \
  -H "Authorization: Bearer $TOKEN2")
if echo "$DEL_REVIEW" | grep -q "deleted"; then
  pass "Review deleted"
else
  fail "Delete review failed"
fi

# 28. Delete product (owner)
info "28. Delete product (owner)"
DEL_PROD=$(curl -s -X DELETE "$BASE_URL/api/products/$PRODUCT_ID" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$DEL_PROD" | grep -q "deleted"; then
  pass "Product deleted"
else
  fail "Delete product failed"
fi

# 29. Get deleted product (should 404)
info "29. Get deleted product (should 404)"
NOT_FOUND=$(curl -s "$BASE_URL/api/products/$PRODUCT_ID")
if echo "$NOT_FOUND" | grep -qi "not found"; then
  pass "Deleted product returns 404"
else
  fail "Should return 404"
fi

# 30. Delete product (non-owner)
info "30. Delete product (non-owner - should fail)"
NOT_OWNER_DEL=$(curl -s -X DELETE "$BASE_URL/api/products/$PRODUCT2_ID" \
  -H "Authorization: Bearer $TOKEN1")
if echo "$NOT_OWNER_DEL" | grep -q "only delete"; then
  pass "Non-owner delete rejected"
else
  fail "Non-owner should be rejected"
fi

# 31. Unauthorized access
info "31. Unauthorized access (no token)"
UNAUTH=$(curl -s -X POST "$BASE_URL/api/products" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}')
if echo "$UNAUTH" | grep -q "token"; then
  pass "Unauthorized access blocked"
else
  fail "Should require token"
fi

# 32. Invalid token
info "32. Invalid token"
BAD_TOKEN=$(curl -s -X POST "$BASE_URL/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalidtoken123" \
  -d '{"name": "Test"}')
if echo "$BAD_TOKEN" | grep -q "Invalid"; then
  pass "Invalid token rejected"
else
  fail "Should reject invalid token"
fi

echo ""
echo "=============================="
echo "  All tests completed!"
echo "=============================="
