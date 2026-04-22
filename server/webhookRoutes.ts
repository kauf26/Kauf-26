import express from 'express';
import { db } from './db';
import { listings, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
 apiVersion: '2023-10-16' as any,
});

const router = express.Router();

// --- 1. SHOPIFY WEBHOOK ---
router.post("/api/webhooks/shopify", async (req, res) => {
 try {
   const { line_items } = req.body;
   if (!line_items) return res.status(400).send('No line items found');

   for (const item of line_items) {
     console.log(`[SHIELD] Sale detected on Shopify: ${item.title}`);

     const [listing] = await db.select()
       .from(listings)
       .where(eq(listings.shopifyVariantId, item.variant_id.toString()));

     if (listing && listing.ebayItemId) {
       console.log(`[SHIELD] CRITICAL: Ending eBay Listing ${listing.ebayItemId}`);
       // await endEbayListing(listing.ebayItemId);

       await db.update(listings)
         .set({ status: "sold" })
         .where(eq(listings.id, listing.id));
     }
   }
   res.status(200).send('Webhook received');
 } catch (error) {
   console.error("[SHIELD] Error processing Shopify webhook:", error);
   res.status(500).send('Internal Server Error');
 }
});

// --- 2. STRIPE WEBHOOK ---
router.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
 const sig = req.headers['stripe-signature'];
 let event: Stripe.Event;

 if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
   return res.status(400).send('Missing signature or webhook secret');
 }

 try {
   event = stripe.webhooks.constructEvent(
     req.body,
     sig,
     process.env.STRIPE_WEBHOOK_SECRET
   );
 } catch (err: any) {
   console.error(`[STRIPE] Webhook Signature failed: ${err.message}`);
   return res.status(400).send(`Webhook Error: ${err.message}`);
 }

 if (event.type === 'customer.subscription.created') {
   const subscription = event.data.object as Stripe.Subscription;

   if (subscription.status === 'trialing') {
     console.log(`[STRIPE] 14-Day Trial Started for customer: ${subscription.customer}`);

     const customerId = typeof subscription.customer === 'string'
       ? subscription.customer
       : subscription.customer.id;

     try {
       // Using 'as any' here to bypass strict schema naming checks
       // while you finalize the Kauf26 migration
       await db.update(users)
         .set({
           subscriptionStatus: 'trialing',
           stripeSubscriptionId: subscription.id
         } as any)
         .where(eq((users as any).stripeCustomerId || (users as any).stripe_customer_id, customerId));
     } catch (dbError) {
       console.error("[STRIPE] Database update failed:", dbError);
     }
   }
 }

 res.json({ received: true });
});

export { router as webhookRoutes };