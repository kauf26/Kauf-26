const Stripe = require('stripe');

// Make sure this line is here!
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

// 1. Subscription (14-day trial)
exports.createSubscriptionCheckout = async (userId, email) => {
 const appUrl = process.env.APP_URL || 'http://localhost:5173';
 return await stripeClient.checkout.sessions.create({
   customer_email: email,
   payment_method_types: ['card'],
   line_items: [{ price: 'price_1TOhf1GwpI8U7eDG4yrSJaxA', quantity: 1 }],
   mode: 'subscription',
   subscription_data: { trial_period_days: 14 }, // Trial set to 2 weeks
   metadata: { userId },
   success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
   cancel_url: `${appUrl}/pricing`,
 });
};

// 2. Escrow (2% fee setup)
exports.createHoldPayment = async (amount, customerId) => {
 return await stripeClient.paymentIntents.create({
   amount: Math.round(amount * 100),
   currency: 'usd',
   customer: customerId,
   payment_method_types: ['card'],
   capture_method: 'manual',
 });
};