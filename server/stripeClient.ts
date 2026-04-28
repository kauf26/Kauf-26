import Stripe from "stripe";

// Initialize Stripe with your secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
 apiVersion: "2023-10-16" as any,
});

/**
* Provides a synchronized way to process webhooks.
* This is the function that was missing from your earlier screenshot.
*/
export async function getStripeSync() {
 return {
   processWebhook: async (payload: Buffer, sig: string) => {
     return stripe.webhooks.constructEvent(
       payload,
       sig,
       process.env.STRIPE_WEBHOOK_SECRET!
     );
   }
 };
}

/**
* Creates a checkout session for a user subscription.
* Linked to local port 5000 for your MacBook dev environment.
*/
export async function createSubscriptionCheckout(userId: string) {
 try {
   const session = await stripe.checkout.sessions.create({
     payment_method_types: ["card"],
     line_items: [
       {
         price: "price_12345", // Replace with your actual Stripe price ID
         quantity: 1,
       },
     ],
     mode: "subscription",
     success_url: `http://localhost:5000/success?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `http://localhost:5000/cancel`,
     metadata: {
       userId: userId
     },
   });

   return session;
 } catch (error) {
   console.error("Stripe Checkout Error:", error);
   throw error;
 }
}

