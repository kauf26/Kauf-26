import OpenAI from "openai";
import fs from "fs/promises";

<<<<<<< HEAD
const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY,
=======
// Uses the API key from your local .env file
const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY
>>>>>>> 2054f48
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
<<<<<<< HEAD
         content: `You are an expert e-commerce specialist for Kauf26.
         Analyze the image and follow these rules:

         1. EXACT MATCH: If you identify the specific brand, model, and year (e.g., a specific Omega watch or BMW part), return the average current market price found online.
         2. GENERAL DESCRIPTION: If the exact model is unknown, provide a basic description and a general price estimate for that category of item.
=======
         content: `You are an expert e-commerce specialist.
         Analyze the image and follow these rules:

         1. EXACT MATCH: If you identify the specific model, provide the exact name.
         2. GENERAL DESCRIPTION: If the exact model is unclear, describe the item.
>>>>>>> 2054f48

         Return a JSON object with:
         {
           "match_type": "exact" | "general",
<<<<<<< HEAD
           "title": "string",
           "description": "string",
           "brand": "string",
           "suggested_price": number,
           "category": "string"
=======
           "product_name": "string",
           "suggested_price": number,
           "confidence": number
>>>>>>> 2054f48
         }`
       },
       {
         role: "user",
         content: [
<<<<<<< HEAD
           { type: "text", text: "Create a resale listing for this item:" },
           {
             type: "image_url",
             image_url: { "url": `data:image/jpeg;base64,${base64Image}` },
           },
         ],
       },
=======
           { type: "text", text: "Analyze this product for listing:" },
           {
             type: "image_url",
             image_url: { url: `data:image/jpeg;base64,${base64Image}` }
           }
         ],
       }
>>>>>>> 2054f48
     ],
     response_format: { type: "json_object" }
   });

<<<<<<< HEAD
   return JSON.parse(response.choices[0].message.content || "{}");
 } catch (error) {
   console.error("OpenAI Service Error:", error);
   throw error;
 }
}
=======
   const content = response.choices[0].message.content;
   return content ? JSON.parse(content) : null;
 } catch (error) {
   console.error("OpenAI Analysis Error:", error);
   return null;
 }
}
>>>>>>> 2054f48
