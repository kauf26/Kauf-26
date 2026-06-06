/**
 * Multi-image vision phase — parallel OpenAI calls, merge, then scraper.
 * Invoked from the identify queue job handler in index.ts before scraping.
 */

import type { IdentifyImageInput } from "./identifyImages";
import type { IdentifyJobData } from "./identifyQueue";
import {
  buildScraperSearchQuery,
  logVisionMergeSources,
  mergeVisionResults,
  type VisionPerImage,
  type VisionProduct,
  type VisionSources,
} from "./visionMerge";

export type VisionPhaseResult = {
  perImage: VisionPerImage[];
  vision: VisionProduct;
  sources: VisionSources;
  primaryImageIndex: number;
  searchQuery: string;
};

export class VisionIdentifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisionIdentifyError";
  }
}

/**
 * Run vision on every image concurrently, merge votes, return aggregated profile.
 * Scraper must only start after this resolves.
 */
export async function runVisionPhase(
  jobData: IdentifyJobData,
  analyzeImage: (
    image: IdentifyImageInput,
    index: number
  ) => Promise<VisionPerImage | null>
): Promise<VisionPhaseResult> {
  console.log(
    `[IdentifyVision] Processing ${jobData.images.length} image(s) in parallel...`
  );

  const visionResults = await Promise.all(
    jobData.images.map((image, index) => analyzeImage(image, index))
  );

  const perImage = visionResults.filter(
    (result): result is VisionPerImage => result != null
  );

  if (perImage.length === 0) {
    throw new VisionIdentifyError(
      "Could not identify product from any image"
    );
  }

  const { vision, sources, primaryImageIndex } = mergeVisionResults(perImage);
  logVisionMergeSources(perImage, sources, vision, primaryImageIndex);

  const searchQuery = buildScraperSearchQuery(vision);
  console.log(
    `[IdentifyVision] Aggregated search query: "${searchQuery}" (brand="${vision.brand ?? ""}" model="${vision.model ?? ""}")`
  );

  return {
    perImage,
    vision,
    sources,
    primaryImageIndex,
    searchQuery,
  };
}
