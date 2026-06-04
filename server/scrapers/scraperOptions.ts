/** Shared options for parallel scraper runs (masterScraper race). */
export type ScraperRunOptions = {
  signal?: AbortSignal;
  queryChain?: string[];
};

export function throwIfAborted(signal?: AbortSignal, label?: string): void {
  if (!signal?.aborted) return;
  const err = new DOMException(
    label ? `Aborted: ${label}` : "Aborted",
    "AbortError"
  );
  throw err;
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  const msg = String(err).toLowerCase();
  return msg.includes("abort");
}

/** Reject when signal aborts; does not cancel the underlying promise. */
export function raceWithAbortSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}
