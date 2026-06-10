import type { IdentifyImageInput } from "../identifyImages";

export type ImageQualityReport = {
  ok: boolean;
  width: number;
  height: number;
  brightness: number;
  sharpness: number;
  qualityScore: number;
  error?: string;
  preprocessing: string[];
};

export type PreparedIdentifyImage = {
  image: IdentifyImageInput;
  quality: ImageQualityReport;
};

const MIN_WIDTH = 320;
const MIN_HEIGHT = 320;
const MIN_BRIGHTNESS = 28;
const MAX_BRIGHTNESS = 245;
const MIN_SHARPNESS = 8;
const MIN_QUALITY_SCORE = 45;

const USER_QUALITY_ERROR =
  "Image too blurry/dark – please upload a clearer photo.";

type SharpModule = typeof import("sharp");

async function loadSharp(): Promise<SharpModule | null> {
  try {
    const mod = await import("sharp");
    return mod.default as unknown as SharpModule;
  } catch {
    return null;
  }
}

function computeSharpnessScore(data: Uint8Array, width: number, height: number): number {
  if (width < 2 || height < 2 || data.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const idx = y * width + x;
      const current = data[idx] ?? 0;
      const right = data[idx + 1] ?? 0;
      const down = data[idx + width] ?? 0;
      sum += Math.abs(current - right) + Math.abs(current - down);
      count += 2;
    }
  }
  return count > 0 ? sum / count : 0;
}

function buildQualityScore(
  width: number,
  height: number,
  brightness: number,
  sharpness: number
): number {
  const resolutionScore = Math.min(100, ((width * height) / (640 * 480)) * 100);
  const brightnessScore =
    brightness >= MIN_BRIGHTNESS && brightness <= MAX_BRIGHTNESS
      ? 100
      : Math.max(0, 100 - Math.abs(brightness - 128) * 0.8);
  const sharpnessScore = Math.min(100, (sharpness / 24) * 100);
  return Math.round(resolutionScore * 0.35 + brightnessScore * 0.25 + sharpnessScore * 0.4);
}

/** Assess resolution, brightness, and sharpness before vision API calls. */
export async function assessImageQuality(
  buffer: Buffer
): Promise<ImageQualityReport> {
  const preprocessing: string[] = [];
  const sharp = await loadSharp();

  if (!sharp) {
    preprocessing.push("sharp_unavailable_basic_check");
    if (buffer.length < 12_000) {
      return {
        ok: false,
        width: 0,
        height: 0,
        brightness: 0,
        sharpness: 0,
        qualityScore: 0,
        error: USER_QUALITY_ERROR,
        preprocessing,
      };
    }
    return {
      ok: true,
      width: 0,
      height: 0,
      brightness: 128,
      sharpness: 12,
      qualityScore: 60,
      preprocessing,
    };
  }

  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  preprocessing.push("metadata_read");

  const stats = await sharp(buffer).stats();
  const brightness = stats.channels[0]?.mean ?? 0;

  const { data, info } = await sharp(buffer)
    .greyscale()
    .resize({ width: Math.min(width, 512), withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const sharpness = computeSharpnessScore(
    new Uint8Array(data),
    info.width,
    info.height
  );
  const qualityScore = buildQualityScore(width, height, brightness, sharpness);

  const tooSmall = width < MIN_WIDTH || height < MIN_HEIGHT;
  const tooDark = brightness < MIN_BRIGHTNESS;
  const tooBright = brightness > MAX_BRIGHTNESS;
  const tooBlurry = sharpness < MIN_SHARPNESS || qualityScore < MIN_QUALITY_SCORE;

  if (tooSmall || tooDark || tooBright || tooBlurry) {
    return {
      ok: false,
      width,
      height,
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness * 10) / 10,
      qualityScore,
      error: USER_QUALITY_ERROR,
      preprocessing,
    };
  }

  return {
    ok: true,
    width,
    height,
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness * 10) / 10,
    qualityScore,
    preprocessing,
  };
}

/** Optional sharpen + normalize for low-contrast images. */
export async function enhanceImageForVision(
  buffer: Buffer,
  brightness: number
): Promise<{ buffer: Buffer; steps: string[] }> {
  const steps: string[] = [];
  const sharp = await loadSharp();
  if (!sharp) {
    return { buffer, steps: ["enhancement_skipped_no_sharp"] };
  }

  let pipeline = sharp(buffer);
  steps.push("normalize_format");

  if (brightness < 55) {
    pipeline = pipeline.modulate({ brightness: 1.12 }).normalize();
    steps.push("brightness_boost", "normalize_contrast");
  } else if (brightness > 210) {
    pipeline = pipeline.modulate({ brightness: 0.92 });
    steps.push("brightness_reduce");
  }

  pipeline = pipeline.sharpen({ sigma: 0.8 });
  steps.push("sharpen");

  const out = await pipeline.jpeg({ quality: 92 }).toBuffer();
  return { buffer: out, steps };
}

export async function prepareImageForVision(
  image: IdentifyImageInput
): Promise<PreparedIdentifyImage> {
  let quality = await assessImageQuality(image.buffer);
  const preprocessing = [...quality.preprocessing];

  if (!quality.ok) {
    return { image, quality };
  }

  const enhanced = await enhanceImageForVision(image.buffer, quality.brightness);
  preprocessing.push(...enhanced.steps);

  if (enhanced.buffer !== image.buffer) {
    quality = await assessImageQuality(enhanced.buffer);
    quality.preprocessing = preprocessing;
  }

  return {
    image: {
      buffer: enhanced.buffer,
      mimetype: "image/jpeg",
    },
    quality,
  };
}

export { USER_QUALITY_ERROR };
