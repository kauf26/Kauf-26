import {
  MAX_ADD_PHOTOS_PER_REQUEST,
  MAX_DRAFT_IMAGES,
} from '../../../shared/draftImages';
import { API_BASE_URL } from './config';
import { fetchJson, parseJsonResponse, ApiResponseError } from './httpResponse';

export { MAX_ADD_PHOTOS_PER_REQUEST, MAX_DRAFT_IMAGES };

export type ProductDraftRecord = {
  id: number;
  title: string;
  images?: string[] | null;
  attributes?: Record<string, unknown> | null;
};

export type AddPhotosResponse = {
  draft: ProductDraftRecord;
  added: string[];
  duplicates: string[];
  imageCount: number;
};

export async function uploadDraftPhotosMobile(
  draftId: number,
  assets: { uri: string; mimeType?: string | null; fileName?: string | null }[]
): Promise<string[]> {
  if (assets.length === 0) {
    throw new Error('Select at least one image');
  }
  if (assets.length > MAX_ADD_PHOTOS_PER_REQUEST) {
    throw new Error(`Upload at most ${MAX_ADD_PHOTOS_PER_REQUEST} photos at a time`);
  }

  const formData = new FormData();
  for (const asset of assets) {
    const name = asset.fileName ?? `photo-${Date.now()}.jpg`;
    const type = asset.mimeType ?? 'image/jpeg';
    formData.append('images', {
      uri: asset.uri,
      name,
      type,
    } as unknown as Blob);
  }

  const res = await fetch(`${API_BASE_URL}/api/drafts/${draftId}/upload-photos`, {
    method: 'POST',
    body: formData,
    headers: {
      Accept: 'application/json',
    },
  });

  const data = await parseJsonResponse<{ urls?: string[]; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  if (!Array.isArray(data.urls) || data.urls.length === 0) {
    throw new Error('Upload returned no image URLs');
  }
  return data.urls;
}

export async function addPhotosToDraftMobile(
  draftId: number,
  imageUrls: string[]
): Promise<AddPhotosResponse> {
  const res = await fetch(`${API_BASE_URL}/api/drafts/${draftId}/add-photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ imageUrls }),
  });

  const data = await parseJsonResponse<AddPhotosResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? `Add photos failed (${res.status})`);
  }
  return data;
}

export type SaveDraftSnapshotInput = {
  draftId?: number | null;
  title: string;
  images: string[];
  attributes: Record<string, unknown>;
};

export async function saveDraftSnapshotMobile(
  input: SaveDraftSnapshotInput
): Promise<ProductDraftRecord> {
  try {
    const { data: saved, response: res } = await fetchJson<
      ProductDraftRecord & { error?: string }
    >(
      `${API_BASE_URL}/api/drafts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          id: input.draftId ?? undefined,
          title: input.title,
          status: 'draft',
          images: input.images,
          attributes: input.attributes,
        }),
      },
      { retries: 1, retryDelayMs: 600 }
    );

    if (res.status === 413) {
      throw new Error('PayloadTooLarge');
    }
    if (saved.error) {
      throw new Error(saved.error);
    }
    if (!res.ok || saved.id == null) {
      throw new Error(saved.error ?? `Failed to save draft (${res.status})`);
    }
    return saved;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (
      message.includes('413') ||
      message.includes('PayloadTooLarge') ||
      (err instanceof ApiResponseError && err.status === 413)
    ) {
      throw new Error('Draft too large (over 50MB). Use smaller images.');
    }
    if (
      message.includes('HTML') ||
      message.includes('Expected JSON') ||
      (err instanceof ApiResponseError && err.isHtmlResponse) ||
      err instanceof TypeError ||
      (err instanceof ApiResponseError && err.isNetworkError)
    ) {
      throw new Error(
        'Server error – unable to save draft. Check connection or login status.'
      );
    }

    // @ts-ignore - __DEV__ is defined by React Native
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[saveDraftSnapshotMobile]', err);
    }
    throw new Error(`Failed to save draft: ${message}`);
  }
}

export function draftImagesFromRecord(draft: ProductDraftRecord): string[] {
  const fromColumn = Array.isArray(draft.images) ? draft.images : [];
  const attrs = draft.attributes ?? {};
  const captured =
    typeof attrs.capturedImages === 'object' && Array.isArray(attrs.capturedImages)
      ? (attrs.capturedImages as string[])
      : [];
  const merged = [...fromColumn];
  for (const url of captured) {
    if (typeof url === 'string' && url.trim() && !merged.includes(url.trim())) {
      merged.push(url.trim());
    }
  }
  return merged.slice(0, MAX_DRAFT_IMAGES);
}
