/** Pull USD amounts from titles/snippets (e.g. "$6,000.00", "$2,115 to $37,900"). */
export function extractPricesFromText(text: string): number[] {
  if (!text) return [];
  const prices: number[] = [];
  for (const m of text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) prices.push(n);
  }
  for (const m of text.matchAll(/([\d,]+(?:\.\d{2})?)\s*USD\b/gi)) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) prices.push(n);
  }
  return prices;
}

export function bestPriceFromText(text: string, minPrice = 0): number {
  const prices = extractPricesFromText(text);
  const valid = prices.filter((p) => p >= minPrice);
  if (valid.length === 0) return 0;
  valid.sort((a, b) => a - b);
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? (valid[mid - 1] + valid[mid]) / 2
    : valid[mid];
}
