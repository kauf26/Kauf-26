/** Maximum images stored on a product draft / listing publish payload. */
export const MAX_DRAFT_IMAGES = 10;

/** Maximum new image URLs accepted per add-photos request. */
export const MAX_ADD_PHOTOS_PER_REQUEST = 5;

export function normalizeImageUrl(url: string): string {
  return url.trim();
}

export function isValidDraftImageUrl(url: string): boolean {
  const s = normalizeImageUrl(url);
  if (!s) return false;
  return (
    s.startsWith("data:image/") ||
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("/uploads/")
  );
}

export type MergeDraftImagesResult = {
  merged: string[];
  added: string[];
  duplicates: string[];
  rejectedOverLimit: number;
};

/**
 * Append only new image URLs, preserving order, capped at maxTotal.
 */
export function mergeUniqueDraftImageUrls(
  existing: string[],
  incoming: string[],
  maxTotal: number = MAX_DRAFT_IMAGES
): MergeDraftImagesResult {
  const merged = [...existing];
  const seen = new Set(existing.map(normalizeImageUrl));
  const added: string[] = [];
  const duplicates: string[] = [];
  let rejectedOverLimit = 0;

  for (const raw of incoming) {
    const url = normalizeImageUrl(String(raw ?? ""));
    if (!isValidDraftImageUrl(url)) continue;

    if (seen.has(url)) {
      duplicates.push(url);
      continue;
    }

    if (merged.length >= maxTotal) {
      rejectedOverLimit++;
      continue;
    }

    seen.add(url);
    merged.push(url);
    added.push(url);
  }

  return { merged, added, duplicates, rejectedOverLimit };
}

export type ValidateAddPhotosResult =
  | { ok: true; imageUrls: string[] }
  | { ok: false; error: string };

/** Validate add-photos request body before merging into a draft. */
export function validateAddPhotosRequest(
  imageUrls: unknown,
  existing: string[],
  maxPerRequest: number = MAX_ADD_PHOTOS_PER_REQUEST,
  maxTotal: number = MAX_DRAFT_IMAGES
): ValidateAddPhotosResult {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return { ok: false, error: "imageUrls must be a non-empty array" };
  }

  if (imageUrls.length > maxPerRequest) {
    return {
      ok: false,
      error: `Cannot add more than ${maxPerRequest} photos per request`,
    };
  }

  const normalized: string[] = [];
  for (const raw of imageUrls) {
    const url = normalizeImageUrl(String(raw ?? ""));
    if (!isValidDraftImageUrl(url)) {
      return { ok: false, error: "Each imageUrl must be a valid http(s), data, or /uploads/ URL" };
    }
    normalized.push(url);
  }

  const uniqueIncoming = new Set(normalized);
  if (uniqueIncoming.size !== normalized.length) {
    return { ok: false, error: "Duplicate URLs in request are not allowed" };
  }

  const existingSet = new Set(existing.map(normalizeImageUrl));
  for (const url of normalized) {
    if (existingSet.has(url)) {
      return { ok: false, error: "One or more photos are already on this draft" };
    }
  }

  if (existing.length + normalized.length > maxTotal) {
    return {
      ok: false,
      error: `Adding ${normalized.length} photo(s) would exceed the ${maxTotal}-image limit (currently ${existing.length})`,
    };
  }

  return { ok: true, imageUrls: normalized };
}
