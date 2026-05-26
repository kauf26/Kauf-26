// server/services/openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const extractProductData = async (rawText: string) => {
 const prompt = `Extract product details from this text and return strictly valid JSON:
 { "title": string, "brand": string, "price": number, "description": string, "category": string, "condition": string }.
 Text: ${rawText}`;

 try {
   const completion = await openai.chat.completions.create({
     model: "gpt-4o-mini", // Cost-effective and fast
     messages: [{ role: "user", content: prompt }],
     response_format: { type: "json_object" }
   });

   return JSON.parse(completion.choices[0].message.content || "{}");
 } catch (error) {
   console.error("❌ OpenAI Extraction Failed:", error);
   return null;
 }
};