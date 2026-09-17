# Backend Task: Complete the Automated Review Evidence System

## Context

This project is a **product review platform**.

The platform only contains **physical/digital products** and reviews about those products.

Do NOT introduce support for doctors, restaurants, services, appointments, bookings, businesses, or generic experience evidence.

Users can:

* Create products
* Write reviews for products
* Upload purchase receipts as evidence for their reviews
* Save products
* View reviews written by other users

The backend already has an OCR + receipt parsing + validation + product matching + duplicate detection + deterministic evidence scoring pipeline.

Review the existing implementation before changing anything. Reuse existing services, models, utilities, controllers, routes, and configuration wherever possible.

Do NOT rewrite working parts of the system unnecessarily.

---

# Existing Evidence Pipeline

The current flow is approximately:

```text
Review
  ↓
Receipt Upload
  ↓
File Validation
  ↓
OCR
  ↓
Receipt Parser
  ↓
Receipt Validation
  ↓
Product Matching
  ↓
Duplicate Detection
  ↓
Reviewer Behavior Signals
  ↓
Evidence Score
  ↓
Evidence Status
  ↓
Save Evidence
```

Existing evidence scoring has:

### Positive signals

```text
Product matched       +25
Valid purchase date   +10
Price within range    +10
Merchant detected      +5
Order number present  +10
Transaction number     +5
Receipt structure      +5
Unique receipt        +10
Established account    +5
Normal behavior        +5
```

### Negative signals

```text
Duplicate order       -30
Duplicate transaction -30
Invalid/future date   -20
Price anomaly         -15
Suspicious behavior   -20
Document inconsistency -25
```

Scores are currently clamped to:

```text
0-100
```

Current thresholds:

```text
80-100 = STRONG_EVIDENCE
60-79  = GOOD_EVIDENCE
40-59  = WEAK_EVIDENCE
0-39   = SUSPICIOUS
```

Keep these existing scoring rules/configuration unless there is a concrete implementation bug.

---

# Main Architectural Requirement

Separate these concepts.

## 1. Review status

This describes the lifecycle of the review itself.

Example:

```text
PUBLISHED
REMOVED
```

For this MVP, reviews should normally remain `PUBLISHED`.

Evidence quality must NOT automatically mean the review is fake.

---

## 2. Evidence status

This describes the quality of the uploaded purchase evidence.

Use:

```text
NO_EVIDENCE
STRONG_EVIDENCE
GOOD_EVIDENCE
WEAK_EVIDENCE
SUSPICIOUS
```

Important:

```text
NO_EVIDENCE != SUSPICIOUS
```

A user who does not upload a receipt has simply provided no purchase evidence.

---

## 3. Internal risk flags

Add a separate internal concept for dangerous or abusive patterns.

Examples:

```text
DUPLICATE_FINGERPRINT
DUPLICATE_ORDER_NUMBER
DUPLICATE_TRANSACTION_NUMBER
INVALID_DATE
FUTURE_DATE
PRICE_ANOMALY
DOCUMENT_INCONSISTENCY
HIGH_REVIEW_FREQUENCY
REPEATED_SUSPICIOUS_EVIDENCE
```

These flags are for backend decision-making and analytics.

Do NOT expose raw internal risk scores to normal users.

---

# Important Rule

Do NOT interpret:

```text
SUSPICIOUS
```

as:

```text
FAKE REVIEW
```

The system cannot prove that a review is fake.

It can only determine that the submitted purchase evidence was not sufficiently validated.

Therefore:

```text
SUSPICIOUS evidence
        ↓
review remains published
        ↓
no purchase-evidence badge
```

unless a separate hard-abuse rule is triggered.

---

# 1. Review Database Changes

Inspect the current Review model/schema.

Make sure every review can represent:

```js
{
  status: "PUBLISHED",

  verification: {
    hasEvidence: false,
    score: null,
    status: "NO_EVIDENCE"
  }
}
```

When a review has accepted/validated evidence:

