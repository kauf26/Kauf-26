export { setupAuth, isAuthenticated, getSessionMiddleware } from "./setupAuth";
export { registerAuthRoutes } from "./routes";
export {
  upsertOAuthUser,
  getUserById,
  completeOnboarding,
} from "./authStorage";
export type { SessionUser, OAuthProvider } from "./types";
