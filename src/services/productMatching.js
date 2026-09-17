const { normalizeText, normalizeProductName } = require("./textNormalization");

function matchProduct(parsedReceipt, product) {
  if (!parsedReceipt || !parsedReceipt.items || parsedReceipt.items.length === 0) {
    return { matched: false, confidence: "NO_ITEMS", matchedItem: null };
  }

  if (!product || !product.name) {
    return { matched: false, confidence: "NO_PRODUCT", matchedItem: null };
  }

  const productName = product.name;
  const productNormalized = normalizeProductName(productName);
  const productWords = normalizeText(productName).split(" ").filter((w) => w.length > 1);

  let bestMatch = null;
  let bestScore = 0;

  for (const item of parsedReceipt.items) {
    const itemName = item.name;
    const itemNormalized = normalizeProductName(itemName);
    const itemText = normalizeText(itemName);

    let score = 0;

    if (itemNormalized === productNormalized) {
      score = 100;
    } else if (itemNormalized.includes(productNormalized) || productNormalized.includes(itemNormalized)) {
      score = 85;
    } else {
      const itemWords = itemText.split(" ").filter((w) => w.length > 1);
      const matchedWords = productWords.filter((pw) =>
        itemWords.some((iw) => iw === pw || iw.includes(pw) || pw.includes(iw))
      );
      if (matchedWords.length > 0) {
        score = Math.round((matchedWords.length / productWords.length) * 70);
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore >= 80) {
    return { matched: true, confidence: "STRONG_MATCH", matchedItem: bestMatch, score: bestScore };
  } else if (bestScore >= 50) {
    return { matched: true, confidence: "PARTIAL_MATCH", matchedItem: bestMatch, score: bestScore };
  } else {
    return { matched: false, confidence: "NO_MATCH", matchedItem: bestMatch, score: bestScore };
  }
}

function checkPriceAnomaly(matchedItem, product) {
  if (!matchedItem || matchedItem.price === null) return null;
  if (!product) return null;

  const price = matchedItem.price;
  const minPrice = product.min_price ? parseFloat(product.min_price) : null;
  const maxPrice = product.max_price ? parseFloat(product.max_price) : null;

  if (minPrice !== null && maxPrice !== null) {
    if (price >= minPrice && price <= maxPrice) {
      return { anomaly: false, label: "Price is within expected range" };
    }
    const rangeMid = (minPrice + maxPrice) / 2;
    const deviation = Math.abs(price - rangeMid) / rangeMid;
    if (deviation > 0.5) {
      return { anomaly: true, label: "Price is significantly outside expected range" };
    }
    return { anomaly: false, label: "Price is near expected range" };
  }

  return null;
}

module.exports = { matchProduct, checkPriceAnomaly };
