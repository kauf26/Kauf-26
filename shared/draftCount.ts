/** Normalize draft id from API/DB JSON (number or numeric string). */
export function normalizeDraftId(id: unknown): number | null {
  const n = typeof id === "number" ? id : Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Normalize title for deduplication (same product rescanned many times). */
export function normalizeDraftTitle(title: unknown): string {
  return String(title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Stable key: one logical product regardless of photos or marketplace targets. */
export function productDraftFingerprint(draft: {
  id?: unknown;
  title?: unknown;
  sku?: unknown;
  attributes?: Record<string, unknown> | null;
}): string {
  const sku = String(draft.sku ?? "").trim();
  if (sku && !/^auto-/i.test(sku)) {
    return `sku:${sku.toLowerCase()}`;
  }

  const title = normalizeDraftTitle(draft.title);
  const attrs = (draft.attributes ?? {}) as Record<string, unknown>;
  const brand = String(attrs.brand ?? "")
    .trim()
    .toLowerCase();

  if (brand && title) return `tb:${brand}|${title}`;
  if (title) return `t:${title}`;

  const id = normalizeDraftId(draft.id);
  return id != null ? `id:${id}` : "unknown";
}

/** One product = one fingerprint (photos/marketplaces do not multiply count). */
export function countUniqueProductDrafts(
  drafts: ReadonlyArray<{
    id?: unknown;
    title?: unknown;
    sku?: unknown;
    attributes?: Record<string, unknown> | null;
  }>
): number {
  const fingerprints = new Set<string>();
  for (const draft of drafts) {
    fingerprints.add(productDraftFingerprint(draft));
  }
  return fingerprints.size;
}

/** @deprecated Prefer countUniqueProductDrafts for dashboard stats. */
export function countUniqueDraftIds(
  drafts: ReadonlyArray<{ id?: unknown }>
): number {
  const ids = new Set<number>();
  for (const draft of drafts) {
    const id = normalizeDraftId(draft?.id);
    if (id != null) ids.add(id);
  }
  return ids.size;
}

export function dedupeDraftRowsById<T extends { id?: unknown }>(
  drafts: ReadonlyArray<T>
): T[] {
  const byId = new Map<number, T>();
  for (const draft of drafts) {
    const id = normalizeDraftId(draft?.id);
    if (id == null) continue;
    byId.set(id, draft);
  }
  return [...byId.values()];
}
