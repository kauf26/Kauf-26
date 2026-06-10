/** Shared fetch dedupe + React Query defaults for dashboard data endpoints. */

const inFlight = new Map<string, Promise<unknown>>();

export function fetchRetryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 8000);
}

export function shouldRetryFetch(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;
  if (!(error instanceof Error)) return false;
  if (/^4\d\d:/.test(error.message)) return false;
  return true;
}

export const STABLE_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: shouldRetryFetch,
  retryDelay: fetchRetryDelay,
  retryOnMount: false,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

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

/** Returns fallback on 404 so missing routes do not trigger retry loops. */
export async function fetchJsonOrDefault<T>(
  cacheKey: string,
  url: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  try {
    return await fetchJsonDeduped<T>(cacheKey, url, init);
  } catch (error) {
    if (error instanceof Error && /^404:/.test(error.message)) {
      return fallback;
    }
    throw error;
  }
}
