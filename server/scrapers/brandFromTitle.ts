/** Parse marketplace listing titles → brand + model (shared — no listingUtils import). */

const TITLE_TRAILING_NOISE_RE =
  /\s+[»|–—]\s*.+$|\s+for sale.*$|\s+check prices.*$|\s+price breakdown.*$/i;

const TITLE_PREFIX_NOISE_RE =
  /\b(pre[- ]?owned|used|like new|new|vintage|authentic|certified|genuine|official)\b/gi;

const ICONIC_MODEL_RE =
  /\b(submariner(?:\s+date)?|daytona|datejust|speedmaster|seamaster|royal\s+oak|nautilus|aquaracer)\b/i;

const MODEL_ATTR_NOISE_RE =
  /\b(stainless|steel|silver|black|white|gold|dial|bezel|oyster|ceramic|sapphire|automatic|quartz|and|with)\b/gi;

function refineWatchModel(model: string): string {
  let m = String(model ?? "")
    .replace(MODEL_ATTR_NOISE_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  const iconic = m.match(ICONIC_MODEL_RE);
  if (iconic?.[0]) return iconic[0];
  return m;
}

const GENERIC_TITLE_LEADERS = new Set([
  "hats",
  "hat",
  "caps",
  "cap",
  "shop",
  "store",
  "pre",
  "owned",
  "the",
  "watches",
  "watch",
]);

/** Parse marketplace title → brand + model (e.g. "Pre-Owned Rolex Submariner" → Rolex / Submariner) */
export function extractBrandModelFromTitle(
  title: string,
  hintBrand?: string
): {
  brand: string;
  model: string;
} {
  let t = String(title ?? "")
    .replace(TITLE_TRAILING_NOISE_RE, "")
    .replace(TITLE_PREFIX_NOISE_RE, "")
    .replace(/\bwatches?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const hint = String(hintBrand ?? "").trim();
  if (hint && t.toLowerCase().includes(hint.toLowerCase())) {
    const escaped = hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const model = refineWatchModel(
      t
        .replace(new RegExp(escaped, "gi"), "")
        .replace(/\bhats?\b|\bcaps?\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    );
    return { brand: hint, model };
  }

  const multiWordBrand = t.match(
    /^(The\s+[A-Z][\w']+(?:\s+[A-Z][\w']+)?|Tag\s+Heuer|Patek\s+Philippe|Audemars\s+Piguet|Louis\s+Vuitton)\b/i
  );
  if (multiWordBrand) {
    const brand = multiWordBrand[1];
    const model = t.slice(brand.length).trim();
    return { brand, model };
  }

  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { brand: "", model: "" };

  let start = 0;
  while (
    start < parts.length - 1 &&
    GENERIC_TITLE_LEADERS.has(parts[start].toLowerCase().replace(/-/g, ""))
  ) {
    start++;
  }

  const brand = parts[start]?.replace(/['']s$/i, "") ?? "";
  let model = parts.slice(start + 1).join(" ").trim();

  if (GENERIC_TITLE_LEADERS.has(brand.toLowerCase())) {
    return { brand: hint || "", model: parts.join(" ").trim() };
  }

  const ref = t.match(/\b([A-Z]{1,4}[-]?\d{4,}[A-Z0-9-]*)\b/);
  if (ref && !model.toUpperCase().includes(ref[1].toUpperCase())) {
    model = model ? `${model} ${ref[1]}` : ref[1];
  }
  return { brand, model: refineWatchModel(model) };
}
