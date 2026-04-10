import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { marketplaces, type Marketplace } from "@shared/schema";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import OpenAI from "openai";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { getUncachableStripeClient } from "./stripeClient";
import { deleteProductImagesIfRecentlySold } from "./cleanup";

const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function getUnlockTime(): Date {
  // Get current time in Pacific Time (San Diego)
  const now = new Date();
  const pacificDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
 
  // Calculate Tomorrow at 00:00:00
  const tomorrow = new Date(pacificDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
 
  return tomorrow;
 }
  const elapsed = Date.now() - firstLoginAt.getTime();
  const isTrialActive = elapsed < TRIAL_DURATION_MS;
  const trialDaysRemaining = Math.max(0, Math.ceil((TRIAL_DURATION_MS - elapsed) / (24 * 60 * 60 * 1000)));
  const trialEndsAt = new Date(firstLoginAt.getTime() + TRIAL_DURATION_MS);
  return { isTrialActive, trialDaysRemaining, trialEndsAt };
}

async function getUserTrialActive(req: any): Promise<boolean> {
  try {
    if (req.user?.claims?.sub) {
      const user = await authStorage.getUser(req.user.claims.sub);
      if (user?.firstLoginAt) {
        return calcTrialStatus(new Date(user.firstLoginAt)).isTrialActive;
      }
    }
  } catch {}
  return false;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const currencyRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  MXN: 17.2,
  BRL: 5.1,
  AUD: 1.52,
  CAD: 1.35,
};

const marketplaceLanguages: Record<Marketplace, string> = {
  ebay: "en",
  amazon: "en",
  walmart: "en",
  wish: "en",
  reverb: "en",
  offerup: "en",
  etsy: "en",
  shopify: "en",
  woocommerce: "en",
  aliexpress: "en",
  mercadolibre: "es",
  rakuten: "ja",
  bigcommerce: "en",
  prestashop: "en",
};

const marketplaceCurrencies: Record<Marketplace, string> = {
  ebay: "USD",
  amazon: "USD",
  walmart: "USD",
  wish: "USD",
  reverb: "USD",
  offerup: "USD",
  etsy: "USD",
  shopify: "USD",
  woocommerce: "USD",
  aliexpress: "USD",
  mercadolibre: "MXN",
  rakuten: "JPY",
  bigcommerce: "USD",
  prestashop: "EUR",
};

async function translateText(text: string, targetLang: string): Promise<string> {
  if (targetLang === "en") return text;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a professional translator. Translate the following text to ${targetLang === "es" ? "Spanish" : targetLang === "ja" ? "Japanese" : "the target language"}. Maintain the same tone and style. Return ONLY the translated text, no explanations.`,
      },
      { role: "user", content: text },
    ],
  });

  return response.choices[0]?.message?.content || text;
}

export async function registerRoutes(
  app: any
): Promise<any> {
  registerAuthRoutes(app);
  return app;
 }