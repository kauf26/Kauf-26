import 'dotenv/config';
import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

/**
 * Returns a configured Stripe client. Initializes on first use so the server
 * can boot when STRIPE_SECRET_KEY is temporarily missing (e.g. local scrape dev).
 */
export function getStripe(): Stripe {
 if (!stripeInstance) {
   const stripeKey = process.env.STRIPE_SECRET_KEY;
   if (!stripeKey) {
     throw new Error(
       'STRIPE_SECRET_KEY is missing from your .env file. Add it to use Stripe checkout or webhooks.'
     );
   }
   stripeInstance = new Stripe(stripeKey, {
     apiVersion: '2025-01-27' as any,
   });
 }
 return stripeInstance;
}

/** True when Stripe can be initialized without throwing. */
export function isStripeConfigured(): boolean {
 return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/**
 * Creates a "Per-Sale" Checkout Session for Kauf26.
 * Logic: Resellers pay a percentage fee after their 14-day trial.
 */
export async function createPerSaleCheckout(
 userId: string,
 itemSalePrice: number,
 userSalesCount: number
) {
 let feePercentage = 0.030;

 if (userSalesCount >= 250) {
   feePercentage = 0.020;
 } else if (userSalesCount >= 50) {
   feePercentage = 0.025;
 }

 const calculatedFeeCents = Math.round(itemSalePrice * feePercentage * 100);
 const stripe = getStripe();

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