```js
{
  status: "PUBLISHED",

  verification: {
    hasEvidence: true,
    score: 78,
    status: "GOOD_EVIDENCE"
  }
}
```

When evidence is suspicious:

```js
{
  status: "PUBLISHED",

  verification: {
    hasEvidence: true,
    score: 22,
    status: "SUSPICIOUS"
  }
}
```

Do not delete or hide the review just because evidence is suspicious.

Use the existing schema conventions of the project rather than blindly copying this exact structure if the project uses a relational/SQL schema.

---

# 2. Evidence Model Improvements

Inspect the existing Evidence model.

Ensure each evidence record stores enough information to explain and audit the automated decision later.

At minimum, support fields conceptually equivalent to:

```text
id
reviewId
productId
userId

file information
OCR information
parsed receipt information

score
status

signals
riskFlags

fingerprint
orderNumber
transactionNumber

createdAt
updatedAt
```

For example:

```js
signals: [
  "PRODUCT_MATCH",
  "DATE_VALID",
  "MERCHANT_DETECTED",
  "ORDER_NUMBER",
  "RECEIPT_STRUCTURE",
  "UNIQUE_RECEIPT"
]
```

And:

```js
riskFlags: [
  "PRICE_ANOMALY"
]
```

Use the project's existing database conventions.

Do not expose sensitive OCR/file information through normal public review endpoints.

---

# 3. Store Score Breakdown Internally

The backend should preserve which scoring signals contributed to the result.

Example:

```json
{
  "score": 75,
  "status": "GOOD_EVIDENCE",
  "signals": [
    {
      "code": "PRODUCT_MATCH",
      "points": 25
    },
    {
      "code": "DATE_VALID",
      "points": 10
    },
    {
      "code": "MERCHANT_DETECTED",
      "points": 5
    },
    {
      "code": "ORDER_NUMBER",
      "points": 10
    },
    {
      "code": "RECEIPT_STRUCTURE",
      "points": 5
    },
    {
      "code": "UNIQUE_RECEIPT",
      "points": 10
    },
    {
      "code": "ACCOUNT_AGE",
      "points": 5
    },
    {
      "code": "REVIEW_BEHAVIOR",
      "points": 5
    }
  ]
}
```

The exact score breakdown can remain private/internal.

This will make debugging and future improvements much easier.

---

# 4. Separate Evidence Quality From Risk

Do not use the score as the only representation of suspicious behavior.

The conceptual model should be:

```text
Evidence quality
        +
Risk flags
        ↓
Final evidence status
```

For example:

```text
Score = 78
Risk flags = []
Status = GOOD_EVIDENCE
```

Another example:

```text
Score = 65
Risk flags = [
  DUPLICATE_ORDER_NUMBER
]
Status = SUSPICIOUS
```

A duplicate order number should be treated as a much stronger signal than an ordinary OCR inconsistency.

Do not simply rely on the final numerical score for abuse detection.

---

# 5. Add Hard Abuse Rules

Create a small deterministic rule layer after scoring.

For example:

```text
IF same order number is already attached to another user's evidence
    → hard risk flag

IF same transaction number is already attached to another user's evidence
    → hard risk flag

IF same receipt fingerprint is already attached to another review/user
    → hard risk flag
```

These are stronger than ordinary scoring signals.

The final evidence can therefore be:

```text
qualityScore = normal scoring system

riskFlags = hard abuse/risk detection

finalStatus = determineEvidenceStatus(
  qualityScore,
  riskFlags
)
```

Do not automatically remove the review.

Instead:

```text
Hard abuse detected
        ↓
Evidence status = SUSPICIOUS
        ↓
Review remains PUBLISHED
        ↓
No public evidence badge
```

Only reject the evidence submission itself when the existing architecture requires rejection, for example a technically invalid file.

---

# 6. Verification History

Add persistent verification history.

The purpose is to detect repeated suspicious behavior from the same user over time.

Create a model/table if one does not already exist.

Conceptually:

```text
verification_history

id
userId
reviewId
evidenceId

score
status

riskFlags

createdAt
```

