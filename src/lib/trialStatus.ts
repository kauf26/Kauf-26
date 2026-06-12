import type { TrialStatus } from "../../shared/trialStatus";

export type { TrialStatus };

const CACHE_MS = 60 * 60 * 1000;

let memoryCache: { data: TrialStatus; fetchedAt: number } | null = null;

export function clearTrialStatusCache(): void {
  memoryCache = null;
}

export async function fetchTrialStatus(options?: {
  forceRefresh?: boolean;
}): Promise<TrialStatus | null> {
  const now = Date.now();
  if (!options?.forceRefresh && memoryCache && now - memoryCache.fetchedAt < CACHE_MS) {
    return memoryCache.data;
  }

  try {
    const res = await fetch("/api/trial/status", {
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TrialStatus;
    memoryCache = { data, fetchedAt: now };
    return data;
  } catch {
    return null;
  }
}
