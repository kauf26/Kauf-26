export type VisionConfidence = "high" | "medium" | "low";

export type VisionProduct = {
  title: string;
  brand?: string;
  brandConfidence?: VisionConfidence;
  model?: string;
  category?: string;
  condition?: string;
  price?: number | null;
  description?: string;
  material?: string;
  color?: string;
  style?: string;
  confidence: VisionConfidence;
  hallucinationFlags?: string[];
};

export type VisionPerImage = VisionProduct & { imageIndex: number };

export type VisionSources = Record<string, string>;

const CONF_RANK: Record<VisionConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function imageLabel(index: number): string {
  return `image ${index + 1}`;
}

export function formatSourceLabels(indices: number[]): string {
  const unique = [...new Set(indices)].sort((a, b) => a - b);
  if (unique.length === 0) return "";
  if (unique.length === 1) return imageLabel(unique[0]);
  if (unique.length === 2) {
    return `${imageLabel(unique[0])} and ${imageLabel(unique[1])}`;
  }
  const head = unique.slice(0, -1).map(imageLabel).join(", ");
  return `${head}, and ${imageLabel(unique[unique.length - 1])}`;
}

function normalizeKey(
  value: string,
  field:
    | "title"
    | "brand"
    | "category"
    | "model"
    | "color"
    | "material"
    | "style"
): string {
  const trimmed = value.trim();
  if (field === "brand") return trimmed.toLowerCase();
  return trimmed.toLowerCase().replace(/\s+/g, " ");
}

const DESCRIPTION_MAX_CHARS = 300;

function pickScalarField(
  items: VisionPerImage[],
  field: "title" | "brand" | "category" | "model" | "color" | "material" | "style"
): { value: string; sourceIndices: number[] } {
  const candidates = items
    .map((item) => ({
      value: String(item[field] ?? "").trim(),
      imageIndex: item.imageIndex,
      rank: CONF_RANK[item.confidence],
    }))
    .filter((c) => c.value.length > 0);

  if (candidates.length === 0) {
    return { value: "", sourceIndices: [] };
  }

  const topRank = Math.max(...candidates.map((c) => c.rank));
  const topConf = candidates.filter((c) => c.rank === topRank);

  const votes = new Map<
    string,
    { count: number; maxRank: number; indices: number[]; display: string; len: number }
  >();

  for (const c of candidates) {
    const key = normalizeKey(c.value, field);
    const existing = votes.get(key);
    if (!existing) {
      votes.set(key, {
        count: 1,
        maxRank: c.rank,
        indices: [c.imageIndex],
        display: c.value,
        len: c.value.length,
      });
    } else {
      existing.count++;
      existing.indices.push(c.imageIndex);
      existing.maxRank = Math.max(existing.maxRank, c.rank);
      if (c.value.length > existing.len) {
        existing.display = c.value;
        existing.len = c.value.length;
      }
    }
  }

  const majority = [...votes.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.maxRank !== a.maxRank) return b.maxRank - a.maxRank;
    return b.len - a.len;
  })[0];

  const majorityWinners = [...votes.entries()].filter(
    ([, v]) => v.count === majority.count && v.maxRank === majority.maxRank
  );

  if (majority.count > 1 || majorityWinners.length === 1) {
    return {
      value: majority.display,
      sourceIndices: [...new Set(majority.indices)].sort((a, b) => a - b),
    };
  }

  const fromTopConf = topConf.sort((a, b) => b.value.length - a.value.length)[0];
  const matchingTop = candidates
    .filter(
      (c) =>
        c.rank === topRank &&
        normalizeKey(c.value, field) === normalizeKey(fromTopConf.value, field)
    )
    .map((c) => c.imageIndex);

  return {
    value: fromTopConf.value,
    sourceIndices: [...new Set(matchingTop.length ? matchingTop : [fromTopConf.imageIndex])].sort(
      (a, b) => a - b
    ),
  };
}

