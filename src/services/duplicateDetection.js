const crypto = require("crypto");
const pool = require("../db/pool");
const { normalizeText, normalizeProductName } = require("./textNormalization");

function generateFingerprint(parsedReceipt) {
  const parts = [
    normalizeText(parsedReceipt.merchant?.name || ""),
    parsedReceipt.purchaseDate || "",
    parsedReceipt.items
      .map((item) => `${normalizeProductName(item.name)}:${item.price}`)
      .sort()
      .join("|"),
    String(parsedReceipt.total || ""),
    normalizeText(parsedReceipt.orderNumber || ""),
    normalizeText(parsedReceipt.transactionNumber || ""),
  ];

  const normalized = parts.join("||");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

async function checkDuplicate(parsedReceipt, fingerprint, userId, reviewId, excludeEvidenceId) {
  const result = {
    isDuplicate: false,
    duplicateType: null,
    existingEvidenceId: null,
    riskFlags: [],
  };

  if (fingerprint) {
    const sameUserFingerprint = await pool.query(
      "SELECT id, user_id, review_id FROM evidence WHERE fingerprint = $1 AND user_id = $2",
      [fingerprint, userId]
    );

    if (sameUserFingerprint.rows.length > 0) {
      const existing = sameUserFingerprint.rows[0];
      if (reviewId && existing.review_id === reviewId && (!excludeEvidenceId || existing.id === excludeEvidenceId)) {
        // Same user, same review — this is an update/reprocessing, not a duplicate
      } else if (excludeEvidenceId && existing.id === excludeEvidenceId) {
        // Explicitly excluding this evidence (update case)
      } else {
        // Same user, different review — flag as duplicate within same user
        result.isDuplicate = true;
        result.duplicateType = "fingerprint_same_user";
        result.existingEvidenceId = existing.id;
        result.riskFlags.push({
          code: "DUPLICATE_FINGERPRINT",
          label: "This receipt has been submitted before by you",
        });
        return result;
      }
    }

    const crossUserFingerprint = await pool.query(
      "SELECT id, user_id FROM evidence WHERE fingerprint = $1 AND user_id != $2",
      [fingerprint, userId]
    );

    if (crossUserFingerprint.rows.length > 0) {
      result.isDuplicate = true;
      result.duplicateType = "fingerprint_cross_user";
      result.existingEvidenceId = crossUserFingerprint.rows[0].id;
      result.riskFlags.push({
        code: "DUPLICATE_FINGERPRINT",
        label: "This receipt has been submitted by another user",
      });
      return result;
    }
  }

  if (parsedReceipt.orderNumber) {
    const crossUserOrder = await pool.query(
      "SELECT id, user_id FROM evidence WHERE order_number = $1 AND user_id != $2",
      [parsedReceipt.orderNumber, userId]
    );

    if (crossUserOrder.rows.length > 0) {
      result.isDuplicate = true;
      result.duplicateType = "order_number_cross_user";
      result.existingEvidenceId = crossUserOrder.rows[0].id;
      result.riskFlags.push({
        code: "DUPLICATE_ORDER_NUMBER",
        label: "This order number has been used by another user",
      });
      return result;
    }
  }

  if (parsedReceipt.transactionNumber) {
    const crossUserTxn = await pool.query(
      "SELECT id, user_id FROM evidence WHERE transaction_number = $1 AND user_id != $2",
      [parsedReceipt.transactionNumber, userId]
    );

    if (crossUserTxn.rows.length > 0) {
      result.isDuplicate = true;
      result.duplicateType = "transaction_number_cross_user";
      result.existingEvidenceId = crossUserTxn.rows[0].id;
      result.riskFlags.push({
        code: "DUPLICATE_TRANSACTION_NUMBER",
        label: "This transaction number has been used by another user",
      });
      return result;
    }
  }

  return result;
}

module.exports = { generateFingerprint, checkDuplicate };
