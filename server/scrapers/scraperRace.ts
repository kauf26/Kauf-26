import type { ScraperSource, VisionMatchContext } from "./listingUtils";
import {
  brandJaccard,
  brandsConflict,
  scoreScraperCandidate,
} from "./listingUtils";
import type { ScraperRunOptions } from "./scraperOptions";
import {
  buildMatchTargetFromContext,
  validateMatch,
  type MatchConfidence,
} from "./validateMatch";

/** Per-scraper timeout during parallel race (Apify default 25s) */
export const SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS = Number(
  process.env.SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS ??
    process.env.APIFY_SCRAPER_TIMEOUT_MS ??
    25_000
);

/** Soft race window — after this, wait for in-flight scrapers (no discard at boundary) */
export const SCRAPER_RACE_WINDOW_MS = Number(
  process.env.SCRAPER_RACE_WINDOW_MS ??
    process.env.SCRAPER_RACE_TIMEOUT_MS ??
    30_000
);

/** @deprecated Use SCRAPER_RACE_WINDOW_MS */
export const SCRAPER_RACE_TIMEOUT_MS = SCRAPER_RACE_WINDOW_MS;

/** @deprecated Use SCRAPER_RACE_WINDOW_MS */
export const GLOBAL_EXACT_RACE_TIMEOUT_MS = SCRAPER_RACE_WINDOW_MS;

const EXACT_WIN_CONFIDENCES = new Set<MatchConfidence>([
  "high_reference",
  "exact_brand_model",
]);

function listingRowFromProduct(
  value: Record<string, unknown>
): Record<string, unknown> {
  return {
    title: String(value.title ?? "").trim(),
    brand: String(value.brand ?? "").trim(),
    description: String(value.description ?? "").trim(),
    url: String(value.productUrl ?? value.url ?? value.link ?? "").trim(),
  };
}

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

