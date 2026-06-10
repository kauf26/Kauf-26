import {
  MAX_ADD_PHOTOS_PER_REQUEST,
  MAX_DRAFT_IMAGES,
} from "@shared/draftImages";

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

export function loadInitialDraftImages(capturedImage: string): string[] {
  const images: string[] = [];
  const add = (img: string) => {
    const trimmed = img.trim();
    if (trimmed && !images.includes(trimmed)) images.push(trimmed);
  };

  try {
    const stored = sessionStorage.getItem("identifyCapturedImages");
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        for (const img of parsed) {
          if (typeof img === "string") add(img);
        }
      }
    }
  } catch {
    /* ignore */
  }

  add(capturedImage);
  return images.slice(0, MAX_DRAFT_IMAGES);
}

export function persistDraftImages(images: string[]): void {
  sessionStorage.setItem("identifyCapturedImages", JSON.stringify(images));
}

export async function uploadDraftPhotos(
  draftId: number,
  files: File[]
): Promise<string[]> {
  if (files.length === 0) {
    throw new Error("Select at least one image");
  }
  if (files.length > MAX_ADD_PHOTOS_PER_REQUEST) {
    throw new Error(`Upload at most ${MAX_ADD_PHOTOS_PER_REQUEST} photos at a time`);
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("images", file);
  }

  const res = await fetch(`/api/drafts/${draftId}/upload-photos`, {
    method: "POST",
    body: formData,
  });

  const data = (await res.json()) as { urls?: string[]; error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Upload failed (${res.status})`);
  }
  if (!Array.isArray(data.urls) || data.urls.length === 0) {
    throw new Error("Upload returned no image URLs");
  }
  return data.urls;
}

export async function addPhotosToDraft(
  draftId: number,
  imageUrls: string[]
): Promise<AddPhotosResponse> {
  const res = await fetch(`/api/drafts/${draftId}/add-photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrls }),
  });

  const data = (await res.json()) as AddPhotosResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Add photos failed (${res.status})`);
  }
  return data;
}

export async function saveDraftSnapshot(input: {
  draftId?: number | null;
  title: string;
  images: string[];
  attributes: Record<string, unknown>;
}): Promise<number> {
  const res = await fetch("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.draftId ?? undefined,
      title: input.title,
      status: "draft",
      images: input.images,
      attributes: input.attributes,
    }),
  });

  const saved = (await res.json()) as ProductDraftRecord & { error?: string };
  if (!res.ok || saved.id == null) {
    throw new Error(saved.error ?? `Failed to save draft (${res.status})`);
  }

  sessionStorage.setItem("productDraftId", String(saved.id));
  sessionStorage.setItem("identifyDraftId", String(saved.id));
  return saved.id;
}

export function draftImagesFromRecord(draft: ProductDraftRecord): string[] {
  const fromColumn = Array.isArray(draft.images) ? draft.images : [];
  const attrs = draft.attributes ?? {};
  const captured = typeof attrs.capturedImages === "object" && Array.isArray(attrs.capturedImages)
    ? (attrs.capturedImages as string[])
    : [];
  const merged = [...fromColumn];
  for (const url of captured) {
    if (typeof url === "string" && url.trim() && !merged.includes(url.trim())) {
      merged.push(url.trim());
    }
  }
  return merged.slice(0, MAX_DRAFT_IMAGES);
}
