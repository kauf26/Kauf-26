import { DEFAULT_IDENTIFY_MARKETPLACES } from '../../../shared/identifyFlow';
import { API_BASE_URL } from './config';
import type { IdentifyApiResponse, IdentifyEditPayload } from '../types/identify';

export { DEFAULT_IDENTIFY_MARKETPLACES };

export type IdentifyImageInput = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export function buildIdentifyFormData(
  images: IdentifyImageInput[],
  options?: {
    autoTranslate?: boolean;
    marketplaces?: string[];
    targetLang?: string;
  }
): FormData {
  const formData = new FormData();

  images.forEach((image, index) => {
    const mime = image.mimeType ?? 'image/jpeg';
    const name = image.fileName ?? `angle-${index + 1}.jpg`;
    formData.append('images', {
      uri: image.uri,
      name,
      type: mime,
    } as unknown as Blob);
  });

  if (images.length === 1) {
    const image = images[0];
    formData.append('image', {
      uri: image.uri,
      name: image.fileName ?? 'product.jpg',
      type: image.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
  }

  const autoTranslate = options?.autoTranslate ?? true;
  formData.append('autoTranslate', String(autoTranslate));

  const marketplaces = options?.marketplaces ?? DEFAULT_IDENTIFY_MARKETPLACES;
  formData.append('marketplaces', JSON.stringify(marketplaces));

  if (options?.targetLang?.trim()) {
    formData.append('targetLang', options.targetLang.trim());
  }

  return formData;
}

export async function postIdentify(
  images: IdentifyImageInput | IdentifyImageInput[],
  options?: {
    autoTranslate?: boolean;
    marketplaces?: string[];
    targetLang?: string;
  }
): Promise<IdentifyApiResponse> {
  const imageList = Array.isArray(images) ? images : [images];
  const formData = buildIdentifyFormData(imageList, options);
  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';

  const response = await fetch(`${API_BASE_URL}/api/identify`, {
    method: 'POST',
    headers: {
      'X-Client-Timezone': deviceTz,
    },
    body: formData,
  });

  const body = (await response.json().catch(() => ({}))) as IdentifyApiResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    const detail = body.message || body.error || response.statusText;
    throw new Error(detail || `Identification failed (${response.status})`);
  }

  if (body.success !== true && !body.product?.title) {
    throw new Error(body.message || body.error || 'Could not identify this product.');
  }

  return body;
}

export function mapIdentifyResponseToEditPayload(
  response: IdentifyApiResponse
): IdentifyEditPayload {
  const product = response.product ?? {};
  const attrs = response.draftPreview?.attributes as Record<string, unknown> | undefined;
  const marketPrices = attrs?.marketPrices as Record<string, unknown> | undefined;

  const title =
    String(product.title ?? response.draftPreview?.title ?? '').trim();
  const brand = String(product.brand ?? attrs?.brand ?? '').trim();
  const description = String(
    product.longDescription ?? product.description ?? attrs?.aiDescription ?? ''
  ).trim();
  const price = String(
    product.price ?? product.medianPrice ?? attrs?.recommendedPrice ?? ''
  ).trim();

  return {
    title,
    brand,
    description,
    price,
    category: String(product.category ?? attrs?.category ?? '').trim(),
    condition: String(product.condition ?? attrs?.condition ?? 'Used').trim(),
    material: String(product.material ?? attrs?.material ?? '').trim(),
    color: String(product.color ?? attrs?.color ?? '').trim(),
    model: String(product.model ?? attrs?.model ?? '').trim(),
    requiresManualReview:
      response.requiresManualReview === true ||
      response.fallbackToVision === true ||
      attrs?.requiresManualReview === true ||
      response.draftPreview?.status === 'requires_review',
    priceReliable: response.priceReliable === true || product.priceReliable === true,
    isExactMatch: response.isExactMatch === true || product.isExactMatch === true,
    matchType: String(response.matchType ?? product.matchType ?? 'generic'),
    translation: response.translation ?? null,
    capturedImage: product.capturedImage ?? null,
    capturedImages: Array.isArray(product.capturedImages)
      ? product.capturedImages.filter((u): u is string => typeof u === 'string')
      : product.capturedImage
        ? [product.capturedImage]
        : [],
    verificationMessage: String(
      response.message ??
        (response.requiresManualReview
          ? 'Product identified — please review pricing before posting.'
          : '')
    ).trim() || null,
    draftId:
      response.draftId != null && !Number.isNaN(Number(response.draftId))
        ? Number(response.draftId)
        : null,
    productUrl: String(product.productUrl ?? attrs?.productUrl ?? '').trim(),
    allegroAverage: String(
      product.allegroAvg ?? attrs?.allegroAvg ?? marketPrices?.allegroAvg ?? ''
    ).trim(),
    ebayAverage: String(
      product.ebayAvg ?? attrs?.ebayAvg ?? marketPrices?.ebayAvg ?? ''
    ).trim(),
    raw: response,
  };
}
