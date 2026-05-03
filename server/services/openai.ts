import OpenAI from "openai";
import fs from "fs/promises";

// Uses the API key from your local .env file
const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY,
});

/**
* Analyzes a product image for Kauf26 listings.
* Includes "Exact Match" market pricing logic.
*/
export async function analyzeProductImage(imagePath: string) {
 try {
   const imageBuffer = await fs.readFile(imagePath);
   const base64Image = imageBuffer.toString("base64");

   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: [
       {
         role: "system",
         content: `You are an expert e-commerce specialist for Kauf26.
Analyze the image and follow these rules:

1. EXACT MATCH: If you identify the specific brand, model, and year, provide exact pricing.
2. GENERAL DESCRIPTION: If the exact model is unknown, provide a basic description.

Return a JSON object with:
{
 "match_type": "exact" | "general",
 "product_name": "string",
 "description": "string",
 "brand": "string",
 "suggested_price": number,
 "confidence": number,
 "category": "string"
}`
       },
       {
         role: "user",
         content: [
           { type: "text", text: "Analyze this product for listing:" },
           {
             type: "image_url",
             image_url: { url: `data:image/jpeg;base64,${base64Image}` }
           },
         ],
       }
     ],
     response_format: { type: "json_object" }
   });

   const content = response.choices[0].message.content;
   return content ? JSON.parse(content) : null;
 } catch (error) {
   console.error("OpenAI Analysis Error:", error);
   return null;
 }
}