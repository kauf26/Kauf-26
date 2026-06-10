import React, { useCallback, useRef, useState } from "react";
import {
  MAX_ADD_PHOTOS_PER_REQUEST,
  MAX_DRAFT_IMAGES,
} from "@shared/draftImages";
import {
  addPhotosToDraft,
  draftImagesFromRecord,
  persistDraftImages,
  uploadDraftPhotos,
  type AddPhotosResponse,
} from "@/lib/draftPhotos";

type DraftPhotoGalleryProps = {
  draftId: number | null;
  images: string[];
  onImagesChange: (images: string[]) => void;
  onDraftId?: (id: number) => void;
  ensureDraftId: () => Promise<number>;
  disabled?: boolean;
};

export default function DraftPhotoGallery({
  draftId,
  images,
  onImagesChange,
  onDraftId,
  ensureDraftId,
  disabled = false,
}: DraftPhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_DRAFT_IMAGES - images.length;
  const canAdd = remaining > 0 && !disabled && !isUploading;

  const applyAddPhotosResult = useCallback(
    (result: AddPhotosResponse) => {
      const next = draftImagesFromRecord(result.draft);
      onImagesChange(next);
      persistDraftImages(next);
      if (result.draft.id != null) {
        onDraftId?.(result.draft.id);
      }
    },
    [onDraftId, onImagesChange]
  );

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) {
        setError("Choose image files (JPEG, PNG, WebP, or GIF)");
        return;
      }

      if (remaining <= 0) {
        setError(`Maximum ${MAX_DRAFT_IMAGES} photos reached`);
        return;
      }

      const batch = files.slice(0, Math.min(MAX_ADD_PHOTOS_PER_REQUEST, remaining));
      const previousImages = images;

      setError(null);
      setIsUploading(true);

      try {
        const id = draftId ?? (await ensureDraftId());
        if (draftId == null) {
          onDraftId?.(id);
        }

        const uploadedUrls = await uploadDraftPhotos(id, batch);
        const result = await addPhotosToDraft(id, uploadedUrls);
        applyAddPhotosResult(result);
      } catch (err) {
        onImagesChange(previousImages);
        setError(err instanceof Error ? err.message : "Failed to add photos");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [
      applyAddPhotosResult,
      draftId,
      ensureDraftId,
      images,
      onDraftId,
      onImagesChange,
      remaining,
    ]
  );

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!canAdd) return;
    void processFiles(event.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-400 uppercase">
          Product Photos
        </h3>
        <span className="text-xs text-zinc-500">
          {images.length}/{MAX_DRAFT_IMAGES}
        </span>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative aspect-square overflow-hidden rounded border border-zinc-800 bg-zinc-950"
            >
              <img
                src={url}
                alt={index === 0 ? "Primary product photo" : `Product photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {index === 0 && (
                <span className="absolute left-1 top-1 rounded bg-zinc-900/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[120px] items-center justify-center rounded border border-dashed border-zinc-700 bg-zinc-950 text-xs text-zinc-600">
          No photos yet
        </div>
      )}

      <div
        className={`rounded-lg border border-dashed p-4 text-center transition-colors ${
          isDragging ? "border-blue-500 bg-blue-950/20" : "border-zinc-700 bg-zinc-950/50"
        } ${!canAdd ? "opacity-60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (canAdd) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <p className="text-xs text-zinc-500 mb-3">
          Drag and drop up to {Math.min(MAX_ADD_PHOTOS_PER_REQUEST, remaining)} image
          {Math.min(MAX_ADD_PHOTOS_PER_REQUEST, remaining) === 1 ? "" : "s"} here, or choose
          from your device.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          disabled={!canAdd}
          onChange={(e) => {
            if (e.target.files?.length) {
              void processFiles(e.target.files);
            }
          }}
        />
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "Add Photos"}
        </button>
        {remaining <= 0 && (
          <p className="mt-2 text-xs text-amber-400/90">
            Maximum {MAX_DRAFT_IMAGES} photos reached.
          </p>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
