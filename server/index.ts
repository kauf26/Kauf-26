import express from 'express';
import { createSubscriptionCheckout, createHoldPayment } from './stripeClient';

const router = express.Router();

router.post('/create-checkout', async (req, res) => {
 const { userId, email } = req.body;
 try {
   const session = await createSubscriptionCheckout(userId, email);
   res.json({ sessionId: session.id });
 } catch (error) {
   res.status(500).json({ error: 'Checkout failed' });
 }
});

export default router;