import type { VisionMatchContext } from "./listingUtils";

export const scrapeProduct = async (
  query: string,
  _context?: VisionMatchContext
): Promise<Record<string, unknown> | null> => {
  try {
    const user = process.env.OXYLABS_USERNAME?.trim();
    const pass = process.env.OXYLABS_PASSWORD?.trim();
    if (!user || !pass) {
      console.warn("[Oxylabs] OXYLABS_USERNAME/PASSWORD missing — skipping");
      return null;
    }

    console.log(`[Oxylabs] Searching for "${query}"...`);

    // TODO: wire real Oxylabs Realtime / Scraper API here
    console.warn("[Oxylabs] API client not implemented — skipping");
    return null;
  } catch (error) {
    console.error("❌ Oxylabs Error:", error);
    return null;
  }
};
