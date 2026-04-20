// @ts-ignore
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

// @ts-ignore
export const stripe = new Stripe(stripeSecretKey);

export const createSubscriptionCheckout = async (userEmail: string, priceId: string) => {
 const appUrl = process.env.APP_URL || 'http://localhost:5001';

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
     success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${appUrl}/pricing`,
   });

   return session;
 } catch (error) {
   console.error("Stripe Checkout Error:", error);
   throw error;
 }
};

export const createHoldPaymentIntent = async (amount: number, userEmail: string) => {
 try {
   const paymentIntent = await stripe.paymentIntents.create({
     amount: amount,
     currency: 'usd',
     receipt_email: userEmail,
     payment_method_types: ['card'],
     capture_method: 'manual',
     description: 'Kauf26 Product Sale - Authorization Hold',
   });

   return paymentIntent;
 } catch (error) {
   console.error("Stripe Hold Error:", error);
   throw error;
 }
};

export const capturePayment = async (paymentIntentId: string) => {
 try {
   const intent = await stripe.paymentIntents.capture(paymentIntentId);
   return intent;
 } catch (error) {
   console.error("Stripe Capture Error:", error);
   throw error;
 }
};