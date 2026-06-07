export type OAuthProvider = "google" | "apple";

export type SessionUser = {
  id: number;
  sub: string;
  email?: string | null;
  provider: OAuthProvider;
  isNew: boolean;
  needsOnboarding: boolean;
};

declare global {
  namespace Express {
    interface User extends SessionUser {}
  }
}
