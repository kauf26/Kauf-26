import type OpenAI from "openai";
import { auditVisionBrandHallucination } from "./brandHallucinationGuard";
import { normalizeIdentificationCondition } from "./identifyMergeService";
import type { IdentifyImageInput } from "../identifyImages";
import type {
  VisionConfidence,
  VisionPerImage,
  VisionProduct,
} from "../visionMerge";

export const VISION_IDENTIFY_SYSTEM_PROMPT = `You are a product identification expert for resale listings. Analyze ONLY the main product in the photo.

BRAND RULES (critical):
- Do NOT guess luxury brand names. Only return a brand if you clearly see the logo or name on the product (e.g. "Rolex" on the dial, crown logo, case back engraving).
- If uncertain about the brand, set brand to null and brand_confidence to "low".
- Never return a different brand than what is visibly present.
- If multiple brands appear on the product, return the most prominent one on the item itself (not packaging/background).
- Never substitute a lookalike (do not say Rolex for Invicta/Casio/Timex diver watches).
- Do not infer brand from shape alone.

CONDITION RULES:
- condition must be ONLY one of: New, Used, Like New.
- Never combine brand with condition (invalid: "Used Rolex" — brand and condition are separate fields).

CONFIDENCE:
- confidence: overall identification quality (high | medium | low).
- brand_confidence: how sure you are about the brand specifically (high | medium | low).
- brand_confidence "high" only when logo or brand text is clearly readable.
- brand_confidence "low" when brand is null or illegible.

Return ONLY valid JSON with these fields:
title, brand (string or null), brand_confidence, model, category, condition, price (number or null), confidence, description, material, color, style`;

export const VISION_IDENTIFY_USER_INSTRUCTIONS = `Identify the product for a resale listing. Read dial/crown/clasp text for watches. Use null for brand when not clearly visible. Never hallucinate luxury brands.`;

/** Full prompt text logged by /api/identify/debug */
export const VISION_IDENTIFY_PROMPT = `${VISION_IDENTIFY_SYSTEM_PROMPT}\n\n${VISION_IDENTIFY_USER_INSTRUCTIONS}`;

function isWeakCategory(category: string): boolean {
  const s = category.toLowerCase().trim();
  return !s || s === "general" || s === "other";
}

function coalesceCategory(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s && !isWeakCategory(s)) return s;
  }
  return "";
}

function inferModelFromTitle(title: string, brand: string): string {
  const t = title.trim();
  const b = brand.trim();
  if (!t) return "";
  if (b) {
    const lower = t.toLowerCase();
    const brandLower = b.toLowerCase();
    if (lower.startsWith(brandLower)) {
      return t.slice(b.length).trim();
    }
  }
  const parts = t.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

function parseConfidence(
  value: unknown,
  fallback: VisionConfidence = "medium"
): VisionConfidence {
  return value === "high" || value === "medium" || value === "low"
    ? value
    : fallback;
}

export type RawVisionParseResult = {
  product: VisionProduct | null;
  rawJson: Record<string, unknown> | null;
  hallucinationFlags: string[];
};

export function parseVisionResponse(content: string): RawVisionParseResult {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { product: null, rawJson: null, hallucinationFlags: [] };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (!parsed.title || typeof parsed.title !== "string") {
      return { product: null, rawJson: parsed, hallucinationFlags: [] };
    }

    const title = String(parsed.title).trim();
    const categoryFromVision = String(parsed.category ?? "").trim();
    const confidence = parseConfidence(parsed.confidence);
    const rawBrand =
      parsed.brand == null ? "" : String(parsed.brand ?? "").trim();
    let brandConfidence = parseConfidence(
      parsed.brand_confidence,
      rawBrand ? confidence : "low"
    );

    if (!rawBrand) {
      brandConfidence = "low";
    }

    const model =
      String(parsed.model ?? "").trim() || inferModelFromTitle(title, rawBrand);

    const price =
      typeof parsed.price === "number" && parsed.price > 0 ? parsed.price : null;

    const audit = auditVisionBrandHallucination({
      title,
      brand: rawBrand,
      model,
      brandConfidence,
      confidence,
      category: categoryFromVision,
      price,
    });

    const product: VisionProduct = {
      title,
      brand: audit.brand,
      brandConfidence: audit.brandConfidence,
      model,
      category: coalesceCategory(categoryFromVision),
      condition: normalizeIdentificationCondition(parsed.condition, audit.brand),
      price,
      description: String(parsed.description ?? "").trim(),
      material: String(parsed.material ?? "").trim(),
      color: String(parsed.color ?? "").trim(),
      style: String(parsed.style ?? "").trim(),
      confidence: audit.confidence,
      hallucinationFlags: audit.hallucinationFlags,
    };

    return {
      product,
      rawJson: parsed,
      hallucinationFlags: audit.hallucinationFlags,
    };
  } catch {
    return { product: null, rawJson: null, hallucinationFlags: [] };
  }
}

export type VisionCallMeta = {
  imageIndex: number;
  rawResponse: string;
  prompt: string;
  parseResult: RawVisionParseResult;
};

export function createCallVisionForImage(deps: {
  openai: OpenAI;
  visionTimeoutMs: number;
}) {
  return async function callVisionForImage(
    image: IdentifyImageInput,
    imageIndex: number
  ): Promise<(VisionPerImage & { _meta?: VisionCallMeta }) | null> {
    const base64Image = image.buffer.toString("base64");
    console.log(
      `🤖 [Vision] Image ${imageIndex + 1}: calling OpenAI (max ${deps.visionTimeoutMs}ms)...`
    );

    const visionResponse = await Promise.race([
      deps.openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: VISION_IDENTIFY_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: VISION_IDENTIFY_USER_INSTRUCTIONS },
              {
                type: "image_url",
                image_url: {
                  url: `data:${image.mimetype || "image/jpeg"};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), deps.visionTimeoutMs)
      ),
    ]);

    if (!visionResponse) {
      console.warn(
        `[Identify] Vision timed out for image ${imageIndex + 1} after ${deps.visionTimeoutMs}ms`
      );
      return null;
    }

    const visionRaw = visionResponse.choices[0].message.content || "";
    console.log(`🔬 [Vision] Image ${imageIndex + 1} raw:`, visionRaw);

    const parseResult = parseVisionResponse(visionRaw);
    if (!parseResult.product?.title?.trim()) {
      console.warn(
        `[Identify] Vision could not identify product from image ${imageIndex + 1}`
      );
      return null;
    }

    if (parseResult.hallucinationFlags.length > 0) {
      console.warn(
        `[Identify] Hallucination guard flags image ${imageIndex + 1}:`,
        parseResult.hallucinationFlags
      );
    }

    return {
      ...parseResult.product,
      imageIndex,
      _meta: {
        imageIndex,
        rawResponse: visionRaw,
        prompt: VISION_IDENTIFY_PROMPT,
        parseResult,
      },
    };
  };
}
