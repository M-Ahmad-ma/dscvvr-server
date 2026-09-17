const { scoringWeights, getVerificationStatus, isRiskFlag } = require("./verificationConfig");

function calculateEvidenceScore(inputs) {
  const qualitySignals = [];
  const riskFlags = [];
  let qualityScore = 0;

  const addSignal = (code, points, label) => {
    if (isRiskFlag(code)) {
      riskFlags.push({ code, points, label });
    } else {
      qualitySignals.push({ code, points, label });
    }
  };

  if (inputs.productMatched) {
    const points = scoringWeights.productMatch;
    qualityScore += points;
    addSignal("PRODUCT_MATCH", points, "Product matched");
  } else if (inputs.productMatched === false) {
    addSignal("PRODUCT_MATCH", 0, "Product not matched on receipt");
  }

  if (inputs.validDate) {
    const points = scoringWeights.validDate;
    qualityScore += points;
    addSignal("VALID_DATE", points, "Purchase date is valid");
  } else if (inputs.validDate === false) {
    const points = scoringWeights.invalidDate;
    qualityScore += points;
    addSignal("FUTURE_DATE", points, "Purchase date is invalid or in the future");
  }

  if (inputs.priceInRange) {
    const points = scoringWeights.priceInRange;
    qualityScore += points;
    addSignal("PRICE_IN_RANGE", points, "Price is within expected range");
  } else if (inputs.priceAnomaly) {
    const points = scoringWeights.priceAnomaly;
    qualityScore += points;
    addSignal("PRICE_ANOMALY", points, "Price anomaly detected");
  }

  if (inputs.merchantDetected) {
    const points = scoringWeights.merchantDetected;
    qualityScore += points;
    addSignal("MERCHANT_DETECTED", points, "Merchant name detected");
  }

  if (inputs.orderNumberPresent) {
    const points = scoringWeights.orderNumber;
    qualityScore += points;
    addSignal("ORDER_NUMBER", points, "Order number detected");
  }

  if (inputs.transactionNumberPresent) {
    const points = scoringWeights.transactionNumber;
    qualityScore += points;
    addSignal("TRANSACTION_NUMBER", points, "Transaction number detected");
  }

  if (inputs.receiptStructureValid) {
    const points = scoringWeights.receiptStructure;
    qualityScore += points;
    addSignal("RECEIPT_STRUCTURE", points, "Receipt structure looks valid");
  }

  if (inputs.uniqueReceipt) {
    const points = scoringWeights.uniqueReceipt;
    qualityScore += points;
    addSignal("UNIQUE_RECEIPT", points, "Receipt has not been used before");
  } else if (inputs.duplicateOrder) {
    const points = scoringWeights.duplicateOrder;
    qualityScore += points;
    addSignal("DUPLICATE_ORDER_NUMBER", points, "Duplicate order number detected");
  } else if (inputs.duplicateTransaction) {
    const points = scoringWeights.duplicateTransaction;
    qualityScore += points;
    addSignal("DUPLICATE_TRANSACTION_NUMBER", points, "Duplicate transaction number detected");
  } else if (inputs.duplicateFingerprint) {
    const points = scoringWeights.duplicateOrder;
    qualityScore += points;
    addSignal("DUPLICATE_FINGERPRINT", points, "This receipt has been submitted before");
  }

  if (inputs.establishedAccount) {
    const points = scoringWeights.establishedAccount;
    qualityScore += points;
    addSignal("ACCOUNT_AGE", points, "Established account");
  }

  if (inputs.normalReviewBehavior) {
    const points = scoringWeights.normalReviewBehavior;
    qualityScore += points;
    addSignal("REVIEW_BEHAVIOR", points, "Normal review behavior");
  } else if (inputs.suspiciousBehavior) {
    const points = scoringWeights.suspiciousBehavior;
    qualityScore += points;
    addSignal("HIGH_REVIEW_FREQUENCY", points, "Suspicious review behavior detected");
  }

  if (inputs.documentInconsistency) {
    const points = scoringWeights.documentInconsistency;
    qualityScore += points;
    addSignal("DOCUMENT_INCONSISTENCY", points, "Strong document inconsistency detected");
  }

  if (inputs.repeatedSuspiciousEvidence) {
    addSignal("REPEATED_SUSPICIOUS_EVIDENCE", 0, "User has repeatedly submitted suspicious evidence");
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const status = determineFinalStatus(qualityScore, riskFlags);

  return { score: qualityScore, status, qualitySignals, riskFlags };
}

function determineFinalStatus(qualityScore, riskFlags) {
  const hardAbuseFlags = [
    "DUPLICATE_FINGERPRINT",
    "DUPLICATE_ORDER_NUMBER",
    "DUPLICATE_TRANSACTION_NUMBER",
  ];

  const hasHardAbuse = riskFlags.some((f) => hardAbuseFlags.includes(f.code));
  if (hasHardAbuse) {
    return "SUSPICIOUS";
  }

  return getVerificationStatus(qualityScore);
}

module.exports = { calculateEvidenceScore, determineFinalStatus };
