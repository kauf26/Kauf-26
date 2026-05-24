import express from 'express';
import { db } from './db';
import { listings, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
 apiVersion: '2023-10-16' as any,
});

const router = express.Router();

/**
* CORE LOGIC: Unified handler for sale events.
* Add this helper to process sales regardless of the marketplace source.
*/
async function processMarketplaceSale(marketId: string, variantId: string, title: string) {
 console.log(`[SHIELD] Sale detected on ${marketId}: ${title}`);

 const [listing] = await db.select()
   .from(listings)
   .where(eq(listings.shopifyVariantId, variantId));

 if (listing && listing.ebayItemId) {
   console.log(`[SHIELD] CRITICAL: Syncing inventory for ${marketId}. Ending eBay Listing ${listing.ebayItemId}`);

   await db.update(listings)
     .set({ status: "sold" })
     .where(eq(listings.id, listing.id));
 }
}

// --- 1. GENERIC MARKETPLACE WEBHOOK ROUTE ---
// Instead of 26 routes, you can now use this one route for platforms
// that support a common payload structure.
router.post("/api/webhooks/sale", async (req, res) => {
 try {
   const { marketId, variantId, title } = req.body;
   if (!marketId || !variantId) return res.status(400).send('Missing marketplace data');

   await processMarketplaceSale(marketId, variantId, title);
   res.status(200).send('Webhook processed');
 } catch (error) {
   console.error("[SHIELD] Error processing marketplace webhook:", error);
   res.status(500).send('Internal Server Error');
 }
});

// --- 2. LEGACY/SPECIFIC WEBHOOKS ---
// Keep Shopify separate if its payload structure is unique
router.post("/api/webhooks/shopify", async (req, res) => {
 try {
   const { line_items } = req.body;
   if (!line_items) return res.status(400).send('No line items found');

   for (const item of line_items) {
     await processMarketplaceSale("shopify", item.variant_id.toString(), item.title);
   }
   res.status(200).send('Webhook received');
 } catch (error) {
   console.error("[SHIELD] Error processing Shopify webhook:", error);
   res.status(500).send('Internal Server Error');
 }
});

// --- 3. STRIPE WEBHOOK ---
router.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
 const sig = req.headers['stripe-signature'];
 if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
   return res.status(400).send('Missing signature or webhook secret');
 }

 let event: Stripe.Event;
 try {
   event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
 } catch (err: any) {
   console.error(`[STRIPE] Webhook Signature failed: ${err.message}`);
   return res.status(400).send(`Webhook Error: ${err.message}`);
 }

 if (event.type === 'customer.subscription.created') {
   const subscription = event.data.object as Stripe.Subscription;
   const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

   await db.update(users)
     .set({ subscriptionStatus: 'trialing', stripeSubscriptionId: subscription.id } as any)
     .where(eq((users as any).stripeCustomerId || (users as any).stripe_customer_id, customerId));
 }

 res.json({ received: true });
});

export { router as webhookRoutes };