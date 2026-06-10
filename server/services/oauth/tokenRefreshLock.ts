/**
 * In-memory refresh lock — one refresh per user+provider at a time.
 * Replace with Redis for multi-process deployments.
 */
const refreshLocks = new Map<string, Promise<string | null>>();

export function refreshLockKey(userId: number | null, provider: string): string {
  return `${userId ?? "anon"}:${provider.toLowerCase()}`;
}

export async function withTokenRefreshLock(
  key: string,
  refreshFn: () => Promise<string | null>
): Promise<string | null> {
  const inFlight = refreshLocks.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = refreshFn().finally(() => {
    if (refreshLocks.get(key) === promise) {
      refreshLocks.delete(key);
    }
  });

  refreshLocks.set(key, promise);
  return promise;
}

/** Test helper */
export function clearTokenRefreshLocks(): void {
  refreshLocks.clear();
}
