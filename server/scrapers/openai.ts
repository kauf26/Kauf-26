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

export const extractProductData = async (rawText: string) => {
  const prompt = `Extract product details from this text and return strictly valid JSON:
  { "title": string, "brand": string, "price": number, "description": string, "category": string, "condition": string }.
  Text: ${rawText}`;

  try {
    // Get the instance only when needed
    const client = getOpenAI();
    
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    return JSON.parse(completion.choices[0].message.content || "{}");
  } catch (error) {
    console.error("❌ OpenAI Extraction Failed:", error);
    return null;
  }
};