function pickTitleForAggregatedBrand(
  items: VisionPerImage[],
  aggregatedBrand: string
): { value: string; sourceIndices: number[] } {
  const brandKey = normalizeKey(aggregatedBrand, "brand");
  const candidates = items
    .map((item) => ({
      value: item.title.trim(),
      imageIndex: item.imageIndex,
      rank: CONF_RANK[item.confidence],
      brandMatches:
        brandKey.length > 0 &&
        normalizeKey(String(item.brand ?? ""), "brand") === brandKey,
    }))
    .filter((c) => c.value.length > 0);

  if (candidates.length === 0) {
    return { value: "", sourceIndices: [] };
  }

  const pool =
    brandKey.length > 0 && candidates.some((c) => c.brandMatches)
      ? candidates.filter((c) => c.brandMatches)
      : candidates;

  const best = [...pool].sort(
    (a, b) => b.rank - a.rank || b.value.length - a.value.length
  )[0];

  return {
    value: best.value,
    sourceIndices: [best.imageIndex],
  };
}

function mergeDescriptions(items: VisionPerImage[]): {
  value: string;
  sourceIndices: number[];
} {
  const seen = new Set<string>();
  const parts: string[] = [];
  const indices: number[] = [];

  const sorted = [...items].sort(
    (a, b) => CONF_RANK[b.confidence] - CONF_RANK[a.confidence]
  );

  for (const item of sorted) {
    const desc = String(item.description ?? "").trim();
    if (!desc) continue;
    const key = desc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(desc);
    indices.push(item.imageIndex);
  }

  let value = parts.join(" ");
  if (value.length > DESCRIPTION_MAX_CHARS) {
    value = value.slice(0, DESCRIPTION_MAX_CHARS).trim();
    const lastSpace = value.lastIndexOf(" ");
    if (lastSpace > DESCRIPTION_MAX_CHARS * 0.6) {
      value = value.slice(0, lastSpace).trim();
    }
  }

  return {
    value,
    sourceIndices: [...new Set(indices)].sort((a, b) => a - b),
  };
}

