import express from 'express';
// Fixed import for M1 Mac compatibility
import { createSubscriptionCheckout, createHoldPayment } from './stripeClient.js';

const router = express.Router();

router.post('/create-checkout', async (req, res) => {
 const { userId, email } = req.body;
 try {
   // This includes your 14-day trial logic
   const session = await createSubscriptionCheckout(userId, email);
   res.json({ sessionId: session.id });
 } catch (error) {
   console.error('Stripe Checkout Error:', error);
   res.status(500).json({ error: 'Checkout failed' });
 }
});

// Logic for the 30-day escrow hold
router.post('/create-hold', async (req, res) => {
 const { amount, customerId } = req.body;
 try {
   const paymentIntent = await createHoldPayment(amount, customerId);
   res.json({ success: true, paymentIntentId: paymentIntent.id });
 } catch (error) {
   console.error('Escrow Hold Error:', error);
   res.status(500).json({ error: 'Failed to create payment hold' });
 }
});

export default router;