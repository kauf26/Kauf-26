import { Router } from "express";
import { db } from "./db";
import { listings } from "../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// THE SYNC & SHIELD: Shopify Listener
router.post("/api/webhooks/shopify", async (req, res) => {
 // 1. Acknowledge the webhook immediately so Shopify doesn't timeout
 res.status(200).send("OK");

 try {
   const { line_items } = req.body;

   for (const item of line_items) {
     console.log(`[SHIELD] Sale detected on Shopify: ${item.title}`);

     // 2. Look up the listing in your DB using the Shopify Variant ID we just added
     const [listing] = await db.select()
       .from(listings)
       .where(eq(listings.shopifyVariantId, item.variant_id.toString()));

     if (listing && listing.ebayItemId) {
       console.log(`[SHIELD] CRITICAL: Ending eBay Listing ${listing.ebayItemId} to prevent double-sale.`);

       // This is where the eBay API call goes next
       // await endEbayListing(listing.ebayItemId);

       // 3. Mark the item as Sold locally
       await db.update(listings)
         .set({ status: "sold" })
         .where(eq(listings.id, listing.id));
     } else {
       console.log(`[SHIELD] No matching eBay listing found for this item.`);
     }
   }
 } catch (error) {
   console.error("[SHIELD] Error processing webhook:", error);
 }
});
export { router as webhookRoutes };