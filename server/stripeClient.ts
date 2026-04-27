import Stripe from "stripe";

// Using 'any' as a temporary bridge to clear the versioning squiggle
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
 apiVersion: "2023-10-16" as any,
});

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
         price: "price_12345", // Replace with your actual Stripe Price ID
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
   console.error("Stripe Session Error:", error);
   throw error;
 }
}