// @ts-ignore
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
 });

// @ts-ignore
export const createSubscriptionCheckout = async (userId: string, userEmail: string) => {
 const appUrl = process.env.APP_URL;

 try {
   const session = await stripe.checkout.sessions.create({
     customer_email: userEmail,
     payment_method_types: ['card'],
     line_items: [
       {
         // PASTE YOUR price_ ID BETWEEN THE QUOTES BELOW
         price: 'price_1TOhf1Gwpl8U7eDG4yrSJaxA,',
         quantity: 1,
       },
     ],
     mode: 'subscription',
     subscription_data: {
       trial_period_days: 14, // Your new trial length
     },
     metadata: {
       userId: userId,
     },
     success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `${appUrl}/pricing`,
   });

   return session;
 } catch (error) {
   console.error("Stripe Subscription Error:", error);
   throw error;
 }
};

export const createHoldPayment = async (userId: string, amount: number) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100, // Converts dollars to cents
      currency: 'usd',
      payment_method_types: ['card'],
      capture_method: 'manual', // This creates the 30-day escrow hold
      metadata: {
        userId: userId,
        hold_type: 'escrow_30_day'
      },
    });
 
    return paymentIntent;
  } catch (error) {
    console.error("Stripe Hold Error:", error);
    throw error;
  }
 };