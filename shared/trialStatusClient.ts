import type { TrialStatus } from "./trialStatus";

const CACHE_MS = 60 * 60 * 1000;
const ERROR_CACHE_MS = 10_000;
const MIN_INTERVAL_MS = 1000;

let memoryCache: { data: TrialStatus; fetchedAt: number } | null = null;
let errorCache: { fetchedAt: number } | null = null;
let inFlight: Promise<TrialStatus | null> | null = null;
let lastRequestAt = 0;

export function clearTrialStatusCache(): void {
  memoryCache = null;
  errorCache = null;
  inFlight = null;
  lastRequestAt = 0;
}

/**
 * Shared throttled trial status fetch (max 1 request / second, deduped in-flight).
 */
export async function fetchTrialStatusFromUrl(
  url: string,
  options?: { forceRefresh?: boolean; init?: RequestInit }
): Promise<TrialStatus | null> {
  const now = Date.now();

  if (!options?.forceRefresh && memoryCache && now - memoryCache.fetchedAt < CACHE_MS) {
    return memoryCache.data;
  }

  if (!options?.forceRefresh && errorCache && now - errorCache.fetchedAt < ERROR_CACHE_MS) {
    return null;
  }

  if (inFlight) {
    return inFlight;
  }

  if (!options?.forceRefresh && now - lastRequestAt < MIN_INTERVAL_MS) {
    return memoryCache?.data ?? null;
  }

  lastRequestAt = now;
  inFlight = (async () => {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        ...options?.init,
      });
      if (!res.ok) {
        errorCache = { fetchedAt: Date.now() };
        return null;
      }
      const data = (await res.json()) as TrialStatus;
      memoryCache = { data, fetchedAt: Date.now() };
      errorCache = null;
      return data;
    } catch {
      errorCache = { fetchedAt: Date.now() };
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
