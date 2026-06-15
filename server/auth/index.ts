export { setupAuth, isAuthenticated, getSessionMiddleware, initSessionMiddleware } from "./setupAuth";
export { registerAuthRoutes } from "./routes";
export {
  requireAuthInProduction,
  getSessionUserId,
  draftVisibilityCondition,
  userOwnsDraft,
  userIdForNewDraft,
  draftAccessWhere,
  isProductionAuthRequired,
} from "./requireAuth";
export {
  upsertOAuthUser,
  getUserById,
  completeOnboarding,
} from "./authStorage";
export type { SessionUser, OAuthProvider } from "./types";
