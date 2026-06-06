/**
 * Extract product gallery image URLs from listing HTML.
 *
 * Rule: Extract up to 6 image URLs from each product page. Prioritise images
 * in order of appearance (main image first, then additional views). If fewer
 * than 6 exist, return all available. Do not stop at 3.
 */

export const MAX_PRODUCT_PAGE_IMAGES = 6;

export const PRODUCT_PAGE_IMAGE_EXTRACTION_INSTRUCTION =
  "Extract up to 6 image URLs from each product page. Prioritise images in order of appearance (main image first, then additional views). If fewer than 6 exist, return all available. Do not stop at 3.";

const JSON_LD_SCRIPT_RE =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

const OG_IMAGE_RE =
  /<meta[^>]+(?:property|name)\s*=\s*["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]+content\s*=\s*["']([^"']+)["'][^>]*>/gi;

const OG_IMAGE_CONTENT_FIRST_RE =
  /<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+(?:property|name)\s*=\s*["'](?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)["'][^>]*>/gi;

const IMG_TAG_RE =
  /<img\b[^>]*(?:\ssrc|data-src|data-original|data-lazy-src)\s*=\s*["']([^"']+)["'][^>]*>/gi;

const SRCSET_RE = /\ssrcset\s*=\s*["']([^"']+)["']/i;

const SKIP_IMAGE_RE =
  /(?:sprite|icon|logo|badge|pixel|spacer|avatar|payment|trust|banner-ad|1x1|tracking|favicon|placeholder)/i;

const TINY_DIM_RE =
  /\b(?:width|height)\s*=\s*["']?(\d+)["']?/gi;

function normalizeImageUrl(url: string, baseUrl: string): string | null {
  const trimmed = url.trim().replace(/&amp;/g, "&");
  if (!trimmed || trimmed.startsWith("data:")) return null;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

function dedupePreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const key = raw.split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

function collectJsonLdImageValues(node: unknown, bucket: string[]): void {
  if (node == null) return;
  if (typeof node === "string") {
    if (/^https?:\/\//i.test(node) || node.startsWith("//")) {
      bucket.push(node);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const entry of node) collectJsonLdImageValues(entry, bucket);
    return;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (obj["@type"] === "ImageObject" && typeof obj.contentUrl === "string") {
      bucket.push(obj.contentUrl);
    }
    if (obj.image != null) collectJsonLdImageValues(obj.image, bucket);
    if (Array.isArray(obj["@graph"])) {
      for (const g of obj["@graph"] as unknown[]) collectJsonLdImageValues(g, bucket);
    }
  }
}

function extractJsonLdImagesInOrder(html: string): string[] {
  const ordered: string[] = [];
  let match: RegExpExecArray | null;
  JSON_LD_SCRIPT_RE.lastIndex = 0;
  while ((match = JSON_LD_SCRIPT_RE.exec(html)) !== null) {
    const block = match[1]?.trim();
    if (!block) continue;
    try {
      const parsed = JSON.parse(block) as unknown;
      const before = ordered.length;
      collectJsonLdImageValues(parsed, ordered);
      if (ordered.length === before) {
        if (
          typeof parsed === "object" &&
          parsed != null &&
          (parsed as Record<string, unknown>)["@type"] === "Product"
        ) {
          collectJsonLdImageValues(
            (parsed as Record<string, unknown>).image,
            ordered
          );
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return ordered;
}

function extractMetaImagesInOrder(html: string): string[] {
  const urls: string[] = [];
  for (const re of [OG_IMAGE_RE, OG_IMAGE_CONTENT_FIRST_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const url = match[1]?.trim();
      if (url) urls.push(url);
    }
  }
  return urls;
}

function largestFromSrcset(srcset: string): string | null {
  const parts = srcset
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  let bestUrl = parts[0].split(/\s+/)[0];
  let bestWidth = 0;
  for (const part of parts) {
    const [url, descriptor] = part.split(/\s+/);
    const w = descriptor?.endsWith("w")
      ? parseInt(descriptor, 10)
      : descriptor?.endsWith("x")
        ? parseFloat(descriptor) * 1000
        : 0;
    if (url && w >= bestWidth) {
      bestWidth = w;
      bestUrl = url;
    }
  }
  return bestUrl ?? null;
}

function isLikelyJunkImage(tag: string, url: string): boolean {
  if (SKIP_IMAGE_RE.test(tag) || SKIP_IMAGE_RE.test(url)) return true;
  const dims: number[] = [];
  let dimMatch: RegExpExecArray | null;
  TINY_DIM_RE.lastIndex = 0;
  while ((dimMatch = TINY_DIM_RE.exec(tag)) !== null) {
    const n = parseInt(dimMatch[1], 10);
    if (Number.isFinite(n)) dims.push(n);
  }
  if (dims.length >= 2 && dims.every((d) => d > 0 && d < 80)) return true;
  return false;
}

function extractImgTagsInOrder(html: string): string[] {
  const urls: string[] = [];
  IMG_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMG_TAG_RE.exec(html)) !== null) {
    const tag = match[0];
    let url = match[1]?.trim();
    if (!url) continue;
    const srcset = tag.match(SRCSET_RE)?.[1];
    if (srcset) {
      const fromSet = largestFromSrcset(srcset);
      if (fromSet) url = fromSet;
    }
    if (isLikelyJunkImage(tag, url)) continue;
    urls.push(url);
  }
  return urls;
}

/**
 * Parse HTML and return up to `maxImages` product image URLs (default 6),
 * preserving first-seen document order: JSON-LD → og/twitter meta → <img> tags.
 */
export function extractProductPageImageUrls(
  html: string,
  pageUrl: string,
  maxImages: number = MAX_PRODUCT_PAGE_IMAGES
): string[] {
  if (!html?.trim() || maxImages <= 0) return [];

  const candidates = [
    ...extractJsonLdImagesInOrder(html),
    ...extractMetaImagesInOrder(html),
    ...extractImgTagsInOrder(html),
  ];

  const resolved: string[] = [];
  for (const candidate of candidates) {
    const abs = normalizeImageUrl(candidate, pageUrl);
    if (!abs) continue;
    resolved.push(abs);
  }

  return dedupePreserveOrder(resolved).slice(0, maxImages);
}
