/** Shared fetch dedupe + React Query defaults for dashboard data endpoints. */

const inFlight = new Map<string, Promise<unknown>>();
const resolvedCache = new Map<string, unknown>();
const fallbackLogged = new Set<string>();

export function fetchRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}

/** React Query options: fetch once per session, no polling, no refetch storms. */
export const STABLE_QUERY_OPTIONS = {
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false as const,
  retryOnMount: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false as const,
  refetchIntervalInBackground: false,
} as const;

/** Polling hook options (e.g. sold-item alert every 30s). */
export const POLLING_QUERY_OPTIONS = {
  staleTime: 25_000,
  gcTime: 5 * 60 * 1000,
  retry: false as const,
  retryOnMount: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function isOptionalEndpointFallbackError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;
  // Never retry-loop on missing routes or upstream/proxy failures.
  return /^[45]\d\d:/.test(error.message);
}

function logFallbackOnce(cacheKey: string, url: string, error: unknown): void {
  if (fallbackLogged.has(cacheKey)) return;
  fallbackLogged.add(cacheKey);
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`[stableFetch] Using fallback for ${url}: ${reason}`);
}

async function fetchJsonOnce<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Deduplicates concurrent requests to the same URL/key. */
export async function fetchJsonDeduped<T>(
  cacheKey: string,
  url: string,
  init?: RequestInit
): Promise<T> {
  const existing = inFlight.get(cacheKey);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetchJsonOnce<T>(url, init).finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, promise);
  return promise;
}

/**
 * Optional dashboard endpoints: return fallback when route is missing or
 * unavailable — cache result for the session (one network call max).
 */
export async function fetchOptionalEndpoint<T>(
  cacheKey: string,
  url: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  if (resolvedCache.has(cacheKey)) {
    return resolvedCache.get(cacheKey) as T;
  }

  try {
    const data = await fetchJsonDeduped<T>(cacheKey, url, init);
    resolvedCache.set(cacheKey, data);
    return data;
  } catch (error) {
    if (isOptionalEndpointFallbackError(error)) {
      logFallbackOnce(cacheKey, url, error);
      resolvedCache.set(cacheKey, fallback);
      return fallback;
    }
    throw error;
  }
}

/** Live fetch for polling — dedupes in-flight only, no permanent session cache. */
export async function fetchLiveEndpoint<T>(
  cacheKey: string,
  url: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  try {
    return await fetchJsonDeduped<T>(cacheKey, url, init);
  } catch (error) {
    if (isOptionalEndpointFallbackError(error)) {
      logFallbackOnce(`live:${cacheKey}`, url, error);
      return fallback;
    }
    throw error;
  }
}

/** @deprecated Prefer fetchOptionalEndpoint for dashboard optional routes. */
export async function fetchJsonOrDefault<T>(
  cacheKey: string,
  url: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  return fetchOptionalEndpoint(cacheKey, url, fallback, init);
}

/** Clear session cache (tests only). */
export function clearStableFetchCacheForTests(): void {
  inFlight.clear();
  resolvedCache.clear();
  fallbackLogged.clear();
}
