import { getStripe } from './stripeClient';
import { storage } from './storage';
import { Stripe } from 'stripe';

export class WebhookHandlers {
 /**
  * Verified entry point for Stripe webhook requests.
  * This now uses the initialized stripe client directly.
  */
 static async processWebhook(payload: Buffer, signature: string): Promise<Stripe.Event> {
   if (!Buffer.isBuffer(payload)) {
     throw new Error(
       'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
       'Received type: ' + typeof payload
     );
   }

   const secret = process.env.STRIPE_WEBHOOK_SECRET;
   if (!secret) {
    throw new Error('STRIPE WEBHOOK ERROR: Missing STRIPE_WEBHOOK_SECRET');
   }
   
   return getStripe().webhooks.constructEvent(
    payload,
    signature,
    secret
   );
 }

 /**
  * Handles the 'checkout.session.completed' event.
  * Updates the database to confirm the fee status.
  */
 static async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
   const saleIdRaw = session.metadata?.saleId;

   if (saleIdRaw) {
     const saleId = parseInt(saleIdRaw, 10);

     if (!isNaN(saleId)) {
       // Updated to remove unnecessary 'as any' if storage.ts is typed
       // Keep 'as any' only if storage schema is still in transition
       await (storage as any).updateSaleFeePaid(saleId, true);
     }
   }
 }
}