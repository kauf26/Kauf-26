import { queryClient } from "./queryClient";
import { clearListingSession } from "./pendingAnalysis";
import { clearProductsFetchCache } from "./productsFetch";

export const WELCOME_RESET_EVENT = "kauf26:welcome-reset";

const PROTECTED_SESSION_KEYS = new Set([
  "authenticated",
  "kauf26_dismissedShippingAlerts",
]);

const LISTING_SESSION_PREFIXES = [
  "pending",
  "product",
  "identify",
  "publish",
  "selected",
  "scrape",
  "listing",
];

function clearListingRelatedSessionStorage(): void {
  clearListingSession();

  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (!key || PROTECTED_SESSION_KEYS.has(key)) continue;
    const lower = key.toLowerCase();
    if (LISTING_SESSION_PREFIXES.some((prefix) => lower.includes(prefix))) {
      sessionStorage.removeItem(key);
    }
  }
}

function clearListingQueryCache(): void {
  queryClient.removeQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key.length === 0) return false;
      const head = String(key[0]).toLowerCase();
      return (
        head.includes("draft") ||
        head.includes("product") ||
        head.includes("scrape") ||
        head.includes("identify")
      );
    },
  });
}

export type ResetListingFlowOptions = {
  clearDraftContext?: () => void;
};

/** Wipe in-progress listing state before starting a new product from scratch. */
export function resetListingFlow(options: ResetListingFlowOptions = {}): void {
  clearListingRelatedSessionStorage();
  clearProductsFetchCache();
  clearListingQueryCache();
  options.clearDraftContext?.();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WELCOME_RESET_EVENT));
  }
}

/** Re-mount camera/scrape UI when the welcome page loads. */
export function initializeWelcomePage(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WELCOME_RESET_EVENT));
  }
}
