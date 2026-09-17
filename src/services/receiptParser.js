const { normalizeText, normalizePrice, normalizeDate, extractNumbers } = require("./textNormalization");

function parseReceipt(rawOcrText) {
  if (!rawOcrText || typeof rawOcrText !== "string") {
    return {
      documentType: "unknown",
      merchant: { name: null, address: null },
      purchaseDate: null,
      items: [],
      subtotal: null,
      tax: null,
      total: null,
      orderNumber: null,
      transactionNumber: null,
    };
  }

  const lines = rawOcrText.split("\n").map((l) => l.trim()).filter(Boolean);
  const fullText = lines.join(" ");

  const documentType = detectDocumentType(fullText);
  const merchant = extractMerchant(lines);
  const purchaseDate = extractDate(fullText);
  const items = extractItems(lines);
  const { subtotal, tax, total } = extractTotals(lines, items);
  const orderNumber = extractOrderNumber(fullText);
  const transactionNumber = extractTransactionNumber(fullText);

  return {
    documentType,
    merchant,
    purchaseDate,
    items,
    subtotal,
    tax,
    total,
    orderNumber,
    transactionNumber,
  };
}

function detectDocumentType(text) {
  const lower = text.toLowerCase();
  const receiptKeywords = ["receipt", "cash receipt", "purchase", "invoice", "order", "transaction", "payment", "bill", "checkout"];
  for (const kw of receiptKeywords) {
    if (lower.includes(kw)) return "receipt";
  }
  return "unknown";
}

function extractMerchant(lines) {
  if (lines.length === 0) return { name: null, address: null };

  let name = null;
  let address = null;

  const firstLine = lines[0];
  const normalized = normalizeText(firstLine);
  const skipKeywords = ["receipt", "invoice", "order", "transaction", "cash", "bill", "purchase", "payment"];
  const isHeader = skipKeywords.some((kw) => normalized.includes(kw));

  if (!isHeader && firstLine.length > 1 && firstLine.length < 100) {
    name = firstLine.replace(/[^\w\s&'.\-]/g, "").trim();
  }

  for (let i = 1; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower.includes("date:") || lower.includes("total") || lower.includes("item")) break;
    if (line.length > 5 && line.length < 200 && !name) {
      name = line.replace(/[^\w\s&'.\-]/g, "").trim();
    } else if (name && !address && line.length > 5) {
      const hasNumbers = /\d/.test(line);
      const hasAddressWords = /\b(street|st|ave|avenue|blvd|road|rd|drive|dr|lane|ln|way|court|ct|place|pl)\b/i.test(line);
      if (hasNumbers || hasAddressWords) {
        address = line.trim();
      }
    }
  }

  return { name: name || null, address };
}

function extractDate(text) {
  const datePatterns = [
    /(?:date|dt|dated?)[:\s]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:date|dt|dated?)[:\s]+(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
    /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
    /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4})/i,
    /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2},?\s+\d{4})/i,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const dateStr = match[1] || match[0];
      return normalizeDate(dateStr);
    }
  }

  return null;
}

function extractItems(lines) {
  const items = [];
  const itemPattern = /^(.+?)\s+[\$]?\s*(\d[\d,]*\.?\d*)\s*$/;
  const skipWords = ["total", "subtotal", "sub total", "tax", "vat", "discount", "change", "cash", "credit", "debit", "visa", "mastercard", "change due", "amount", "balance", "payment", "thank you", "thanks", "receipt", "invoice", "order"];

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (skipWords.some((w) => lower.startsWith(w) || lower === w)) continue;
    if (line.length < 3) continue;

    const match = line.match(itemPattern);
    if (match) {
      const name = match[1].trim();
      const price = normalizePrice(match[2]);
      if (price !== null && price >= 0 && name.length > 0) {
        const nameLower = name.toLowerCase();
        if (!skipWords.some((w) => nameLower.includes(w))) {
          items.push({ name, price, quantity: 1 });
        }
      }
    }
  }

  return items;
}

function extractTotals(lines, items) {
  let subtotal = null;
  let tax = null;
  let total = null;

  const totalPatterns = [
    { pattern: /(?:sub\s*total)[:\s]+[\$]?\s*(\d[\d,]*\.?\d*)/i, field: "subtotal" },
    { pattern: /(?:tax|vat|gst|hst)[:\s]+[\$]?\s*(\d[\d,]*\.?\d*)/i, field: "tax" },
    { pattern: /(?:total|amount\s*due|total\s*due|balance\s*due)[:\s]+[\$]?\s*(\d[\d,]*\.?\d*)/i, field: "total" },
  ];

  const fullText = lines.join(" ");

  for (const { pattern, field } of totalPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      const value = normalizePrice(match[1]);
      if (value !== null && value >= 0) {
        if (field === "subtotal") subtotal = value;
        else if (field === "tax") tax = value;
        else if (field === "total") total = value;
      }
    }
  }

  if (total === null && items.length > 0) {
    const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (tax !== null && subtotal !== null) {
      total = subtotal + tax;
    } else if (subtotal !== null) {
      total = subtotal;
    } else {
      total = Math.round(itemsTotal * 100) / 100;
    }
  }

  return { subtotal, tax, total };
}

function extractOrderNumber(text) {
  const patterns = [
    /(?:order\s*(?:#|no|number|num|id))[:\s#]*([A-Za-z0-9\-]+)/i,
    /(?:order)[:\s#]+([A-Za-z0-9\-]+)/i,
    /(?:ord|o)[#\s:]+([A-Za-z0-9\-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractTransactionNumber(text) {
  const patterns = [
    /(?:transaction\s*(?:#|no|number|num|id|ref))[:\s#]*([A-Za-z0-9\-]+)/i,
    /(?:txn|tx)[#\s:]+([A-Za-z0-9\-]+)/i,
    /(?:ref(?:erence)?\s*(?:#|no|number|num|id))[:\s#]*([A-Za-z0-9\-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

module.exports = { parseReceipt };
