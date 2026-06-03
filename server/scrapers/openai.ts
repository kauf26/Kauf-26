// server/services/openai.ts
import OpenAI from 'openai';

// This variable will hold the instance once created
let openai: OpenAI | null = null;

// Lazy-initializer function
const getOpenAI = () => {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing from environment variables.");
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

export function inferPriceFromDescription(description: string): number {
  const patterns = [
    /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /(\d+(?:\.\d{2})?)\s*dollars?/i,
    /(?:price|valued at|worth|msrp|retail)\s*[:\s]*\$?\s*(\d+(?:\.\d{2})?)/i,
    /\b(\d{2,4}(?:\.\d{2})?)\s*(?:USD|usd)\b/i,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (!match) continue;
    const parsed = parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function parsePriceField(price: unknown): number {
  const str = String(price ?? "").replace(/[^0-9.]/g, "");
  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const extractProductData = async (rawText: string) => {
  const prompt = `Extract product listing details from this text. Return strictly valid JSON:
  {
    "title": "specific product name",
    "brand": "brand or empty string",
    "price": number or null,
    "description": "brief accurate description",
    "category": "any accurate marketplace category (e.g. Electronics, Shoes, Cameras, Clothing)",
    "condition": "one of: New, Used, Like New"
  }
  Rules:
  - Phones/smartphones/tablets → category "Electronics", never "Watches".
  - Ignore sticker/background/incidental text; use the main product only.
  Text: ${rawText}`;

  try {
    const client = getOpenAI();

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const data = JSON.parse(completion.choices[0].message.content || "{}");
    const price = parsePriceField(data.price);
    if (price <= 0 && data.description) {
      data.price = inferPriceFromDescription(String(data.description));
    } else {
      data.price = price;
    }
    return data;
  } catch (error) {
    console.error("❌ OpenAI Extraction Failed:", error);
    return null;
  }
};
