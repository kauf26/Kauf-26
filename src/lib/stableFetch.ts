/** Shared fetch dedupe + React Query defaults for dashboard data endpoints. */

const inFlight = new Map<string, Promise<unknown>>();
const resolvedCache = new Map<string, unknown>();

export function fetchRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}

export function shouldRetryFetch(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;
  if (!(error instanceof Error)) return false;
  if (/^4\d\d:/.test(error.message)) return false;
  return true;
}

/** React Query options: fetch once per session, no polling, no refetch storms. */
export const STABLE_QUERY_OPTIONS = {
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
  retryDelay: fetchRetryDelay,
  retryOnMount: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false,
  refetchIntervalInBackground: false,
} as const;

function isOptionalEndpointFallbackError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;
  return /^(404|502|503|504):/.test(error.message);
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
 * Optional dashboard endpoints (listings, sales, layout): return fallback when
 * route is missing or backend/proxy is unavailable — never retry-loop.
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
      resolvedCache.set(cacheKey, fallback);
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
}