export function summarizeFieldVotes(
  perImage: VisionPerImage[],
  field: "brand" | "model"
): Record<string, number> {
  const votes = new Map<string, { count: number; display: string }>();
  for (const item of perImage) {
    const raw = String(item[field] ?? "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const existing = votes.get(key);
    if (existing) {
      existing.count++;
    } else {
      votes.set(key, { count: 1, display: raw });
    }
  }
  const out: Record<string, number> = {};
  for (const { display, count } of votes.values()) {
    out[display] = count;
  }
  return out;
}

/** Scraper query from aggregated brand + model (majority vote), falling back to title. */
export function buildScraperSearchQuery(vision: VisionProduct): string {
  const title = vision.title.trim();
  const brand = String(vision.brand ?? "").trim();
  const model = String(vision.model ?? "").trim();

  if (brand && model) {
    const blob = title.toLowerCase();
    if (
      blob.includes(brand.toLowerCase()) &&
      blob.includes(model.toLowerCase())
    ) {
      return title;
    }
    return `${brand} ${model}`.trim();
  }
  if (brand && title.toLowerCase().includes(brand.toLowerCase())) {
    return title;
  }
  if (brand) return brand;
  return title;
}

function pickCondition(items: VisionPerImage[]): {
  value: string;
  sourceIndices: number[];
} {
  const withCondition = items
    .map((item) => ({
      value: String(item.condition ?? "").trim(),
      imageIndex: item.imageIndex,
      rank: CONF_RANK[item.confidence],
    }))
    .filter((c) => c.value.length > 0);

  if (withCondition.length === 0) {
    return { value: "Used", sourceIndices: [] };
  }

  const topRank = Math.max(...withCondition.map((c) => c.rank));
  const winners = withCondition.filter((c) => c.rank === topRank);
  const value = winners[0].value;
  const sourceIndices = winners
    .filter((c) => c.value === value)
    .map((c) => c.imageIndex);

  return {
    value,
    sourceIndices: [...new Set(sourceIndices)].sort((a, b) => a - b),
  };
}

function mergeConfidence(items: VisionPerImage[]): VisionConfidence {
  const maxRank = Math.max(...items.map((i) => CONF_RANK[i.confidence]));
  if (maxRank === 3) return "high";
  if (maxRank === 2) return "medium";
  return "low";
}

/**
 * Merge per-image vision results into one product profile.
 * Scalar fields (title, brand, category): highest confidence, then majority vote.
 * Aggregate fields (color, material, style): combine unique tokens across angles.
 */
export function mergeVisionResults(
  perImage: VisionPerImage[]
): {
  vision: VisionProduct;
  sources: VisionSources;
  primaryImageIndex: number;
} {
  if (perImage.length === 0) {
    throw new Error("mergeVisionResults requires at least one vision result");
  }

  if (perImage.length === 1) {
    const only = perImage[0];
    const { imageIndex: _idx, ...vision } = only;
    return {
      primaryImageIndex: only.imageIndex,
      vision,
      sources: {
        title: imageLabel(only.imageIndex),
        brand: only.brand?.trim() ? imageLabel(only.imageIndex) : "",
        model: only.model?.trim() ? imageLabel(only.imageIndex) : "",
        category: only.category?.trim() ? imageLabel(only.imageIndex) : "",
        color: only.color?.trim() ? imageLabel(only.imageIndex) : "",
        material: only.material?.trim() ? imageLabel(only.imageIndex) : "",
        style: only.style?.trim() ? imageLabel(only.imageIndex) : "",
        description: only.description?.trim() ? imageLabel(only.imageIndex) : "",
        condition: only.condition?.trim() ? imageLabel(only.imageIndex) : "",
      },
    };
  }

  const brandPick = pickScalarField(perImage, "brand");
  const modelPick = pickScalarField(perImage, "model");
  const titlePick = pickTitleForAggregatedBrand(perImage, brandPick.value);
  const categoryPick = pickScalarField(perImage, "category");
  const colorPick = pickScalarField(perImage, "color");
  const materialPick = pickScalarField(perImage, "material");
  const stylePick = pickScalarField(perImage, "style");
  const descriptionPick = mergeDescriptions(perImage);
  const conditionPick = pickCondition(perImage);

  const sources: VisionSources = {
    title: formatSourceLabels(titlePick.sourceIndices),
    brand: formatSourceLabels(brandPick.sourceIndices),
    model: formatSourceLabels(modelPick.sourceIndices),
    category: formatSourceLabels(categoryPick.sourceIndices),
    color: formatSourceLabels(colorPick.sourceIndices),
    material: formatSourceLabels(materialPick.sourceIndices),
    style: formatSourceLabels(stylePick.sourceIndices),
    description: formatSourceLabels(descriptionPick.sourceIndices),
    condition: formatSourceLabels(conditionPick.sourceIndices),
  };

  const vision: VisionProduct = {
    title: titlePick.value || perImage[0].title,
    brand: brandPick.value,
    model: modelPick.value,
    category: categoryPick.value,
    condition: conditionPick.value,
    price: null,
    description: descriptionPick.value,
    material: materialPick.value,
    color: colorPick.value,
    style: stylePick.value,
    confidence: mergeConfidence(perImage),
  };

  return {
    vision,
    sources,
    primaryImageIndex: titlePick.sourceIndices[0] ?? perImage[0].imageIndex,
  };
}

export function logVisionMergeSources(
  perImage: VisionPerImage[],
  sources: VisionSources,
  merged: VisionProduct,
  primaryImageIndex: number
): void {
  const brandVotes = summarizeFieldVotes(perImage, "brand");
  const modelVotes = summarizeFieldVotes(perImage, "model");

  console.log("[Identify] Multi-image vision aggregation:", {
    imagesProcessed: perImage.length,
    primaryImageIndex,
    brandVotes,
    modelVotes,
    chosenBrand: merged.brand,
    chosenModel: merged.model,
    chosenTitle: merged.title,
    scraperQuery: buildScraperSearchQuery(merged),
    fieldSources: sources,
    mergedCategory: merged.category,
    mergedColor: merged.color,
    mergedMaterial: merged.material,
    mergedStyle: merged.style,
    mergedConfidence: merged.confidence,
    descriptionChars: merged.description?.length ?? 0,
  });

  for (const item of perImage) {
    console.log(
      `[Identify] Image ${item.imageIndex + 1} vision:`,
      JSON.stringify({
        title: item.title,
        brand: item.brand,
        model: item.model,
        category: item.category,
        color: item.color,
        material: item.material,
        style: item.style,
        confidence: item.confidence,
      })
    );
  }
}
