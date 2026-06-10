/** Normalize draft id from API/DB JSON (number or numeric string). */
export function normalizeDraftId(id: unknown): number | null {
  const n = typeof id === "number" ? id : Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** One product = one draft row, regardless of photos or marketplace targets. */
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
