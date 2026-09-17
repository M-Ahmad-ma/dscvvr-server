function getPublicEvidenceState(evidence) {
  if (!evidence) {
    return { status: "NO_EVIDENCE", hasEvidence: false, badge: null };
  }

  const status = evidence.verification_status || evidence.verification?.status || "NO_EVIDENCE";
  const hasEvidence = !!evidence.id || evidence.hasEvidence === true;

  let badge = null;
  if (status === "STRONG_EVIDENCE" || status === "GOOD_EVIDENCE") {
    badge = "PURCHASE_EVIDENCE";
  }

  return { status, hasEvidence, badge };
}

function getPublicEvidenceDetails(evidence) {
  if (!evidence) {
    return {
      status: "NO_EVIDENCE",
      badge: null,
      checks: [],
      disclaimer: "Purchase evidence does not independently confirm the transaction with the merchant.",
    };
  }

  const status = evidence.verification_status || "NO_EVIDENCE";
  const badge = (status === "STRONG_EVIDENCE" || status === "GOOD_EVIDENCE") ? "PURCHASE_EVIDENCE" : null;

  const signals = evidence.signals || [];
  const checks = signals.map((s) => ({
    code: s.code,
    label: s.label,
    passed: s.status === "PASS",
  }));

  if (status === "SUSPICIOUS" || status === "WEAK_EVIDENCE") {
    return {
      status,
      badge,
      checks,
      message: "We couldn't sufficiently validate the submitted purchase evidence.",
    };
  }

  return {
    status,
    badge,
    checks,
    disclaimer: "Purchase evidence does not independently confirm the transaction with the merchant.",
  };
}

module.exports = { getPublicEvidenceState, getPublicEvidenceDetails };