/** Exact win: validateMatch high_reference / exact_brand_model, or legacy flags */
export function isRaceExactValidation(
  vision: VisionMatchContext,
  value: Record<string, unknown>
): { exact: boolean; confidence?: MatchConfidence } {
  if (value.isExactMatch === true) {
    return {
      exact: true,
      confidence: (value.matchValidation as MatchConfidence) ?? "high_reference",
    };
  }

  const preset = value.matchValidation as MatchConfidence | undefined;
  if (preset && EXACT_WIN_CONFIDENCES.has(preset)) {
    return { exact: true, confidence: preset };
  }

  const target = buildMatchTargetFromContext(vision);
  const validation = validateMatch(listingRowFromProduct(value), target);
  if (
    validation.accepted &&
    EXACT_WIN_CONFIDENCES.has(validation.confidence)
  ) {
    return { exact: true, confidence: validation.confidence };
  }

  return { exact: false };
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

  const product = {
    ...value,
    scraperSource: source,
  };

  const scored = scoreFn(vision, product);
  console.log(
    `[MasterScraper] ${source}: score=${scored.score} [${scored.reasons.join(", ")}]`
  );
  return {
    source,
    product,
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
 * Run scrapers in parallel with SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS per source.
 * First high_reference / exact_brand_model (or isExactMatch) wins and aborts the rest.
 * If no exact within the race window, wait for all finishes and return best similar.
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

  console.log(
    `[ScraperRace] Parallel race start sources=[${runners.map((r) => r.source).join(", ")}] ` +
      `perSourceTimeout=${SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS}ms raceWindow=${SCRAPER_RACE_WINDOW_MS}ms`
  );

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

  const resultToExactCandidate = (
    result: ScraperRunResult
  ): ScraperCandidate | null => {
    if (!result.value || result.aborted) return null;

    const exactCheck = isRaceExactValidation(vision, result.value);
    if (!exactCheck.exact) return null;

    const enriched = {
      ...result.value,
      isExactMatch: true,
      matchType: "exact",
      matchValidation: exactCheck.confidence ?? result.value.matchValidation,
    };
    return toCandidate(vision, { ...result, value: enriched }, scoreFn);
  };

  const promises = runners.map(({ source, run }) => {
    const opts = buildOpts(source);
    const mergedOpts: ScraperRunOptions = {
      ...opts,
      timeoutMs: opts.timeoutMs ?? SCRAPER_RACE_PER_SOURCE_TIMEOUT_MS,
      signal: opts.signal
        ? combineSignals(opts.signal, masterAbort.signal)
        : masterAbort.signal,
    };

    return runScraper(source, run, query, vision, mergedOpts).then((result) => {
      if (result.timedOut) anyTimedOut = true;

      const status = result.aborted
        ? "aborted"
        : result.timedOut
          ? "timeout"
          : result.value
            ? "ok"
            : "empty";
      console.log(
        `[ScraperRace] ${result.source} ${status} in ${result.elapsedMs}ms`
      );

      if (winnerLocked && result.source !== winnerSource) {
        console.log(
          `[ScraperRace] ${result.source} cancelled — winner ${winnerSource} locked`
        );
        return { ...result, aborted: true };
      }

      results.push(result);
      return result;
    });
  });

  const allScrapersDone = Promise.allSettled(promises);

  /** First exact match wins immediately and cancels other scrapers */
  const earlyExactPromise = new Promise<ScraperCandidate | null>((resolve) => {
    let resolved = false;
    const finish = (candidate: ScraperCandidate | null) => {
      if (resolved) return;
      resolved = true;
      resolve(candidate);
    };

    const tryEarlyWin = (result: ScraperRunResult) => {
      if (winnerLocked || !result.value) return;

      const candidate = resultToExactCandidate(result);
      if (!candidate) return;

      winnerLocked = true;
      winnerSource = result.source;
      exactFoundAtMs = Date.now() - raceStart;
      masterAbort.abort();
      console.log(
        `[ScraperRace] WINNER ${result.source} (${candidate.product.matchValidation ?? "exact"}) in ${exactFoundAtMs}ms — cancelling pending scrapers`
      );
      finish(candidate);
    };

    for (const p of promises) {
      p.then(tryEarlyWin).catch(() => {
        /* errors handled in runScraper */
      });
    }

    void allScrapersDone.then(() => finish(null));
  });

  const windowElapsed = new Promise<"window">((resolve) => {
    setTimeout(() => {
      console.log(
        `[ScraperRace] ${SCRAPER_RACE_WINDOW_MS}ms window elapsed — waiting for in-flight scrapers (no discard)`
      );
      resolve("window");
    }, SCRAPER_RACE_WINDOW_MS);
  });

  const earlyExact = await Promise.race([
    earlyExactPromise,
    Promise.race([allScrapersDone, windowElapsed]).then(() => null),
  ]);

  await allScrapersDone;

  if (earlyExact) {
    return {
      exactWinner: earlyExact,
      candidates: [earlyExact],
      anyTimedOut,
      raceElapsedMs: Date.now() - raceStart,
      exactFoundAtMs,
    };
  }

  let exactWinner: ScraperCandidate | null = null;
  for (const result of results) {
    if (result.aborted) continue;
    const candidate = resultToExactCandidate(result);
    if (!candidate) continue;
    exactWinner = candidate;
    exactFoundAtMs = exactFoundAtMs ?? result.elapsedMs;
    console.log(
      `[ScraperRace] Exact match after full wait: ${result.source} in ${result.elapsedMs}ms`
    );
    break;
  }

  if (exactWinner) {
    return {
      exactWinner,
      candidates: [exactWinner],
      anyTimedOut,
      raceElapsedMs: Date.now() - raceStart,
      exactFoundAtMs,
    };
  }

  const candidates: ScraperCandidate[] = [];
  for (const result of results) {
    if (result.aborted) continue;
    const candidate = toCandidate(vision, result, scoreFn);
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    const aExact = a.product.isExactMatch === true ? 1 : 0;
    const bExact = b.product.isExactMatch === true ? 1 : 0;
    if (bExact !== aExact) return bExact - aExact;
    return b.score - a.score;
  });

  if (candidates.length > 0) {
    console.log(
      `[ScraperRace] No exact winner — best similar ${candidates[0].source} score=${candidates[0].score}`
    );
  } else {
    console.log("[ScraperRace] No candidates after race");
  }

  return {
    exactWinner: null,
    candidates,
    anyTimedOut,
    raceElapsedMs: Date.now() - raceStart,
    exactFoundAtMs: null,
  };
}
