const pool = require("../db/pool");
const { validationRules } = require("./verificationConfig");

async function getReviewerTrustSignals(userId) {
  const signals = [];

  const accountSignal = await checkAccountAge(userId);
  signals.push(accountSignal);

  const frequencySignal = await checkReviewFrequency(userId);
  signals.push(frequencySignal);

  const historySignal = await checkVerificationHistory(userId);
  signals.push(historySignal);

  return signals;
}

async function checkAccountAge(userId) {
  const result = await pool.query("SELECT created_at FROM users WHERE id = $1", [userId]);
  if (result.rows.length === 0) {
    return { code: "ACCOUNT_AGE", status: "WARN", label: "User not found" };
  }

  const createdAt = new Date(result.rows[0].created_at);
  const now = new Date();
  const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (ageDays >= validationRules.establishedAccountDays) {
    return { code: "ACCOUNT_AGE", status: "PASS", label: "Established account" };
  } else if (ageDays >= 7) {
    return { code: "ACCOUNT_AGE", status: "PASS", label: "Account is at least 7 days old" };
  } else {
    return { code: "ACCOUNT_AGE", status: "WARN", label: "New account (less than 7 days old)" };
  }
}

async function checkReviewFrequency(userId) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const result = await pool.query(
    "SELECT COUNT(*) as count FROM reviews WHERE user_id = $1 AND created_at >= $2",
    [userId, fiveMinutesAgo]
  );

  const count = parseInt(result.rows[0].count);
  if (count >= validationRules.maxReviewsPerMinute) {
    return {
      code: "HIGH_REVIEW_FREQUENCY",
      status: "FAIL",
      label: `Suspicious review frequency (${count} reviews in 5 minutes)`,
    };
  }

  return { code: "REVIEW_BEHAVIOR", status: "PASS", label: "Normal review behavior" };
}

async function checkVerificationHistory(userId) {
  const result = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM verification_history
     WHERE user_id = $1 AND status IS NOT NULL
     GROUP BY status`,
    [userId]
  );

  if (result.rows.length === 0) {
    return { code: "VERIFICATION_HISTORY", status: "PASS", label: "No previous verification history" };
  }

  const statusCounts = {};
  for (const row of result.rows) {
    statusCounts[row.status] = parseInt(row.count);
  }

  const suspiciousCount = statusCounts["SUSPICIOUS"] || 0;
  const totalEvidence = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const suspiciousRatio = totalEvidence > 0 ? suspiciousCount / totalEvidence : 0;

  if (suspiciousRatio > 0.5 && totalEvidence >= 3) {
    return {
      code: "REPEATED_SUSPICIOUS_EVIDENCE",
      status: "FAIL",
      label: "Multiple previous evidence submissions were suspicious",
    };
  } else if (suspiciousRatio > 0.3 && totalEvidence >= 2) {
    return {
      code: "VERIFICATION_HISTORY",
      status: "WARN",
      label: "Some previous evidence submissions had issues",
    };
  }

  return { code: "VERIFICATION_HISTORY", status: "PASS", label: "Good verification history" };
}

module.exports = { getReviewerTrustSignals };
