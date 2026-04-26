import express from 'express';
// We are only importing the specific functions now
const { createSubscriptionCheckout, createHoldPayment } = require('./stripeClient.js');

const router = express.Router();

router.post('/create-checkout', async (req: any, res: any) => {
 try {
   const { userId, email } = req.body;
   const session = await createSubscriptionCheckout(userId, email);
   res.json({ sessionId: session.id });
 } catch (error) {
   console.error('Stripe Subscription Error:', error);
   res.status(500).json({ error: 'Stripe Error' });
 }
});

router.post('/create-hold', async (req: any, res: any) => {
 try {
   const { amount, customerId } = req.body;
   const paymentIntent = await createHoldPayment(amount, customerId);
   res.json({ success: true, paymentIntentId: paymentIntent.id });
 } catch (error) {
   console.error('Escrow Error:', error);
   res.status(500).json({ error: 'Escrow Error' });
 }
});

export default router;