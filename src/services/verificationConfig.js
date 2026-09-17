const scoringWeights = {
  productMatch: 25,
  validDate: 10,
  priceInRange: 10,
  merchantDetected: 5,
  orderNumber: 10,
  transactionNumber: 5,
  receiptStructure: 5,
  uniqueReceipt: 10,
  establishedAccount: 5,
  normalReviewBehavior: 5,

  duplicateOrder: -30,
  duplicateTransaction: -30,
  invalidDate: -20,
  priceAnomaly: -15,
  suspiciousBehavior: -20,
  documentInconsistency: -25,
};

const verificationStatuses = {
  STRONG_EVIDENCE: { min: 80, max: 100 },
  GOOD_EVIDENCE: { min: 60, max: 79 },
  WEAK_EVIDENCE: { min: 40, max: 59 },
  SUSPICIOUS: { min: 0, max: 39 },
};

const validationRules = {
  maxReceiptAgeDays: 365,
  priceAnomalyThreshold: 0.5,
  totalTolerance: 0.01,
  maxReviewsPerMinute: 5,
  establishedAccountDays: 30,
};

const allowedFileTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"];
const maxFileSizeBytes = 10 * 1024 * 1024;

const qualitySignalCodes = new Set([
  "PRODUCT_MATCH",
  "VALID_DATE",
  "PRICE_IN_RANGE",
  "MERCHANT_DETECTED",
  "ORDER_NUMBER",
  "TRANSACTION_NUMBER",
  "RECEIPT_STRUCTURE",
  "UNIQUE_RECEIPT",
  "ACCOUNT_AGE",
  "REVIEW_BEHAVIOR",
]);

const riskFlagCodes = new Set([
  "DUPLICATE_FINGERPRINT",
  "DUPLICATE_ORDER_NUMBER",
  "DUPLICATE_TRANSACTION_NUMBER",
  "INVALID_DATE",
  "FUTURE_DATE",
  "PRICE_ANOMALY",
  "DOCUMENT_INCONSISTENCY",
  "HIGH_REVIEW_FREQUENCY",
  "REPEATED_SUSPICIOUS_EVIDENCE",
]);

function getVerificationStatus(score) {
  for (const [status, range] of Object.entries(verificationStatuses)) {
    if (score >= range.min && score <= range.max) {
      return status;
    }
  }
  return "SUSPICIOUS";
}

function getBadge(status) {
  if (status === "STRONG_EVIDENCE" || status === "GOOD_EVIDENCE") {
    return "PURCHASE_EVIDENCE";
  }
  return null;
}

function isRiskFlag(code) {
  return riskFlagCodes.has(code);
}

function isQualitySignal(code) {
  return qualitySignalCodes.has(code);
}

module.exports = {
  scoringWeights,
  verificationStatuses,
  validationRules,
  allowedFileTypes,
  maxFileSizeBytes,
  qualitySignalCodes,
  riskFlagCodes,
  getVerificationStatus,
  getBadge,
  isRiskFlag,
  isQualitySignal,
};