Example:

```json
{
  "userId": "123",
  "reviewId": "456",
  "evidenceId": "789",
  "score": 18,
  "status": "SUSPICIOUS",
  "riskFlags": [
    "DUPLICATE_ORDER_NUMBER"
  ]
}
```

Every evidence evaluation should create a history record.

Do not overwrite the historical result when a user submits another piece of evidence.

This allows future rules such as:

```text
user has repeatedly submitted suspicious evidence
```

without needing to reconstruct old decisions.

---

# 7. Improve Suspicious Behavior Detection

Keep this deterministic.

Do NOT add AI/ML.

Do NOT add external merchant APIs.

Add internal signals such as:

```text
REVIEW_FREQUENCY
EVIDENCE_FREQUENCY
REPEATED_SUSPICIOUS_EVIDENCE
DUPLICATE_EVIDENCE
```

Example rules:

```text
More than 5 reviews within 5 minutes
    → HIGH_REVIEW_FREQUENCY

Multiple suspicious evidence submissions in a short period
    → REPEATED_SUSPICIOUS_EVIDENCE

Same order number used by different users
    → DUPLICATE_ORDER_NUMBER

Same transaction number used by different users
    → DUPLICATE_TRANSACTION_NUMBER

Same receipt fingerprint used multiple times
    → DUPLICATE_FINGERPRINT
```

Keep these thresholds configurable.

Create/update:

```text
src/services/verificationConfig.js
```

or the project's equivalent configuration file.

Do not scatter magic numbers throughout controllers/services.

---

# 8. Important Duplicate Detection Rule

Duplicate detection must distinguish between:

### Same user updating/replacing their own evidence

and:

### Same receipt being reused across different reviews/users

The second case is much more suspicious.

Prefer logic such as:

```text
same fingerprint + same review
    → existing evidence/update case

same fingerprint + different review
    → duplicate evidence

same order number + different user
    → high-risk duplicate

same transaction number + different user
    → high-risk duplicate
```

Do not accidentally flag legitimate internal reprocessing of the same evidence.

---

# 9. Product-Level Evidence

The project currently supports product-level evidence as well as review-level evidence.

Keep this functionality if it already exists.

However, clearly separate:

```text
PRODUCT EVIDENCE
```

from:

```text
REVIEW EVIDENCE
```

Product evidence means:

> There is purchase evidence associated with this product.

It does NOT mean:

> Every review of this product is verified.

Example:

```text
Sony WH-1000XM6

Product evidence: available

Review A
✓ Purchase evidence

Review B
No evidence

Review C
No evidence
```

Do not automatically give every review a verification badge because product-level evidence exists.

---

# 10. Review-Level Public Response

The normal public review API must NOT expose:

```text
raw score
risk flags
internal scoring weights
behavior risk
OCR confidence
internal fraud signals
```

Instead return a clean public verification representation.

For example:

```json
{
  "id": "review-id",
  "rating": 5,
  "reviewText": "Great headphones...",
  "durationUsed": "a few months",
  "recommendation": "buy",

  "verification": {
    "status": "GOOD_EVIDENCE",
    "hasEvidence": true,
    "badge": "PURCHASE_EVIDENCE"
  }
}
```

For strong evidence:

```json
{
  "verification": {
    "status": "STRONG_EVIDENCE",
    "hasEvidence": true,
    "badge": "PURCHASE_EVIDENCE"
  }
}
```

For weak evidence:

```json
{
  "verification": {
    "status": "WEAK_EVIDENCE",
    "hasEvidence": true,
    "badge": null
  }
}
```

For suspicious evidence:

```json
{
  "verification": {
    "status": "SUSPICIOUS",
    "hasEvidence": true,
    "badge": null
  }
}
```

For no evidence:

```json
{
  "verification": {
    "status": "NO_EVIDENCE",
    "hasEvidence": false,
    "badge": null
  }
}
```

---

# 11. Public Badge Rules

The frontend should only need one positive public badge:

