function normalizeText(value) {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeProductName(value) {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function normalizePrice(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).replace(/[^0-9.\-]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

function normalizeDate(value) {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9\/\-\.]/g, "").trim();
  if (!cleaned) return null;

  const separators = ["/", "-", "."];
  for (const sep of separators) {
    if (cleaned.includes(sep)) {
      const parts = cleaned.split(sep).map((p) => p.trim());
      if (parts.length !== 3) continue;

      const nums = parts.map(Number);
      if (nums.some(isNaN)) continue;

      const [a, b, c] = nums;

      if (a > 12 && a <= 31 && b >= 1 && b <= 12 && c >= 1000 && c <= 9999) {
        return `${c}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
      }
      if (a >= 1 && a <= 12 && b > 12 && b <= 31 && c >= 1000 && c <= 9999) {
        return `${c}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
      }
      if (a >= 1000 && a <= 9999 && b >= 1 && b <= 12 && c >= 1 && c <= 31) {
        return `${a}-${String(b).padStart(2, "0")}-${String(c).padStart(2, "0")}`;
      }
    }
  }

  return null;
}

function extractNumbers(text) {
  if (!text) return [];
  const matches = text.match(/\d[\d,]*\.?\d*/g) || [];
  return matches.map((m) => parseFloat(m.replace(/,/g, ""))).filter((n) => !isNaN(n));
}

module.exports = { normalizeText, normalizeProductName, normalizePrice, normalizeDate, extractNumbers };
