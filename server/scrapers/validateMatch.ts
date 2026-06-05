/**
 * Listing ↔ vision target validation (reference, brand+model).
 */
import { brandJaccard } from "./listingUtils";
import type { VisionMatchContext } from "./listingUtils";
import {
  extractReferenceNumbers,
  normalizeText,
  significantTokens,
} from "./visionMatch";

export type MatchConfidence =
  | "high_reference"
  | "exact_brand_model"
  | "hierarchical"
  | "low";

export type MatchTarget = {
  brand: string;
  modelTokens: string[];
  targetRef: string[];
};

export type ListingRow = {
  title?: string;
  brand?: string;
  description?: string;
  url?: string;
};

export type MatchValidation = {
  accepted: boolean;
  confidence: MatchConfidence;
  reason: string;
};

const EXACT_CONFIDENCES = new Set<MatchConfidence>([
  "high_reference",
  "exact_brand_model",
]);

function modelTokensFromTitle(visionTitle: string, brand: string): string[] {
  const brandNorm = normalizeText(brand);
  return significantTokens(visionTitle, brand).filter(
    (t) => t !== brandNorm && t.length >= 3
  );
}

function brandMatchPct(targetBrand: string, listing: ListingRow): number {
  const tb = targetBrand.trim();
  if (!tb) return 0;
  const listingBrand = String(listing.brand ?? "").trim();
  const blob = `${listing.title ?? ""} ${listing.description ?? ""}`;
  if (listingBrand) {
    const j = brandJaccard(tb, listingBrand);
    if (j >= 1) return 100;
    if (j >= 0.8) return Math.round(j * 100);
  }
  const normBlob = normalizeText(blob);
  const tokens = tb
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (tokens.length === 0) return normBlob.includes(normalizeText(tb)) ? 100 : 0;
  const hits = tokens.filter((t) => normBlob.includes(t)).length;
  return Math.round((hits / tokens.length) * 100);
}

function modelMatchPct(
  modelTokens: string[],
  listing: ListingRow
): number {
  if (modelTokens.length === 0) return 100;
  const blob = normalizeText(
    `${listing.title ?? ""} ${listing.brand ?? ""} ${listing.description ?? ""}`
  );
  const hits = modelTokens.filter((t) => blob.includes(t)).length;
  return Math.round((hits / modelTokens.length) * 100);
}

function referenceMatchPct(
  targetRef: string[],
  listing: ListingRow
): number {
  if (targetRef.length === 0) return 100;
  const blob = normalizeText(
    `${listing.title ?? ""} ${listing.description ?? ""}`
  );
  const hits = targetRef.filter((ref) => {
    const r = ref.replace(/\s+/g, "").toLowerCase();
    return r.length >= 4 && blob.includes(r);
  }).length;
  return Math.round((hits / targetRef.length) * 100);
}

export function buildMatchTargetFromContext(
  ctx: VisionMatchContext
): MatchTarget {
  const visionTitle = String(ctx.visionTitle ?? "").trim();
  let brand = String(ctx.visionBrand ?? "").trim();
  if (!brand && visionTitle) {
    const parts = visionTitle.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) brand = parts[0];
  }
  const targetRef =
    ctx.modelNumbers?.length
      ? ctx.modelNumbers.map((r) => r.toLowerCase())
      : extractReferenceNumbers(visionTitle).map((r) => r.toLowerCase());

  return {
    brand,
    modelTokens: modelTokensFromTitle(visionTitle, brand),
    targetRef,
  };
}

export function validateMatch(
  listing: ListingRow,
  target: MatchTarget
): MatchValidation {
  const title = String(listing.title ?? "").trim();
  if (!title) {
    const reason = "missing_title";
    console.log(`[validateMatch] REJECT ${reason}`);
    return { accepted: false, confidence: "low", reason };
  }

  const brandPct = brandMatchPct(target.brand, listing);
  const modelPct = modelMatchPct(target.modelTokens, listing);
  const refPct = referenceMatchPct(target.targetRef, listing);

  const hasRefs = target.targetRef.length > 0;

  if (hasRefs && refPct >= 100) {
    const reason = `high_reference refPct=${refPct}`;
    console.log(`[validateMatch] ACCEPT ${reason} title="${title.slice(0, 80)}"`);
    return { accepted: true, confidence: "high_reference", reason };
  }

  if (!hasRefs && brandPct >= 100 && modelPct >= 100) {
    const reason = `exact_brand_model brandPct=${brandPct} modelPct=${modelPct} targetRef=[]`;
    console.log(`[validateMatch] ACCEPT ${reason} title="${title.slice(0, 80)}"`);
    return { accepted: true, confidence: "exact_brand_model", reason };
  }

  if (brandPct >= 100 && modelPct >= 100 && refPct >= 100) {
    const reason = `exact_brand_model brandPct=${brandPct} modelPct=${modelPct}`;
    console.log(`[validateMatch] ACCEPT ${reason} title="${title.slice(0, 80)}"`);
    return { accepted: true, confidence: "exact_brand_model", reason };
  }

  if (brandPct >= 70 && modelPct >= 50) {
    const reason = `hierarchical brandPct=${brandPct} modelPct=${modelPct} refPct=${refPct}`;
    console.log(`[validateMatch] ACCEPT ${reason} title="${title.slice(0, 80)}"`);
    return { accepted: true, confidence: "hierarchical", reason };
  }

  const reason = `low brandPct=${brandPct} modelPct=${modelPct} refPct=${refPct} targetRef=${target.targetRef.length}`;
  console.log(`[validateMatch] REJECT ${reason} title="${title.slice(0, 80)}"`);
  return { accepted: false, confidence: "low", reason };
}

export function isExactValidation(confidence: MatchConfidence): boolean {
  return EXACT_CONFIDENCES.has(confidence);
}

export function applyValidationToProduct(
  product: Record<string, unknown>,
  validation: MatchValidation
): Record<string, unknown> {
  if (!validation.accepted || !isExactValidation(validation.confidence)) {
    return product;
  }
  return {
    ...product,
    isExactMatch: true,
    matchType: "exact",
    matchValidation: validation.confidence,
  };
}
