import type { ScraperSource, VisionMatchContext } from "./listingUtils";
import {
  brandJaccard,
  brandsConflict,
  scoreScraperCandidate,
} from "./listingUtils";
import type { ScraperRunOptions } from "./scraperOptions";

export const GLOBAL_EXACT_RACE_TIMEOUT_MS = Number(
  process.env.SCRAPER_GLOBAL_TIMEOUT_MS ?? 10_000
);

export type ScraperRunner = {
  source: ScraperSource;
  run: (
    query: string,
    vision?: VisionMatchContext,
    opts?: ScraperRunOptions
  ) => Promise<Record<string, unknown> | null>;
};

export type ScraperRunResult = {
  source: ScraperSource;
  value: Record<string, unknown> | null;
  timedOut: boolean;
  aborted: boolean;
  elapsedMs: number;
};

export type ScraperCandidate = {
  source: ScraperSource;
  product: Record<string, unknown>;
  score: number;
  reasons: string[];
};

function validateProduct(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!d.title || d.title === "N/A") return false;
  const price = parseFloat(String(d.price).replace(/[^0-9.]/g, ""));
  if (
    (Number.isNaN(price) || price === 0) &&
    (!d.description || String(d.description).length < 10)
  ) {
    return false;
  }
  return true;
}

export function toCandidate(
  vision: VisionMatchContext,
  result: ScraperRunResult,
  scoreFn: (
    vision: VisionMatchContext,
    product: Record<string, unknown>
  ) => { score: number; reasons: string[] }
): ScraperCandidate | null {
  const { source, value } = result;
  if (!value || !validateProduct(value)) return null;

  const listingBrand = String(value.brand ?? "");
  if (brandsConflict(vision.visionBrand, listingBrand)) {
    console.warn(
      `[MasterScraper] ${source}: REJECTED brand conflict — vision="${vision.visionBrand}" vs listing="${listingBrand}" (jaccard=${brandJaccard(vision.visionBrand ?? "", listingBrand).toFixed(2)})`
    );
    return null;
  }

  const scored = scoreFn(vision, value);
  console.log(
    `[MasterScraper] ${source}: score=${scored.score} [${scored.reasons.join(", ")}]`
  );
  return {
    source,
    product: { ...value, scraperSource: source },
    score: scored.score,
    reasons: scored.reasons,
  };
}

export type RaceScrapersResult = {
  exactWinner: ScraperCandidate | null;
  candidates: ScraperCandidate[];
  anyTimedOut: boolean;
  raceElapsedMs: number;
  exactFoundAtMs: number | null;
};

/**
 * Run scrapers in parallel. First valid exact match wins and aborts the rest.
 * If no exact within GLOBAL_EXACT_RACE_TIMEOUT_MS, wait for all and rank similar.
 */
export async function raceScrapersForExactMatch(
  runners: ScraperRunner[],
  query: string,
  vision: VisionMatchContext,
  runScraper: (
    source: ScraperSource,
    run: ScraperRunner["run"],
    query: string,
    vision: VisionMatchContext,
    opts: ScraperRunOptions
  ) => Promise<ScraperRunResult>,
  buildOpts: (source: ScraperSource) => ScraperRunOptions,
  scoreFn: (
    vision: VisionMatchContext,
    product: Record<string, unknown>
  ) => { score: number; reasons: string[] }
): Promise<RaceScrapersResult> {
  const raceStart = Date.now();
  const masterAbort = new AbortController();
  let winnerLocked = false;
  let winnerSource: ScraperSource | null = null;
  let exactFoundAtMs: number | null = null;

  const results: ScraperRunResult[] = [];
  let anyTimedOut = false;

  const combineSignals = (a: AbortSignal, b: AbortSignal): AbortSignal => {
    if (a.aborted || b.aborted) {
      const c = new AbortController();
      c.abort();
      return c.signal;
    }
    const combined = new AbortController();
    const onAbort = () => combined.abort();
    a.addEventListener("abort", onAbort, { once: true });
    b.addEventListener("abort", onAbort, { once: true });
    return combined.signal;
  };

  const promises = runners.map(({ source, run }) => {
    const opts = buildOpts(source);
    const mergedOpts: ScraperRunOptions = {
      ...opts,
      signal: opts.signal
        ? combineSignals(opts.signal, masterAbort.signal)
        : masterAbort.signal,
    };

    return runScraper(source, run, query, vision, mergedOpts).then((result) => {
      if (result.timedOut) anyTimedOut = true;

      if (winnerLocked && result.source !== winnerSource) {
        console.log(
          `[MasterScraper] Aborted ${result.source} – winner already found`
        );
        return { ...result, aborted: true };
      }

      results.push(result);
      return result;
    });
  });

  const exactWinPromise = new Promise<ScraperCandidate | null>((resolve) => {
    let settled = false;

    const tryResolveExact = (result: ScraperRunResult) => {
      if (settled || winnerLocked) return;
      const candidate = toCandidate(vision, result, scoreFn);
      if (candidate?.product.isExactMatch === true) {
        settled = true;
        winnerLocked = true;
        winnerSource = result.source;
        exactFoundAtMs = Date.now() - raceStart;
        masterAbort.abort();
        console.log(
          `[MasterScraper] WINNER (exact match) from ${result.source} in ${exactFoundAtMs}ms`
        );
        resolve(candidate);
      }
    };

    for (const p of promises) {
      p.then(tryResolveExact).catch(() => {
        /* individual scraper errors handled in runScraper */
      });
    }

    const globalTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.log(
          `[MasterScraper] Global ${GLOBAL_EXACT_RACE_TIMEOUT_MS}ms timeout — no exact match yet, waiting for best similar`
        );
        resolve(null);
      }
    }, GLOBAL_EXACT_RACE_TIMEOUT_MS);

    Promise.allSettled(promises).then(() => {
      clearTimeout(globalTimer);
      if (!settled) {
        settled = true;
        resolve(null);
      }
    });
  });

  const exactWinner = await exactWinPromise;

  if (exactWinner) {
    return {
      exactWinner,
      candidates: [exactWinner],
      anyTimedOut,
      raceElapsedMs: Date.now() - raceStart,
      exactFoundAtMs,
    };
  }

  await Promise.allSettled(promises);

  const candidates: ScraperCandidate[] = [];
  for (const result of results) {
    const candidate = toCandidate(vision, result, scoreFn);
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    const aExact = a.product.isExactMatch === true ? 1 : 0;
    const bExact = b.product.isExactMatch === true ? 1 : 0;
    if (bExact !== aExact) return bExact - aExact;
    return b.score - a.score;
  });

  return {
    exactWinner: null,
    candidates,
    anyTimedOut,
    raceElapsedMs: Date.now() - raceStart,
    exactFoundAtMs: null,
  };
}
