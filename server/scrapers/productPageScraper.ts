/**
 * Fetch a marketplace product page and extract gallery image URLs.
 */
import {
  extractProductPageImageUrls,
  MAX_PRODUCT_PAGE_IMAGES,
  PRODUCT_PAGE_IMAGE_EXTRACTION_INSTRUCTION,
} from "./productPageImages";

const FETCH_TIMEOUT_MS = Number(process.env.PRODUCT_PAGE_FETCH_TIMEOUT_MS ?? 8_000);

export type ProductPageScrapeResult = {
  imageUrls: string[];
  productUrl: string;
};

export async function fetchProductPageImages(
  productUrl: string,
  options?: {
    maxImages?: number;
    fetchImpl?: typeof fetch;
  }
): Promise<ProductPageScrapeResult> {
  const maxImages = options?.maxImages ?? MAX_PRODUCT_PAGE_IMAGES;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = String(productUrl ?? "").trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    return { imageUrls: [], productUrl: url };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Kauf26Bot/1.0; +https://kaufai.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      console.warn(
        `[ProductPage] Image fetch failed (${res.status}) for ${url.slice(0, 80)}`
      );
      return { imageUrls: [], productUrl: url };
    }

    const html = await res.text();
    const imageUrls = extractProductPageImageUrls(html, url, maxImages);

    console.log(
      `[ProductPage] ${PRODUCT_PAGE_IMAGE_EXTRACTION_INSTRUCTION.slice(0, 48)}… → ${imageUrls.length} URL(s) from ${url.slice(0, 80)}`
    );
    if (imageUrls.length > 0) {
      console.log(
        `[ProductPage] Images:`,
        imageUrls.map((u, i) => `${i + 1}. ${u.slice(0, 100)}`).join(" | ")
      );
    }

    return { imageUrls, productUrl: url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ProductPage] Fetch error for ${url.slice(0, 80)}: ${msg}`);
    return { imageUrls: [], productUrl: url };
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichProductWithPageImages(
  product: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const existing = Array.isArray(product.imageUrls)
    ? (product.imageUrls as string[]).filter(Boolean)
    : [];

  if (existing.length >= MAX_PRODUCT_PAGE_IMAGES) {
    return { ...product, imageUrls: existing.slice(0, MAX_PRODUCT_PAGE_IMAGES) };
  }

  const productUrl = String(
    product.productUrl ?? product.url ?? product.link ?? ""
  ).trim();

  if (!productUrl) return product;

  const { imageUrls } = await fetchProductPageImages(productUrl, {
    maxImages: MAX_PRODUCT_PAGE_IMAGES,
  });

  if (imageUrls.length === 0) return product;

  const merged = [...existing];
  for (const img of imageUrls) {
    if (merged.length >= MAX_PRODUCT_PAGE_IMAGES) break;
    if (!merged.includes(img)) merged.push(img);
  }

  return {
    ...product,
    imageUrls: merged.slice(0, MAX_PRODUCT_PAGE_IMAGES),
    primaryImageUrl: merged[0],
  };
}
