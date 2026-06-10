import fs from "fs/promises";
import path from "path";
import type { Request } from "express";
import multer from "multer";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function publicUploadUrl(filename: string): string {
  const base = (
    process.env.APP_BASE_URL ||
    process.env.CLIENT_URL ||
    `http://localhost:${process.env.PORT ?? 3000}`
  ).replace(/\/$/, "");
  return `${base}/uploads/${filename}`;
}

export function relativeUploadPath(filename: string): string {
  return `/uploads/${filename}`;
}

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".jpg";
    cb(null, `draft-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
}

/** Multer middleware — up to 5 images per upload request. */
export const draftPhotoUpload = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: 12 * 1024 * 1024, files: 5 },
});

export async function ensureUploadsDir(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export function filesToPublicUrls(files: Express.Multer.File[]): string[] {
  return files.map((f) => publicUploadUrl(f.filename));
}
