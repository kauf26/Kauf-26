import {
  MAX_ADD_PHOTOS_PER_REQUEST,
  MAX_DRAFT_IMAGES,
} from '../../../shared/draftImages';
import { API_BASE_URL } from './config';

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

  const data = (await res.json()) as { urls?: string[]; error?: string };
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

  const data = (await res.json()) as AddPhotosResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Add photos failed (${res.status})`);
  }
  return data;
}

export async function saveDraftSnapshotMobile(input: {
  draftId?: number | null;
  title: string;
  images: string[];
  attributes: Record<string, unknown>;
}): Promise<number> {
  const res = await fetch(`${API_BASE_URL}/api/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      id: input.draftId ?? undefined,
      title: input.title,
      status: 'draft',
      images: input.images,
      attributes: input.attributes,
    }),
  });

  const saved = (await res.json()) as ProductDraftRecord & { error?: string };
  if (!res.ok || saved.id == null) {
    throw new Error(saved.error ?? `Failed to save draft (${res.status})`);
  }
  return saved.id;
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
