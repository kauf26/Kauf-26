import { Router } from "express";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";

export function registerRoutes(app: Router) {
 // Add your routes here
 return app;
}

export function calcTrialStatus(firstLoginAt: Date) {
 const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
 const elapsed = Date.now() - firstLoginAt.getTime();
 const isTrialActive = elapsed < TRIAL_DURATION_MS;
 const trialDaysRemaining = Math.max(0, Math.ceil((TRIAL_DURATION_MS - elapsed) / (24 * 60 * 60 * 1000)));
 const trialEndsAt = new Date(firstLoginAt.getTime() + TRIAL_DURATION_MS);
 return { isTrialActive, trialDaysRemaining, trialEndsAt };
}
