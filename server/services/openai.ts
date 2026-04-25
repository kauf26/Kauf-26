import OpenAI from "openai";
import fs from "fs/promises";

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

         1. EXACT MATCH: If you identify the specific brand, model, and year (e.g., a specific Omega watch or BMW part), return the average current market price found online.
         2. GENERAL DESCRIPTION: If the exact model is unknown, provide a basic description and a general price estimate for that category of item.

         Return a JSON object with:
         {
           "match_type": "exact" | "general",
           "title": "string",
           "description": "string",
           "brand": "string",
           "suggested_price": number,
           "category": "string"
         }`
       },
       {
         role: "user",
         content: [
           { type: "text", text: "Create a resale listing for this item:" },
           {
             type: "image_url",
             image_url: { "url": `data:image/jpeg;base64,${base64Image}` },
           },
         ],
       },
     ],
     response_format: { type: "json_object" }
   });

   return JSON.parse(response.choices[0].message.content || "{}");
 } catch (error) {
   console.error("OpenAI Service Error:", error);
   throw error;
 }
}
