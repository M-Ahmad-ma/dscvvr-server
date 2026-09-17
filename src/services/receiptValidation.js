const { normalizeDate } = require("./textNormalization");
const { validationRules } = require("./verificationConfig");

function validateReceipt(parsedReceipt) {
  const signals = [];
  const { merchant, purchaseDate, items, subtotal, tax, total, orderNumber, transactionNumber } = parsedReceipt;

  if (merchant && merchant.name) {
    signals.push({ code: "MERCHANT_DETECTED", status: "PASS", label: "Merchant name detected" });
  } else {
    signals.push({ code: "MERCHANT_DETECTED", status: "FAIL", label: "No merchant name detected" });
  }

  const dateSignal = validateDate(purchaseDate);
  signals.push(dateSignal);

  const itemsSignal = validateItems(items);
  signals.push(itemsSignal);

  const totalsSignal = validateTotals(items, subtotal, tax, total);
  signals.push(...totalsSignal);

  if (orderNumber) {
    signals.push({ code: "ORDER_NUMBER", status: "PASS", label: "Order number detected" });
  } else {
    signals.push({ code: "ORDER_NUMBER", status: "WARN", label: "No order number detected" });
  }

  if (transactionNumber) {
    signals.push({ code: "TRANSACTION_NUMBER", status: "PASS", label: "Transaction number detected" });
  }

  const structureSignal = validateStructure(parsedReceipt);
  signals.push(structureSignal);

  return signals;
}

function validateDate(dateStr) {
  if (!dateStr) {
    return { code: "DATE_PRESENT", status: "FAIL", label: "No purchase date detected" };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { code: "DATE_VALID", status: "FAIL", label: "Purchase date could not be parsed" };
  }

  const now = new Date();
  if (date > now) {
    return { code: "DATE_FUTURE", status: "FAIL", label: "Purchase date is in the future" };
  }

  const maxAge = validationRules.maxReceiptAgeDays;
  const ageMs = now.getTime() - date.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays > maxAge) {
    return { code: "DATE_TOO_OLD", status: "WARN", label: `Purchase date is more than ${maxAge} days ago` };
  }

  return { code: "DATE_VALID", status: "PASS", label: "Purchase date is valid" };
}

function validateItems(items) {
  if (!items || items.length === 0) {
    return { code: "ITEMS_PRESENT", status: "FAIL", label: "No items detected on receipt" };
  }

  const invalidPrices = items.filter((item) => item.price === null || item.price < 0);
  if (invalidPrices.length > 0) {
    return { code: "ITEM_PRICES_VALID", status: "WARN", label: `${invalidPrices.length} item(s) have invalid prices` };
  }

  return { code: "ITEMS_PRESENT", status: "PASS", label: `${items.length} item(s) detected` };
}

function validateTotals(items, subtotal, tax, total) {
  const signals = [];

  if (total === null) {
    signals.push({ code: "TOTAL_PRESENT", status: "FAIL", label: "No total detected on receipt" });
    return signals;
  }

  signals.push({ code: "TOTAL_PRESENT", status: "PASS", label: "Total amount detected" });

  if (items.length > 0) {
    const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const diff = Math.abs(itemsTotal - total);
    const tolerance = validationRules.totalTolerance * total;

    if (subtotal !== null) {
      const subDiff = Math.abs(itemsTotal - subtotal);
      if (subDiff > tolerance * 10) {
        signals.push({ code: "SUBTOTAL_MISMATCH", status: "WARN", label: "Subtotal does not match sum of items" });
      }
    }

    if (subtotal !== null && tax !== null) {
      const expectedTotal = subtotal + tax;
      const taxDiff = Math.abs(expectedTotal - total);
      if (taxDiff > tolerance * 10) {
        signals.push({ code: "TOTAL_MISMATCH", status: "WARN", label: "Total does not match subtotal + tax" });
      }
    } else if (subtotal === null && tax !== null) {
      signals.push({ code: "SUBTOTAL_MISSING", status: "WARN", label: "Subtotal not detected but tax was found" });
    }
  }

  return signals;
}

function validateStructure(parsed) {
  let score = 0;
  const maxScore = 6;

  if (parsed.merchant && parsed.merchant.name) score++;
  if (parsed.purchaseDate) score++;
  if (parsed.items && parsed.items.length > 0) score++;
  if (parsed.total !== null) score++;
  if (parsed.orderNumber || parsed.transactionNumber) score++;
  if (parsed.subtotal !== null || parsed.tax !== null) score++;

  const ratio = score / maxScore;

  if (ratio >= 0.5) {
    return { code: "RECEIPT_STRUCTURE", status: "PASS", label: "Receipt structure looks valid" };
  } else if (ratio >= 0.3) {
    return { code: "RECEIPT_STRUCTURE", status: "WARN", label: "Receipt structure is incomplete" };
  } else {
    return { code: "RECEIPT_STRUCTURE", status: "FAIL", label: "Document does not resemble a receipt" };
  }
}

module.exports = { validateReceipt };
