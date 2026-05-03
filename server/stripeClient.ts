import 'dotenv/config';
import Stripe from 'stripe';

// 1. Get the key and check it immediately
const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
 throw new Error("STRIPE_SECRET_KEY is missing from your .env file.");
}

// 2. Initialize with the key we just verified
export const stripe = new Stripe(stripeKey, {
 apiVersion: '2025-01-27' as any,
});


/**
* Creates a "Per-Sale" Checkout Session for Kauf26.
* Logic: Resellers pay a percentage fee after their 14-day trial.
*/
export async function createPerSaleCheckout(
 userId: string,
 itemSalePrice: number,
 userSalesCount: number
) {
 // --- VOLUME PERCENTAGE LOGIC ---
 // Base commission rate is 3% as per your updated revenue model
 let feePercentage = 0.030;

 // Volume discounts for power resellers
 if (userSalesCount >= 250) {
   feePercentage = 0.020; // Drops to 2% for high volume
 } else if (userSalesCount >= 50) {
   feePercentage = 0.025; // Drops to 2.5% for mid tier
 }

 // Calculate fee in CENTS (Stripe requires integers)
 const calculatedFeeCents = Math.round(itemSalePrice * feePercentage * 100);

 try {
   const session = await stripe.checkout.sessions.create({
     payment_method_types: ['card'],
     line_items: [
       {
         price_data: {
           currency: 'usd',
           product_data: {
             name: 'Kauf26 Sale Commission',
           },
           unit_amount: calculatedFeeCents,
         },
         quantity: 1,
       },
     ],
     mode: 'payment',
     success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${process.env.CLIENT_URL}/cancel`,
     metadata: { userId },
   });

   return session.url;
 } catch (error) {
   console.error('Stripe Session Error:', error);
   throw error;
 }
}