import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
// Add "as any" at the end to stop the red underline

  apiVersion: '2026-04-22.dahlia' as any,
 });


/**
* Creates a "Per-Sale" Checkout Session.
* Logic: Resellers pay a percentage fee ONLY after their trial ends.
* * @param userId - Reseller ID
* @param itemSalePrice - The amount the item sold for (e.g., $100.00)
* @param userSalesCount - Total number of sales (to calculate volume tier)
*/
export async function createPerSaleCheckout(
 userId: string,
 itemSalePrice: number,
 userSalesCount: number
) {

 // --- VOLUME PERCENTAGE LOGIC ---
 // Start with the standard rate and drop as they sell more
 let feePercentage = 0.025; // 2.5% for most users

 if (userSalesCount >= 250) {
   feePercentage = 0.0175; // 1.75% for Power Resellers
 } else if (userSalesCount >= 50) {
   feePercentage = 0.020;  // 2.0% for Mid-Tier Resellers
 }

 // Calculate fee in CENTS (Stripe requirement)
 // Example: $100 sale * 2.5% = $2.50 = 250 cents
 const calculatedFeeCents = Math.round(itemSalePrice * feePercentage * 100);

 try {
   const session = await stripe.checkout.sessions.create({
     payment_method_types: ['card'],
     line_items: [
       {
         price_data: {
           currency: 'usd',
           product_data: {
             name: `Kauf26 Marketplace Fee`,
             description: `Processing fee (${(feePercentage * 100).toFixed(2)}%) for item sold at $${itemSalePrice.toFixed(2)}`,
             tax_code: 'txcd_10103001', // SaaS - Business Use
           },
           unit_amount: calculatedFeeCents,
         },
         quantity: 1,
       },
     ],
     mode: 'payment', // One-time fee, NOT a subscription

     // --- GLOBAL TAX ENGINE (FOR YOUR 26 MARKETPLACES) ---
     automatic_tax: { enabled: true },
     customer_update: { address: 'auto' },
     billing_address_collection: 'required',

     // Your Redirect URLs
     success_url: `http://localhost:5000/success?session_id={CHECKOUT_SESSION_ID}`,
     cancel_url: `http://localhost:5000/cancel`,

     metadata: {
       userId: userId,
       appliedRate: feePercentage.toString(),
       salePrice: itemSalePrice.toString()
     },
   });

   return session;
 } catch (error) {
   console.error('Stripe Checkout Error:', error);
   throw error;
 }
}