```text
✓ Purchase evidence
```

Show it when:

```text
STRONG_EVIDENCE
GOOD_EVIDENCE
```

Do NOT show it for:

```text
WEAK_EVIDENCE
SUSPICIOUS
NO_EVIDENCE
```

Do not expose:

```text
75/100
GOOD_EVIDENCE
SUSPICIOUS
Fake
Trust score: 31
```

on the review card.

The user-facing concept should be simple.

---

# 12. Add an Evidence Details API

If there is already an evidence details endpoint, update it.

Otherwise create something equivalent to:

```http
GET /api/products/:productId/reviews/:reviewId/evidence
```

The authenticated review owner can receive more detailed information.

For a good/strong evidence result:

```json
{
  "status": "GOOD_EVIDENCE",
  "badge": "PURCHASE_EVIDENCE",
  "checks": [
    {
      "code": "PRODUCT_MATCH",
      "label": "Product matched",
      "passed": true
    },
    {
      "code": "DATE_VALID",
      "label": "Purchase date detected",
      "passed": true
    },
    {
      "code": "PRICE_VALID",
      "label": "Price appears reasonable",
      "passed": true
    },
    {
      "code": "MERCHANT_DETECTED",
      "label": "Merchant detected",
      "passed": true
    },
    {
      "code": "RECEIPT_STRUCTURE",
      "label": "Receipt structure is consistent",
      "passed": true
    },
    {
      "code": "UNIQUE_RECEIPT",
      "label": "Evidence has not been previously submitted",
      "passed": true
    }
  ],

  "disclaimer": "Purchase evidence does not independently confirm the transaction with the merchant."
}
```

For suspicious evidence:

```json
{
  "status": "SUSPICIOUS",
  "badge": null,

  "checks": [
    {
      "code": "PRODUCT_MATCH",
      "label": "Product matched",
      "passed": false
    },
    {
      "code": "DATE_VALID",
      "label": "Purchase date detected",
      "passed": false
    },
    {
      "code": "RECEIPT_STRUCTURE",
      "label": "Receipt structure is consistent",
      "passed": false
    }
  ],

  "message": "We couldn't sufficiently validate the submitted purchase evidence."
}
```

Do not expose internal fraud/risk terminology to ordinary users.

---

# 13. Evidence Status Mapping

Create one centralized function/service for this.

Something conceptually like:

```js
getPublicEvidenceState(evidence)
```

Rules:

```text
STRONG_EVIDENCE
    → hasEvidence: true
    → badge: PURCHASE_EVIDENCE

GOOD_EVIDENCE
    → hasEvidence: true
    → badge: PURCHASE_EVIDENCE

WEAK_EVIDENCE
    → hasEvidence: true
    → badge: null

SUSPICIOUS
    → hasEvidence: true
    → badge: null

NO_EVIDENCE
    → hasEvidence: false
    → badge: null
```

Do not duplicate this logic across controllers.

---

# 14. Evidence Does Not Equal Purchase Proof

Preserve this distinction throughout the backend.

The system evaluates:

```text
How well does the submitted receipt match
the expected product and internal consistency rules?
```

It cannot independently prove:

```text
The merchant actually processed this transaction.
```

because there are no merchant APIs.

Therefore do not use backend fields such as:

```text
purchaseVerified = true
```

unless the project has an actual independent verification source.

Prefer:

```text
evidenceStatus
purchaseEvidence
evidenceScore
```

---

# 15. OCR Confidence

Keep OCR confidence separate from evidence score.

For example:

```json
{
  "ocr": {
    "confidence": 75
  },

  "verification": {
    "score": 82,
    "status": "STRONG_EVIDENCE"
  }
}
```

Do not add OCR confidence directly to the public review response.

OCR confidence answers:

> How confidently did OCR extract the text?

Evidence score answers:

> How well does the extracted receipt support the product review?

These are different concepts.

---

# 16. Error Handling

The evidence pipeline must never crash because OCR/parsing failed.

Examples:

