import * as FileSystem from 'expo-file-system';
import { DEFAULT_IDENTIFY_MARKETPLACES } from '../../../shared/identifyFlow';
import { API_BASE_URL } from './config';
import { userFacingApiError } from './httpResponse';
import type { IdentifyApiResponse, IdentifyEditPayload } from '../types/identify';

export { DEFAULT_IDENTIFY_MARKETPLACES };

export type IdentifyImageInput = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

async function imageUriToDataUrl(uri: string, mimeType = 'image/jpeg'): Promise<string> {
  const normalized = uri.startsWith('file://') ? uri : uri;
  const base64 = await FileSystem.readAsStringAsync(normalized, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mimeType};base64,${base64}`;
}

/** JSON body — matches server extractIdentifyImages() JSON path (reliable on physical devices). */
async function buildIdentifyJsonBody(
  images: IdentifyImageInput[],
  options?: {
    autoTranslate?: boolean;
    marketplaces?: string[];
    targetLang?: string;
  }
): Promise<string> {
  const dataUrls = await Promise.all(
    images.map((image) =>
      imageUriToDataUrl(image.uri, image.mimeType ?? 'image/jpeg')
    )
  );

  return JSON.stringify({
    images: dataUrls,
    autoTranslate: options?.autoTranslate ?? true,
    marketplaces: options?.marketplaces ?? DEFAULT_IDENTIFY_MARKETPLACES,
    ...(options?.targetLang?.trim() ? { targetLang: options.targetLang.trim() } : {}),
  });
}

function parseIdentifyResponse(
  response: Response,
  body: IdentifyApiResponse & { message?: string; error?: string }
): IdentifyApiResponse {
  if (!response.ok) {
    const detail =
      body.message ||
      body.error ||
      (typeof body === 'object' && body !== null && 'details' in body
        ? String((body as { details?: unknown }).details ?? '')
        : '') ||
      response.statusText;
    throw new Error(detail.trim() || `Identification failed (${response.status})`);
  }

  if (body.success !== true && !body.product?.title) {
    throw new Error(body.message || body.error || 'Could not identify this product.');
  }

  return body;
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
  if (imageList.length === 0) {
    throw new Error('No images to identify.');
  }

  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const url = `${API_BASE_URL}/api/identify`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Timezone': deviceTz,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: await buildIdentifyJsonBody(imageList, options),
    });

    const body = (await response.json().catch(() => ({}))) as IdentifyApiResponse & {
      message?: string;
      error?: string;
    };

    return parseIdentifyResponse(response, body);
  } catch (error) {
    throw new Error(
      userFacingApiError(
        error,
        `Could not reach the identify API at ${url}. On a physical device, set EXPO_PUBLIC_API_URL to http://YOUR_MAC_LAN_IP:2626 in mobile/.env and run npx expo start --clear.`
      )
    );
  }
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
