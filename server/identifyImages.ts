import type { Request } from "express";

export const MAX_IDENTIFY_IMAGES = 5;

export type IdentifyImageInput = {
  buffer: Buffer;
  mimetype: string;
};

function dataUrlToImageBuffer(
  dataUrl: string
): IdentifyImageInput | null {
  const trimmed = dataUrl.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    return {
      mimetype: match[1] || "image/jpeg",
      buffer: Buffer.from(match[2], "base64"),
    };
  }
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) {
    return {
      mimetype: "image/jpeg",
      buffer: Buffer.from(trimmed.replace(/\s/g, ""), "base64"),
    };
  }
  return null;
}

/** Parse multipart (`image` / `images[]`) or JSON (`image` / `images[]`) from the request. */
export function extractIdentifyImages(req: Request): IdentifyImageInput[] {
  const files = req.files as
    | {
        image?: Express.Multer.File[];
        images?: Express.Multer.File[];
      }
    | undefined;

  const fromMulter: IdentifyImageInput[] = [];
  if (files?.images?.length) {
    for (const file of files.images) {
      fromMulter.push({
        buffer: file.buffer,
        mimetype: file.mimetype || "image/jpeg",
      });
    }
  } else if (files?.image?.[0]) {
    fromMulter.push({
      buffer: files.image[0].buffer,
      mimetype: files.image[0].mimetype || "image/jpeg",
    });
  }

  if (fromMulter.length > 0) {
    return fromMulter.slice(0, MAX_IDENTIFY_IMAGES);
  }

  const body = req.body as { image?: string; images?: string[] };
  if (Array.isArray(body.images)) {
    const parsed = body.images
      .slice(0, MAX_IDENTIFY_IMAGES)
      .map((entry) => dataUrlToImageBuffer(String(entry ?? "")))
      .filter((entry): entry is IdentifyImageInput => entry != null);
    if (parsed.length > 0) return parsed;
  }
  if (body.image) {
    const single = dataUrlToImageBuffer(String(body.image));
    return single ? [single] : [];
  }
  return [];
}

export function toDataUrl(image: IdentifyImageInput): string {
  const mime = image.mimetype || "image/jpeg";
  return `data:${mime};base64,${image.buffer.toString("base64")}`;
}

function parseBooleanField(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "on";
}

function parseMarketplaceIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id).trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((id) => String(id).trim()).filter(Boolean);
        }
      } catch {
        /* fall through to comma split */
      }
    }
    return trimmed
      .split(/[,;]/)
      .map((id) => id.trim())
      .filter(Boolean);
  }
  return [];
}

/** Parse optional identify options from multipart fields or JSON body. */
export function parseIdentifyOptions(req: Request): {
  marketplaceIds: string[];
  autoTranslate: boolean;
  targetLang?: string;
} {
  const body = req.body as Record<string, unknown>;
  const marketplaceIds = parseMarketplaceIds(
    body.marketplaces ?? body.marketplace ?? body.marketplaceIds
  );
  const autoTranslate = parseBooleanField(
    body.autoTranslate ?? body.auto_translate
  );
  const targetLang =
    typeof body.targetLang === "string"
      ? body.targetLang.trim()
      : typeof body.target_lang === "string"
        ? body.target_lang.trim()
        : undefined;

  return { marketplaceIds, autoTranslate, targetLang };
}