```text
Invalid date
→ date = null
→ DATE_INVALID signal

Missing merchant
→ merchant = null
→ MERCHANT_MISSING signal

Missing total
→ total = null
→ TOTAL_MISSING signal

Malformed OCR
→ parser returns partial/null fields
→ scoring continues
```

Only technically invalid uploads should fail immediately:

```text
unsupported file type
file too large
corrupt/unreadable file
```

Keep existing limits:

```text
JPEG
PNG
WEBP
AVIF
PDF

Maximum 10MB
```

---

# 17. Transaction Safety

Review the evidence upload flow for database consistency.

The following should not result in a partially saved verification:

```text
Evidence saved
but review verification update failed
```

or:

```text
Review updated
but evidence record failed
```

Use the project's transaction mechanism where appropriate.

The final operation should leave the database in a consistent state:

```text
Evidence
+
Verification result
+
Verification history
+
Review verification state
```

should agree with each other.

---

# 18. Idempotency / Reprocessing

Inspect whether uploading/reprocessing the same evidence can accidentally create duplicate database records.

If the project already supports evidence replacement/reprocessing, preserve that behavior.

Ensure repeated processing of the same file does not create misleading duplicate history unless it represents a genuinely new submission.

The fingerprint should be deterministic.

---

# 19. Authorization

Verify:

### Creating a review

Only authenticated users can create reviews.

### Uploading review evidence

Only the review owner should be able to attach purchase evidence to that review.

### Viewing public review

Public users can see:

```text
review
public verification badge
```

but not internal evidence information.

### Viewing detailed evidence

Only expose sensitive evidence details to the appropriate authenticated user according to the existing authorization model.

Do not expose receipt OCR text, internal scores, or risk flags publicly.

---

# 20. API Compatibility

Do not unnecessarily break existing API response structures.

If the existing response has:

```json
verification: {
  score,
  status,
  hasEvidence
}
```

maintain backward compatibility where practical.

However, new public endpoints should avoid exposing internal fields.

If changing response fields is unavoidable, update all affected controllers/services/tests consistently.

---

# 21. Tests

Add/update tests for the following cases.

## Test 1: No evidence

```text
Review created
No receipt uploaded

Expected:

review.status = PUBLISHED
verification.status = NO_EVIDENCE
verification.hasEvidence = false
public badge = null
```

## Test 2: Strong evidence

```text
Valid receipt
Strong product match
Valid date
Valid merchant
Valid receipt structure
Unique receipt
```

Expected:

```text
status = STRONG_EVIDENCE
hasEvidence = true
public badge = PURCHASE_EVIDENCE
review remains PUBLISHED
```

## Test 3: Good evidence

Expected:

```text
status = GOOD_EVIDENCE
public badge = PURCHASE_EVIDENCE
```

## Test 4: Weak evidence

Expected:

```text
status = WEAK_EVIDENCE
review remains PUBLISHED
public badge = null
```

## Test 5: Suspicious evidence

Expected:

```text
status = SUSPICIOUS
review remains PUBLISHED
public badge = null
```

## Test 6: Duplicate fingerprint

Upload the same receipt to another review.

Expected:

```text
DUPLICATE_FINGERPRINT
risk flag created
evidence status = SUSPICIOUS
review remains PUBLISHED
```

## Test 7: Duplicate order number

Use the same order number on another user's evidence.

Expected:

```text
DUPLICATE_ORDER_NUMBER
risk flag created
evidence status = SUSPICIOUS
```

## Test 8: Duplicate transaction number

Expected:

```text
DUPLICATE_TRANSACTION_NUMBER
evidence status = SUSPICIOUS
```

## Test 9: Future date

Expected:

```text
FUTURE_DATE
evidence receives negative signal
```

## Test 10: Price anomaly

Expected:

```text
PRICE_ANOMALY
evidence score reduced
```

## Test 11: High review frequency

Create more than the configured number of reviews within the configured time window.

Expected:

```text
HIGH_REVIEW_FREQUENCY
```

