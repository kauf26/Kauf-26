import express from 'express';
<<<<<<< HEAD
import { createSubscriptionCheckout, createHoldPayment } from './stripeClient.ts';
=======
// We are only importing the specific functions now
const { createSubscriptionCheckout, createHoldPayment } = require('./stripeClient.js');
>>>>>>> 3c619e1a8 (Migration to local and npm update)

const router = express.Router();

router.post('/create-checkout', async (req: any, res: any) => {
 try {
   const { userId, email } = req.body;
   const session = await createSubscriptionCheckout(userId, email);
   res.json({ sessionId: session.id });
 } catch (error) {
<<<<<<< HEAD
=======
   console.error('Stripe Subscription Error:', error);
>>>>>>> 3c619e1a8 (Migration to local and npm update)
   res.status(500).json({ error: 'Stripe Error' });
 }
});

router.post('/create-hold', async (req: any, res: any) => {
 try {
   const { amount, customerId } = req.body;
   const paymentIntent = await createHoldPayment(amount, customerId);
   res.json({ success: true, paymentIntentId: paymentIntent.id });
 } catch (error) {
<<<<<<< HEAD
=======
   console.error('Escrow Error:', error);
>>>>>>> 3c619e1a8 (Migration to local and npm update)
   res.status(500).json({ error: 'Escrow Error' });
 }
});

export default router;