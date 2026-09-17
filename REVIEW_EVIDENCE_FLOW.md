# Review Evidence System — How It Works

## The Complete Flow

### Step 1: Product Already Exists

A product was created earlier by any user. Example:

```
Product: "Sony WH-1000XM6"
Category: "Headphones"
```

No special fields needed. Just name and category.

---

### Step 2: User Writes a Review

A user selects the product and writes a review with ratings:

```
POST /api/products/:productId/reviews
{
  "duration_used": "a few months",
  "review_text": "Great headphones, worth the price",
  "build_integrity": 9,
  "longevity": 8,
  "value_ratio": 8,
  "recommendation": "buy",
  "goods": ["Noise cancellation", "Comfort"],
  "tradeoffs": ["Expensive"]
}
```

Review is saved. No evidence yet. The review shows:

```json
{
  "verification": {
    "score": null,
    "status": null,
    "hasEvidence": false
  }
}
```

---

### Step 3: User Uploads Receipt (Evidence)

Now the user uploads a receipt image as proof of purchase:

```
POST /api/products/:productId/reviews/:reviewId/evidence
Content-Type: multipart/form-data
file: receipt.jpg
```

This triggers the full pipeline.

---

## What Happens During Upload

### 3a. File Validation

- Check file type (JPEG, PNG, WEBP, AVIF, PDF only)
- Check file size (max 10MB)
- Reject invalid files immediately

### 3b. OCR Extraction

The existing OCR engine (Tesseract.js) processes the image:

```
Receipt Image → Sharp (convert to PNG) → Tesseract → Raw Text
```

Example OCR output:
```
CASH RECEIPT
Shop Name Shop Address
Date: 08/20/2026

Sony WH-1000XM6       $89,999

Total                 $89,999
Order #12345
```

### 3c. Receipt Parsing

The parser extracts structured data from raw OCR text:

```json
{
  "documentType": "receipt",
  "merchant": { "name": "Shop Name", "address": "Shop Address" },
  "purchaseDate": "2026-08-20",
  "items": [{ "name": "Sony WH-1000XM6", "price": 89999, "quantity": 1 }],
  "subtotal": null,
  "tax": null,
  "total": 89999,
  "orderNumber": "12345",
  "transactionNumber": null
}
```

The parser is defensive. Bad OCR like `Date: MM/DDAYYY.` returns null dates, not crashes.

### 3d. Receipt Validation

Checks the receipt's internal consistency:

| Check | What It Does | Signal |
|-------|-------------|--------|
| Merchant detected | Is there a merchant name? | `MERCHANT_DETECTED` |
| Date valid | Is date parseable and not future? | `DATE_VALID` or `DATE_FUTURE` |
| Items present | Are there line items? | `ITEMS_PRESENT` |
| Total present | Is there a total amount? | `TOTAL_PRESENT` |
| Totals consistent | Does subtotal + tax ≈ total? | `SUBTOTAL_MISMATCH`, `TOTAL_MISMATCH` |
| Structure valid | Does it look like a receipt overall? | `RECEIPT_STRUCTURE` |

### 3e. Product Matching

Compares receipt items against the product name:

```
Product: "Sony WH-1000XM6"
Receipt item: "Sony WH-1000XM6"

Normalized product: "sonywh1000xm6"
Normalized item:    "sonywh1000xm6"

→ STRONG MATCH (100% score)
```

Also supports:
- **Partial match**: "Sony Wireless Headphones XM6" → partial match
- **Word match**: "Sony WH 1000 XM6" → word overlap match
- **No match**: "Samsung Galaxy Buds" → no match

### 3f. Duplicate Detection

Three checks to prevent receipt reuse:

1. **Fingerprint** — SHA-256 hash of normalized receipt data (merchant + date + items + total + order/txn numbers). Same receipt = same hash.

2. **Order number** — If receipt has `Order #12345`, check if any other evidence already used that order number.

3. **Transaction number** — Same check for transaction numbers.

If duplicate found → strong negative signal.

### 3g. Reviewer Trust Signals

Checks the reviewer's behavior:

| Signal | What It Checks | Result |
|--------|---------------|--------|
| Account age | Is account older than 30 days? | `ACCOUNT_AGE` |
| Review frequency | More than 5 reviews in 5 minutes? | `REVIEW_FREQUENCY` |
| Verification history | Were previous receipts suspicious? | `VERIFICATION_HISTORY` |

