import OpenAI from "openai";
import fs from "fs/promises";

const openai = new OpenAI({
 apiKey: process.env.OPENAI_API_KEY,
});

/**
* Analyzes a product image for Kauf26 listings
*/
export async function analyzeProductImage(imagePath: string) {
 try {
   // 1. Convert the uploaded file to base64 for the AI to "see"
   const imageBuffer = await fs.readFile(imagePath);
   const base64Image = imageBuffer.toString("base64");

   // 2. Send it to GPT-4o
   const response = await openai.chat.completions.create({
     model: "gpt-4o",
     messages: [
       {
         role: "system",
         content: `You are an expert e-commerce specialist. Analyze the image and return a JSON object with:
         - title: SEO-friendly title
         - description: Detailed features
         - brand: Identify the brand
         - suggested_price: Market value in USD
         - category: Best category for eBay/Vinted
         - condition: New, Excellent, Good, or Fair`
       },
       {
         role: "user",
         content: [
           { type: "text", text: "Create a resale listing for this item:" },
           {
             type: "image_url",
             image_url: {
               "url": `data:image/jpeg;base64,${base64Image}`,
             },
           },
         ],
       },
     ],
     response_format: { type: "json_object" }
   });

   return JSON.parse(response.choices[0].message.content || "{}");
 } catch (error) {
   console.error("OpenAI Service Error:", error);
   throw new Error("AI analysis failed.");
 }
}
