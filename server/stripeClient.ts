import "dotenv/config";
import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Returns a configured Stripe client. Initializes on first use so the server
 * can boot when STRIPE_SECRET_KEY is temporarily missing (e.g. local scrape dev).
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error(
        "STRIPE_SECRET_KEY is missing from your .env file. Add it to use Stripe checkout or webhooks."
      );
    }
    stripeInstance = new Stripe(stripeKey, {
      apiVersion: "2025-01-27" as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
}

/** True when Stripe can be initialized without throwing. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function clientUrls() {
  const base = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  return {
    success: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel: `${base}/cancel`,
  };
}

type CheckoutSessionResult = { url: string | null; id: string };

/**
 * Per-sale commission checkout — tiered fee after 14-day trial.
 */
export async function createPerSaleCheckoutSession(params: {
  userId: string;
  itemSalePrice: number;
  userSalesCount: number;
}): Promise<CheckoutSessionResult> {
  const { userId, itemSalePrice, userSalesCount } = params;

  let feePercentage = 0.03;
  if (userSalesCount >= 250) {
    feePercentage = 0.02;
  } else if (userSalesCount >= 50) {
    feePercentage = 0.025;
  }

  const calculatedFeeCents = Math.round(itemSalePrice * feePercentage * 100);
  const stripe = getStripe();
  const { success, cancel } = clientUrls();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Kauf26 Sale Commission",
          },
          unit_amount: calculatedFeeCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: success,
    cancel_url: cancel,
    metadata: { userId },
  });

  return { url: session.url, id: session.id };
}

/**
 * 30-day escrow hold — authorizes payment without capture until released.
 */
export async function createHoldPaymentSession(params: {
  userId: string;
  amount: number;
}): Promise<CheckoutSessionResult> {
  const { userId, amount } = params;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Hold amount must be a positive number");
  }

  const stripe = getStripe();
  const { success, cancel } = clientUrls();
  const amountCents = Math.round(amount * 100);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Kauf26 30-Day Escrow Hold",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      capture_method: "manual",
      metadata: { userId, holdType: "30-day-escrow" },
    },
    success_url: success,
    cancel_url: cancel,
    metadata: { userId },
  });

  return { url: session.url, id: session.id };
}

/** @deprecated Use createPerSaleCheckoutSession */
export async function createPerSaleCheckout(
  userId: string,
  itemSalePrice: number,
  userSalesCount: number
): Promise<string | null> {
  const session = await createPerSaleCheckoutSession({
    userId,
    itemSalePrice,
    userSalesCount,
  });
  return session.url;
}
