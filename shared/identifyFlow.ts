/** Shared identify → draft decision logic (web ProductCamera + mobile IdentifyScreen). */

export const DEFAULT_IDENTIFY_MARKETPLACES = ['ebay'] as const;

export type IdentifyFlowProduct = {
  title?: string;
  price?: string | number;
  priceReliable?: boolean;
  isExactMatch?: boolean;
  matchType?: string;
};

export type IdentifyFlowResponse = {
  success?: boolean;
  draftId?: number | string | null;
  requiresManualReview?: boolean;
  fallbackToVision?: boolean;
  isExactMatch?: boolean;
  matchType?: string;
  priceReliable?: boolean;
  product?: IdentifyFlowProduct;
};

export function isExactMatchResult(result: IdentifyFlowResponse): boolean {
  const matchType = result.matchType ?? result.product?.matchType;
  return (
    result.isExactMatch === true ||
    result.product?.isExactMatch === true ||
    matchType === 'exact'
  );
}

export function shouldProceedToDraft(result: IdentifyFlowResponse): boolean {
  if (result.success === true && result.draftId != null) return true;
  if (result.requiresManualReview === true) return true;
  if (result.fallbackToVision === true) return true;
  if (isExactMatchResult(result)) return true;
  const p = result.product;
  if (!p) return false;
  const price = parseFloat(String(p.price ?? 0));
  const reliable = result.priceReliable === true || p.priceReliable === true;
  const matchType = result.matchType ?? p.matchType;
  return (
    (matchType === 'similar' || matchType === 'exact') &&
    price > 0 &&
    reliable
  );
}

export function resolveVerificationMessage(
  result: IdentifyFlowResponse & { message?: string; verificationWarning?: string | null }
): string | null {
  if (result.verificationWarning?.trim()) return result.verificationWarning.trim();
  if (result.requiresManualReview && result.message?.trim()) return result.message.trim();
  if (result.message?.trim()) return result.message.trim();
  if (result.requiresManualReview) {
    return 'Product identified — please review pricing before posting.';
  }
  return null;
}
