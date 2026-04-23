import express from 'express';
// Fixed the import path by adding the .js extension for the ESM loader
import { createSubscriptionCheckout, createHoldPayment } from './stripeClient.js';

const router = express.Router();

router.post('/create-checkout', async (req, res) => {
 const { userId, email } = req.body;
 try {
   const session = await createSubscriptionCheckout(userId, email);
   res.json({ sessionId: session.id });
 } catch (error) {
   console.error('Stripe Checkout Error:', error);
   res.status(500).json({ error: 'Checkout failed' });
 }
});

// Added export to match your existing server structure
export default router;