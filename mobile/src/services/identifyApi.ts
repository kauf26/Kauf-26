import * as FileSystem from 'expo-file-system';
import { DEFAULT_IDENTIFY_MARKETPLACES } from '../../../shared/identifyFlow';
import { API_BASE_URL } from './config';
import {
  ApiResponseError,
  readResponseBody,
  userFacingApiError,
} from './httpResponse';
import { assertApiReachable } from './apiHealth';
import { compressImageForUpload } from './imageCompress';
import type { IdentifyApiResponse, IdentifyEditPayload } from '../types/identify';

export { DEFAULT_IDENTIFY_MARKETPLACES };

/** Server route is lowercase only: POST /api/identify */
export const IDENTIFY_API_PATH = '/api/identify';

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

function logIdentifyFailure(context: {
  url: string;
  status: number;
  contentType: string;
  bodyPreview: string;
  error: unknown;
}): void {
  console.error('[Kauf26][identify] request failed', {
    url: context.url,
    status: context.status,
    contentType: context.contentType,
    bodyPreview: context.bodyPreview.slice(0, 300),
    error:
      context.error instanceof Error
        ? { name: context.error.name, message: context.error.message }
        : context.error,
  });
}

function identifyErrorMessage(
  status: number,
  body: { message?: string; error?: string },
  url: string
): string {
  if (status === 413) {
    return (
      'Image upload too large for the server (HTTP 413). ' +
      'Try fewer photos or retake at lower resolution. ' +
      'If this persists, restart the API server after pulling latest changes.'
    );
  }
  if (status === 400) {
    return (
      body.message ||
      body.error ||
      'Invalid identify request — check that images were captured correctly.'
    );
  }
  if (status === 0) {
    return `Could not reach the identify API at ${url}. Same Wi‑Fi as your Mac? Is npm run server running?`;
  }
  const detail = body.message || body.error || `Identification failed (HTTP ${status})`;
  return detail.trim();
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
  const compressed = await Promise.all(
    images.map(async (image) => {
      const out = await compressImageForUpload(image.uri, image.mimeType ?? 'image/jpeg');
      return imageUriToDataUrl(out.uri, out.mimeType);
    })
  );

  return JSON.stringify({
    images: compressed,
    autoTranslate: options?.autoTranslate ?? true,
    marketplaces: options?.marketplaces ?? DEFAULT_IDENTIFY_MARKETPLACES,
    ...(options?.targetLang?.trim() ? { targetLang: options.targetLang.trim() } : {}),
  });
}

function parseIdentifyResponse(
  response: Response,
  body: IdentifyApiResponse & { message?: string; error?: string },
  url: string
): IdentifyApiResponse {
  if (!response.ok) {
    throw new ApiResponseError(identifyErrorMessage(response.status, body, url), {
      status: response.status,
      bodyPreview: JSON.stringify(body).slice(0, 200),
      url,
    });
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
    /** Skip pre-flight health check (tests only). */
    skipHealthCheck?: boolean;
  }
): Promise<IdentifyApiResponse> {
  const imageList = Array.isArray(images) ? images : [images];
  if (imageList.length === 0) {
    throw new Error('No images to identify.');
  }

  if (!options?.skipHealthCheck) {
    await assertApiReachable();
  }

  const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const url = `${API_BASE_URL}${IDENTIFY_API_PATH}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Timezone': deviceTz,
  };

  try {
    const bodyString = await buildIdentifyJsonBody(imageList, options);
    if (__DEV__) {
      console.log(
        `[Kauf26][identify] POST ${url} payload ~${Math.round(bodyString.length / 1024)}KB`
      );
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: bodyString,
    });

    const bodyText = await readResponseBody(response);
    const contentType = response.headers.get('content-type') ?? '';

    let body: IdentifyApiResponse & { message?: string; error?: string };
    try {
      body = JSON.parse(bodyText) as IdentifyApiResponse & {
        message?: string;
        error?: string;
      };
    } catch {
      logIdentifyFailure({
        url,
        status: response.status,
        contentType,
        bodyPreview: bodyText,
        error: new Error('Non-JSON response'),
      });
      if (bodyText.trimStart().startsWith('<')) {
        throw new ApiResponseError(
          `Server returned HTML instead of JSON at ${url}. Wrong API URL or server not running.`,
          { status: response.status, isHtmlResponse: true, bodyPreview: bodyText.slice(0, 200), url }
        );
      }
      throw new ApiResponseError(
        `Invalid JSON from identify API (HTTP ${response.status}).`,
        { status: response.status, bodyPreview: bodyText.slice(0, 200), url }
      );
    }

    try {
      return parseIdentifyResponse(response, body, url);
    } catch (error) {
      logIdentifyFailure({
        url,
        status: response.status,
        contentType,
        bodyPreview: bodyText,
        error,
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof ApiResponseError) {
      throw error;
    }
    logIdentifyFailure({
      url,
      status: 0,
      contentType: '',
      bodyPreview: '',
      error,
    });
    throw new Error(
      userFacingApiError(
        error,
        `Could not reach the identify API at ${url}. On a physical device, set EXPO_PUBLIC_API_URL to http://YOUR_MAC_LAN_IP:2626 in mobile/.env and rebuild with eas build --profile preview.`
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
