import fs from "fs/promises";
import path from "path";
import { db } from "./db";
import { products } from "@shared/schema";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function extractTimestampFromFilename(filename: string): number | null {
  // Filenames are like: image-1770056928355-551870951.jpg
  const match = filename.match(/^image-(\d+)-/);
  if (match) return parseInt(match[1], 10);
  return null;
}

async function getReferencedUploadPaths(): Promise<Set<string>> {
  const rows = await db.select({
    imageUrl: products.imageUrl,
    additionalImages: products.additionalImages,
  }).from(products);

  const referenced = new Set<string>();
  for (const row of rows) {
    if (row.imageUrl) {
      const filename = path.basename(row.imageUrl);
      referenced.add(filename);
    }
    if (row.additionalImages?.length) {
      for (const url of row.additionalImages) {
        if (url) referenced.add(path.basename(url));
      }
    }
  }
  return referenced;
}

export interface CleanupResult {
  scanned: number;
  deleted: number;
  skippedInUse: number;
  skippedTooNew: number;
  errors: number;
  freedBytes: number;
}

export async function cleanupOldImages(dryRun = false): Promise<CleanupResult> {
  const result: CleanupResult = {
    scanned: 0,
    deleted: 0,
    skippedInUse: 0,
    skippedTooNew: 0,
    errors: 0,
    freedBytes: 0,
  };

  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const files = await fs.readdir(UPLOADS_DIR);
    const referenced = await getReferencedUploadPaths();
    const now = Date.now();

    for (const filename of files) {
      result.scanned++;
      const filePath = path.join(UPLOADS_DIR, filename);

      // Skip if still referenced by a product
      if (referenced.has(filename)) {
        result.skippedInUse++;
        continue;
      }

      // Determine age — prefer the timestamp in the filename, fall back to mtime
      let fileAgeMs: number;
      const ts = extractTimestampFromFilename(filename);
      if (ts) {
        fileAgeMs = now - ts;
      } else {
        try {
          const stat = await fs.stat(filePath);
          fileAgeMs = now - stat.mtimeMs;
        } catch {
          result.errors++;
          continue;
        }
      }

      if (fileAgeMs < MAX_AGE_MS) {
        result.skippedTooNew++;
        continue;
      }

      // Safe to delete
      try {
        const stat = await fs.stat(filePath);
        result.freedBytes += stat.size;
        if (!dryRun) {
          await fs.unlink(filePath);
        }
        result.deleted++;
        console.log(`[cleanup] ${dryRun ? "(dry-run) " : ""}Deleted old upload: ${filename} (age: ${Math.round(fileAgeMs / 86400000)}d)`);
      } catch (err: any) {
        console.error(`[cleanup] Error deleting ${filename}:`, err.message);
        result.errors++;
      }
    }
  } catch (err: any) {
    console.error("[cleanup] Error during image cleanup:", err.message);
    result.errors++;
  }

  const freed = (result.freedBytes / 1024 / 1024).toFixed(1);
  console.log(
    `[cleanup] Done — scanned: ${result.scanned}, deleted: ${result.deleted}, ` +
    `in-use: ${result.skippedInUse}, too-new: ${result.skippedTooNew}, ` +
    `errors: ${result.errors}, freed: ${freed} MB${dryRun ? " (dry-run)" : ""}`
  );

  return result;
}

export function scheduleImageCleanup() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24 hours

  // Run once shortly after startup (5 minutes), then every 24h
  const runInitial = setTimeout(async () => {
    console.log("[cleanup] Running initial image cleanup...");
    await cleanupOldImages();
  }, 5 * 60 * 1000);

  const runPeriodic = setInterval(async () => {
    console.log("[cleanup] Running scheduled image cleanup...");
    await cleanupOldImages();
  }, INTERVAL_MS);

  // Allow Node.js to exit cleanly — don't keep process alive just for cleanup
  runInitial.unref();
  runPeriodic.unref();

  console.log("[cleanup] Image cleanup scheduled (every 24h, first run in 5 min)");
}