## Test 12: Repeated suspicious evidence

A user repeatedly submits suspicious evidence.

Expected:

```text
REPEATED_SUSPICIOUS_EVIDENCE
```

and the behavior signal should be stored in the internal verification history/risk data.

## Test 13: Product-level evidence

Product evidence must NOT automatically cause every review to receive:

```text
PURCHASE_EVIDENCE
```

A review only gets the badge from its own accepted evidence.

---

# 22. Code Quality Requirements

Before implementing anything:

1. Inspect the existing architecture.
2. Locate Review model/schema.
3. Locate Evidence model/schema.
4. Locate review controller/service.
5. Locate evidence upload controller/service.
6. Locate receipt parser.
7. Locate receipt validator.
8. Locate product matcher.
9. Locate duplicate detection.
10. Locate verification scoring/configuration.
11. Locate existing tests.

Then implement the smallest clean changes required.

Do not duplicate existing logic.

Prefer:

```text
controller
    ↓
service
    ↓
specialized verification services
```

instead of putting the entire verification system inside a controller.

Keep scoring configuration centralized.

---

# 23. Recommended Internal Architecture

Aim for something conceptually close to:

```text
ReviewController
       │
       ▼
ReviewService
       │
       └── create review

EvidenceController
       │
       ▼
EvidenceVerificationService
       │
       ├── FileValidationService
       ├── OCRService
       ├── ReceiptParser
       ├── ReceiptValidationService
       ├── ProductMatchingService
       ├── DuplicateDetectionService
       ├── BehaviorRiskService
       ├── EvidenceScoringService
       └── VerificationHistoryService
```

Then:

```text
EvidenceVerificationService
            │
            ▼
      EvidenceResult
            │
     ┌──────┴───────┐
     │              │
 quality score   risk flags
     │              │
     └──────┬───────┘
            ▼
   Final Evidence Status
            │
            ▼
       Save Results
```

Do not create all these services if equivalent existing services already exist. Reuse the project's current architecture.

---

# 24. Important Public Semantics

The backend should support the frontend displaying:

### Review with strong/good evidence

```text
Alex   ✓ Purchase evidence

★★★★★

Great headphones. The noise cancellation
is excellent.

Used for a few months
BUY
```

### Review with no evidence

```text
Alex

★★★★★

Great headphones. The noise cancellation
is excellent.

Used for a few months
BUY
```

### Review with weak/suspicious evidence

Also:

```text
Alex

★★★★★

Great headphones. The noise cancellation
is excellent.

Used for a few months
BUY
```

No negative public badge.

Do NOT display:

```text
Suspicious review
Fake review
Trust score
22/100
Verification failed
```

on normal review cards.

---

# 25. Final Acceptance Criteria

The implementation is complete when:

* Reviews have their own lifecycle status.
* Evidence has its own quality status.
* `NO_EVIDENCE` is distinct from `SUSPICIOUS`.
* Evidence score remains internal.
* Evidence signals are stored internally.
* Risk flags are stored separately from quality scoring.
* Verification history is persisted.
* Duplicate fingerprint/order/transaction detection is robust.
* Repeated suspicious behavior can be detected deterministically.
* No AI/ML is introduced.
* No merchant APIs are introduced.
* Suspicious evidence does not automatically delete the review.
* Strong/good evidence produces a public `Purchase evidence` badge.
* Weak/suspicious/no evidence produces no public badge.
* Product-level evidence does not verify individual reviews.
* OCR confidence remains separate from evidence score.
* Public APIs do not expose internal risk information.
* Evidence upload remains transactionally consistent.
* Existing functionality is preserved.
* Tests cover all major evidence states and abuse scenarios.

After implementation, provide a concise report containing:

1. Files changed
2. Database/schema changes
3. New services/functions
4. New API changes
5. New risk rules
6. Tests added/updated
7. Any migrations that need to be run
8. Any assumptions or remaining edge cases

Do not merely describe what should be done. Inspect the existing codebase and implement the changes.

