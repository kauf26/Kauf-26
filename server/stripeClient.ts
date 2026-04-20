import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

export const stripe = new Stripe(stripeSecretKey);

/**
* Helper: Create a Checkout Session for Kauf26 subscriptions
*/
export const createSubscriptionCheckout = async (userEmail: string, priceId: string) => {
 try {
   const session = await stripe.checkout.sessions.create({
     customer_email: userEmail,
     payment_method_types: ['card'],
     line_items: [
       {
         price: priceId,
         quantity: 1,
       },
     ],
     mode: 'subscription',
     success_url: `${process.env.APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${process.env.APP_URL}/pricing`,
   });

   return session;
 } catch (error) {
   console.error("Stripe Checkout Error:", error);
   throw error;
 }
};

/**
* Helper: Create a Payment Intent with a "Hold" (Manual Capture)
* Use this for product sales to allow for returns before capturing funds.
*/
export const createHoldPaymentIntent = async (amount: number, userEmail: string) => {
 try {
   const paymentIntent = await stripe.paymentIntents.create({
     amount: amount, // amount in cents (e.g., 1000 = $10.00)
     currency: 'usd',
     receipt_email: userEmail,
     payment_method_types: ['card'],
     capture_method: 'manual', // This creates the "Hold"
     description: 'Kauf26 Product Sale - Authorization Hold',
   });

   return paymentIntent;
 } catch (error) {
   console.error("Stripe Hold Error:", error);
   throw error;
 }
};

/**
* Helper: Capture a previously held payment
* Call this once the item is shipped/return window is cleared.
*/
export const capturePayment = async (paymentIntentId: string) => {
 try {
   const intent = await stripe.paymentIntents.capture(paymentIntentId);
   return intent;
 } catch (error) {
   console.error("Stripe Capture Error:", error);
   throw error;
 }
};