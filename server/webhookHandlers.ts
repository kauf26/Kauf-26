import { getStripeSync } from './stripeClient';
import { storage } from './storage';
import * as Stripe from 'stripe';

export class WebhookHandlers {
 /**
  * Verified entry point for Stripe webhook requests.
  */
 static async processWebhook(payload: Buffer, signature: string) {
   if (!Buffer.isBuffer(payload)) {
     throw new Error('STRIPE WEBHOOK ERROR: Payload must be a Buffer.');
   }

   const sync = await getStripeSync();
   await sync.processWebhook(payload, signature);
 }

 /**
  * Handles the 'checkout.session.completed' event.
  */
 static async handleCheckoutComplete(session: any) {
   const saleIdRaw = session.metadata?.saleId;

   if (saleIdRaw) {
     const saleId = parseInt(saleIdRaw, 10);
     if (!isNaN(saleId)) {
       // This will now be recognized once you save storage.ts
       await storage.updateSaleFeePaid(saleId);
     }
   }
 }
}