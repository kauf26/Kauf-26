import type { Request, RequestHandler } from "express";
import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import { productDrafts } from "../../shared/schema";
import type { SessionUser } from "./types";

/** Unset NODE_ENV defaults to development so local servers don't require sessions. */
export function getNodeEnv(): string {
  return process.env.NODE_ENV?.trim() || "development";
}

export function isProductionAuthRequired(): boolean {
  return getNodeEnv() === "production";
}

/** Require session auth in production; allow open access in development. */
export const requireAuthInProduction: RequestHandler = (req, res, next) => {
  if (!isProductionAuthRequired()) {
    return next();
  }
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

export function getSessionUserId(req: Request): number | undefined {
  if (!req.isAuthenticated?.() || !req.user) {
    return undefined;
  }
  return (req.user as SessionUser).id;
}

/** Drizzle filter for draft list queries; undefined = no filter (dev, unauthenticated). */
export function draftVisibilityCondition(req: Request): SQL | undefined {
  const userId = getSessionUserId(req);

  if (!isProductionAuthRequired()) {
    if (userId == null) {
      return undefined;
    }
    return or(eq(productDrafts.userId, userId), isNull(productDrafts.userId));
  }

  if (userId == null) {
    return undefined;
  }

  return eq(productDrafts.userId, userId);
}

export function userOwnsDraft(
  req: Request,
  draft: { userId: number | null }
): boolean {
  const userId = getSessionUserId(req);

  if (!isProductionAuthRequired() && userId == null) {
    return true;
  }

  if (userId == null) {
    return false;
  }

  if (draft.userId == null) {
    return !isProductionAuthRequired();
  }

  return draft.userId === userId;
}

export function userIdForNewDraft(req: Request): number | null {
  return getSessionUserId(req) ?? null;
}

export function draftAccessWhere(req: Request, draftId: number): SQL {
  const userId = getSessionUserId(req);
  const visibility = draftVisibilityCondition(req);

  if (visibility) {
    return and(eq(productDrafts.id, draftId), visibility)!;
  }

  return eq(productDrafts.id, draftId);
}
