import express from 'express';
import { createSubscriptionCheckout, createHoldPayment } from './stripeClient.ts';

const router = express.Router();

router.post('/create-checkout', async (req: any, res: any) => {
 try {
   const { userId, email } = req.body;
   const session = await createSubscriptionCheckout(userId, email);
   res.json({ sessionId: session.id });
 } catch (error) {
   res.status(500).json({ error: 'Stripe Error' });
 }
});

router.post('/create-hold', async (req: any, res: any) => {
 try {
   const { amount, customerId } = req.body;
   const paymentIntent = await createHoldPayment(amount, customerId);
   res.json({ success: true, paymentIntentId: paymentIntent.id });
 } catch (error) {
   res.status(500).json({ error: 'Escrow Error' });
 }
});

export default router;