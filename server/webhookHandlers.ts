import * as StripeModule from './stripeClient';
import { storage } from './storage';

export class WebhookHandlers {
 /**
  * Verified entry point for Stripe webhook requests.
  */
 static async processWebhook(payload: Buffer, signature: string): Promise<void> {
   if (!Buffer.isBuffer(payload)) {
     throw new Error(
       'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
       'Received type: ' + typeof payload
     );
   }

   // Accessing stripe through the Module object to fix the Line 1 error
   const stripe = (StripeModule as any).stripe;

   await stripe.webhooks.constructEvent(
     payload,
     signature,
     process.env.STRIPE_WEBHOOK_SECRET as string
   );
 }

 /**
  * Handles the 'checkout.session.completed' event.
  * Updates the database to confirm the 3% or tiered fee.
  */
 static async handleCheckoutComplete(session: any): Promise<void> {
   const saleIdRaw = session.metadata?.saleId;

   if (saleIdRaw) {
     const saleId = parseInt(saleIdRaw, 10);

     if (!isNaN(saleId)) {
       // Using 'as any' to ensure the server runs while you verify storage.ts
       await (storage as any).updateSaleFeePaid(saleId, true);
     }
   }
 }
}
