import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';

export const stripe = new Stripe(stripeSecretKey);

/**
* Helper: Create a Checkout Session for Kauf26 subscribers
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

export const getStripeSync = () => {
 return stripe;
};

export const getUncachableStripeClient = () => stripe;