### 3h. Evidence Scoring

All signals combine into a deterministic score:

**Positive signals:**

| Signal | Points |
|--------|--------|
| Product matched | +25 |
| Valid purchase date | +10 |
| Price within range | +10 |
| Merchant detected | +5 |
| Order number present | +10 |
| Transaction number present | +5 |
| Receipt structure valid | +5 |
| Unique receipt | +10 |
| Established account | +5 |
| Normal review behavior | +5 |

**Negative signals:**

| Signal | Points |
|--------|--------|
| Duplicate order number | -30 |
| Duplicate transaction number | -30 |
| Invalid/future date | -20 |
| Price anomaly | -15 |
| Suspicious review behavior | -20 |
| Document inconsistency | -25 |

**Score calculation:**
```
Total = sum of all matched signal points
Clamped between 0 and 100
```

**Status thresholds:**

| Score Range | Status |
|------------|--------|
| 80–100 | `STRONG_EVIDENCE` |
| 60–79 | `GOOD_EVIDENCE` |
| 40–59 | `WEAK_EVIDENCE` |
| 0–39 | `SUSPICIOUS` |

### 3i. Save and Update

Evidence is saved to the `evidence` table. The review gets updated:

```json
{
  "verification": {
    "score": 85,
    "status": "STRONG_EVIDENCE",
    "hasEvidence": true
  }
}
```

---

## Example: Perfect Receipt

OCR text:
```
CASH RECEIPT
Best Buy
Date: 08/20/2026
Sony WH-1000XM6       $89,999
Total                 $89,999
Order #BB-2026-78901
```

Scoring breakdown:
```
PRODUCT_MATCH        +25   (receipt has "Sony WH-1000XM6")
VALID_DATE           +10   (date is valid, not future)
MERCHANT_DETECTED     +5   ("Best Buy" found)
ORDER_NUMBER         +10   ("BB-2026-78901" found)
RECEIPT_STRUCTURE     +5   (has merchant, date, items, total)
UNIQUE_RECEIPT       +10   (fingerprint not seen before)
ACCOUNT_AGE          +5    (account is old enough)
REVIEW_BEHAVIOR      +5    (normal frequency)

Total: 75
Status: GOOD_EVIDENCE
```

---

## Example: Suspicious Receipt

OCR text:
```
Date: MM/DDAYYY.
Loremipsum $925
Total $87.90
Tax 5000
```

Scoring breakdown:
```
DATE_INVALID         -20   (date unparseable)
TOTAL_MISMATCH       warn  (tax 5000 vs total 87.90)
RECEIPT_STRUCTURE    warn  (very incomplete)

No positive signals match.

Total: ~15-25 (depending on other factors)
Status: SUSPICIOUS
```

---

## Example: Duplicate Receipt

User tries to upload the same receipt for a second review:

```
DUPLICATE_FINGERPRINT  -30   (same receipt submitted before)

Total: drops significantly
Status: SUSPICIOUS
```

---

## Two Levels of Evidence

### Product-Level Evidence

Created by the product creator:
```
POST /api/products/:productId/evidence
```

Shows on the product page:
```json
{
  "verification": {
    "score": 82,
    "status": "STRONG_EVIDENCE",
    "hasEvidence": true
  }
}
```

### Review-Level Evidence

Created by community reviewers:
```
POST /api/products/:productId/reviews/:reviewId/evidence
```

Shows on the review:
```json
{
  "verification": {
    "score": 78,
    "status": "GOOD_EVIDENCE",
    "hasEvidence": true
  }
}
```

**Duplicate detection works across both levels** — same receipt can't be used for product evidence AND review evidence.

---

## Important Notes

1. **Evidence score ≠ purchase proof.** It measures how strong the evidence is, not whether the purchase definitely happened.

2. **No AI/ML used.** All scoring is deterministic rules.

3. **No merchant APIs.** The system cannot independently verify with Amazon, Shopify, etc.

4. **Bad OCR doesn't crash the system.** Malformed receipts get low scores, not server errors.

5. **All scoring is server-side.** The frontend never sends scores — the backend calculates everything.

6. **Scoring is configurable.** Weights and thresholds live in `src/services/verificationConfig.js`.
