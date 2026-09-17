const pool = require("../db/pool");
const { parseReceipt } = require("./receiptParser");
const { validateReceipt } = require("./receiptValidation");
const { matchProduct, checkPriceAnomaly } = require("./productMatching");
const { generateFingerprint, checkDuplicate } = require("./duplicateDetection");
const { getReviewerTrustSignals } = require("./reviewerTrust");
const { calculateEvidenceScore } = require("./evidenceScoring");
const { getPublicEvidenceState } = require("./evidencePublic");

async function processEvidence({ ocrResult, productId, reviewId, userId, source }) {
  const existingEvidence = await checkIdempotency(ocrResult.requestId);
  if (existingEvidence) {
    return buildResult(existingEvidence);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const parsed = parseReceipt(ocrResult.text);
    const validationSignals = validateReceipt(parsed);

    const productResult = await client.query("SELECT * FROM products WHERE id = $1", [productId]);
    if (productResult.rows.length === 0) {
      throw new Error("PRODUCT_NOT_FOUND");
    }
    const product = productResult.rows[0];

    const productMatch = matchProduct(parsed, product);
    const priceAnomaly = productMatch.matchedItem ? checkPriceAnomaly(productMatch.matchedItem, product) : null;

    const fingerprint = generateFingerprint(parsed);
    const duplicateResult = await checkDuplicate(parsed, fingerprint, userId, reviewId, null);

    const trustSignals = await getReviewerTrustSignals(userId);

    const hasValidDate = validationSignals.some((s) => s.code === "DATE_VALID" && s.status === "PASS");
    const hasInvalidDate = validationSignals.some((s) => s.code === "DATE_FUTURE" && s.status === "FAIL");
    const receiptStructure = validationSignals.find((s) => s.code === "RECEIPT_STRUCTURE");
    const structureValid = receiptStructure && receiptStructure.status === "PASS";

    const accountSignal = trustSignals.find((s) => s.code === "ACCOUNT_AGE");
    const frequencySignal = trustSignals.find((s) => s.code === "HIGH_REVIEW_FREQUENCY" || s.code === "REVIEW_BEHAVIOR");
    const historySignal = trustSignals.find((s) => s.code === "REPEATED_SUSPICIOUS_EVIDENCE");

    const establishedAccount = accountSignal && accountSignal.status === "PASS";
    const normalBehavior = frequencySignal && frequencySignal.code === "REVIEW_BEHAVIOR" && frequencySignal.status === "PASS";
    const suspiciousBehavior = frequencySignal && frequencySignal.status === "FAIL";

    const docInconsistency = validationSignals.some(
      (s) => s.code === "TOTAL_MISMATCH" && s.status === "FAIL"
    );

    const repeatedSuspicious = historySignal && historySignal.status === "FAIL";

    const scoringInputs = {
      productMatched: productMatch.matched,
      validDate: hasValidDate ? true : hasInvalidDate ? false : null,
      priceInRange: priceAnomaly ? !priceAnomaly.anomaly : null,
      priceAnomaly: priceAnomaly ? priceAnomaly.anomaly : false,
      merchantDetected: !!(parsed.merchant && parsed.merchant.name),
      orderNumberPresent: !!parsed.orderNumber,
      transactionNumberPresent: !!parsed.transactionNumber,
      receiptStructureValid: structureValid,
      uniqueReceipt: !duplicateResult.isDuplicate,
      duplicateFingerprint: duplicateResult.duplicateType === "fingerprint_cross_user" || duplicateResult.duplicateType === "fingerprint_same_user",
      duplicateOrder: duplicateResult.duplicateType === "order_number_cross_user",
      duplicateTransaction: duplicateResult.duplicateType === "transaction_number_cross_user",
      establishedAccount,
      normalReviewBehavior: normalBehavior,
      suspiciousBehavior,
      documentInconsistency: docInconsistency,
      repeatedSuspiciousEvidence: repeatedSuspicious,
    };

    const scoring = calculateEvidenceScore(scoringInputs);

    const allRiskFlags = [
      ...duplicateResult.riskFlags,
      ...scoring.riskFlags,
    ];

    const evidenceResult = await client.query(
      `INSERT INTO evidence (
        user_id, product_id, review_id, source, request_id, document_type,
        raw_ocr_text, ocr_confidence, merchant_name, merchant_address,
        purchase_date, subtotal, tax, total, currency,
        order_number, transaction_number, fingerprint,
        validation_status, evidence_score, verification_status,
        signals, risk_flags, scoring_version, parser_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
      RETURNING id`,
      [
        userId,
        productId,
        reviewId || null,
        source,
        ocrResult.requestId,
        parsed.documentType,
        ocrResult.text,
        ocrResult.confidence,
        parsed.merchant?.name || null,
        parsed.merchant?.address || null,
        parsed.purchaseDate,
        parsed.subtotal,
        parsed.tax,
        parsed.total,
        "USD",
        parsed.orderNumber,
        parsed.transactionNumber,
        fingerprint,
        "processed",
        scoring.score,
        scoring.status,
        JSON.stringify(scoring.qualitySignals),
        JSON.stringify(allRiskFlags),
        "1.0",
        "1.0",
      ]
    );

    const evidenceId = evidenceResult.rows[0].id;

    for (const item of parsed.items) {
      await client.query(
        "INSERT INTO evidence_items (evidence_id, name, price, quantity) VALUES ($1, $2, $3, $4)",
        [evidenceId, item.name, item.price, item.quantity]
      );
    }

    await client.query(
      `INSERT INTO verification_history (user_id, review_id, evidence_id, score, status, risk_flags)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, reviewId || null, evidenceId, scoring.score, scoring.status, JSON.stringify(allRiskFlags)]
    );

    if (source === "product") {
      await client.query(
        "UPDATE products SET evidence_id = $1, evidence_score = $2, verification_status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
        [evidenceId, scoring.score, scoring.status, productId]
      );
    } else if (source === "review" && reviewId) {
      await client.query(
        "UPDATE reviews SET evidence_id = $1, evidence_score = $2, verification_status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
        [evidenceId, scoring.score, scoring.status, reviewId]
      );
    }

    await client.query("COMMIT");

    return {
      verification: {
        id: evidenceId,
        score: scoring.score,
        status: scoring.status,
      },
      receipt: {
        documentType: parsed.documentType,
        merchant: parsed.merchant,
        purchaseDate: parsed.purchaseDate,
        items: parsed.items,
        subtotal: parsed.subtotal,
        tax: parsed.tax,
        total: parsed.total,
        orderNumber: parsed.orderNumber,
        transactionNumber: parsed.transactionNumber,
      },
      productMatch: {
        matched: productMatch.matched,
        confidence: productMatch.confidence,
      },
      qualitySignals: scoring.qualitySignals,
      riskFlags: allRiskFlags,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function checkIdempotency(requestId) {
  if (!requestId) return null;
  const result = await pool.query(
    "SELECT * FROM evidence WHERE request_id = $1 LIMIT 1",
    [requestId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

function buildResult(evidence) {
  return {
    verification: {
      id: evidence.id,
      score: evidence.evidence_score,
      status: evidence.verification_status,
    },
    receipt: {
      documentType: evidence.document_type,
      merchant: { name: evidence.merchant_name, address: evidence.merchant_address },
      purchaseDate: evidence.purchase_date,
      items: [],
      subtotal: evidence.subtotal,
      tax: evidence.tax,
      total: evidence.total,
      orderNumber: evidence.order_number,
      transactionNumber: evidence.transaction_number,
    },
    productMatch: { matched: true, confidence: "CACHED" },
    qualitySignals: evidence.signals || [],
    riskFlags: evidence.risk_flags || [],
  };
}

async function getEvidence(evidenceId) {
  const result = await pool.query(
    `SELECT e.*,
            json_agg(json_build_object('name', ei.name, 'price', ei.price, 'quantity', ei.quantity)) as items
     FROM evidence e
     LEFT JOIN evidence_items ei ON e.id = ei.evidence_id
     WHERE e.id = $1
     GROUP BY e.id`,
    [evidenceId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    verification: {
      id: row.id,
      score: row.evidence_score,
      status: row.verification_status,
    },
    receipt: {
      documentType: row.document_type,
      merchant: { name: row.merchant_name, address: row.merchant_address },
      purchaseDate: row.purchase_date,
      items: row.items || [],
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      orderNumber: row.order_number,
      transactionNumber: row.transaction_number,
    },
    qualitySignals: row.signals,
    riskFlags: row.risk_flags,
    createdAt: row.created_at,
  };
}

async function deleteEvidence(evidenceId, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id, user_id, product_id, review_id, source FROM evidence WHERE id = $1",
      [evidenceId]
    );
    if (existing.rows.length === 0) {
      throw new Error("EVIDENCE_NOT_FOUND");
    }

    const evidence = existing.rows[0];
    if (evidence.user_id !== userId) {
      throw new Error("UNAUTHORIZED");
    }

    if (evidence.source === "product") {
      await client.query(
        "UPDATE products SET evidence_id = NULL, evidence_score = NULL, verification_status = NULL WHERE evidence_id = $1",
        [evidenceId]
      );
    } else if (evidence.source === "review" && evidence.review_id) {
      await client.query(
        "UPDATE reviews SET evidence_id = NULL, evidence_score = NULL, verification_status = NULL WHERE evidence_id = $1",
        [evidenceId]
      );
    }

    await client.query("DELETE FROM evidence WHERE id = $1", [evidenceId]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { processEvidence, getEvidence, deleteEvidence };
