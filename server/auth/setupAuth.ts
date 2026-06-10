import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { isWebOAuthConfigured } from "../../shared/webOAuthEnv";
import { pool } from "../db";
import { upsertOAuthUser } from "./authStorage";
import type { SessionUser } from "./types";

function getBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) return `https://${domains.split(",")[0].trim()}`;
  return process.env.APP_BASE_URL || process.env.CLIENT_URL || "http://localhost:3000";
}

export function getSessionMiddleware(): RequestHandler {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const PgStore = connectPg(session);
  const store = new PgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.warn("[auth] SESSION_SECRET not set — using insecure dev default");
  }

  const isProd = process.env.NODE_ENV === "production";

  return session({
    secret: secret ?? "dev-insecure-session-secret-change-me",
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProd,
      maxAge: sessionTtl,
      sameSite: "lax",
    },
  });
}

function toSessionUser(
  user: Awaited<ReturnType<typeof upsertOAuthUser>>["user"],
  provider: SessionUser["provider"],
  isNew: boolean
): SessionUser {
  return {
    id: user.id,
    sub: user.sub,
    email: user.email,
    provider,
    isNew,
    needsOnboarding: isNew || !user.onboardingCompleted,
  };
}

function postAuthRedirect(user: SessionUser): string {
  return user.needsOnboarding ? "/onboarding" : "/";
}

export async function setupAuth(app: Express): Promise<void> {
  app.set("trust proxy", 1);
  app.use(getSessionMiddleware());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user as Express.User));

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: "/api/auth/google/callback",
          scope: ["profile", "email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const sub = `google_${profile.id}`;
            const { user, isNew } = await upsertOAuthUser({
              sub,
              email: profile.emails?.[0]?.value,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              profileImageUrl: profile.photos?.[0]?.value,
              provider: "google",
            });
            done(null, toSessionUser(user, "google", isNew));
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
    console.log("[auth] Google OAuth registered");
  } else {
    console.warn("[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set");
  }

  const appleClientId = process.env.APPLE_CLIENT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleKeyId = process.env.APPLE_KEY_ID;
  const applePrivateKey = process.env.APPLE_PRIVATE_KEY;

  if (appleClientId && appleTeamId && appleKeyId && applePrivateKey) {
    const appleModule = await import("passport-apple");
    const AppleStrategy = (appleModule as { default?: unknown }).default ?? appleModule;

    passport.use(
      new (AppleStrategy as new (...args: unknown[]) => passport.Strategy)(
        {
          clientID: appleClientId,
          teamID: appleTeamId,
          keyID: appleKeyId,
          privateKeyString: applePrivateKey.replace(/\\n/g, "\n"),
          callbackURL: `${getBaseUrl()}/api/auth/apple/callback`,
          scope: ["name", "email"],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          idToken: { email?: string },
          profile: {
            id: string;
            email?: string;
            name?: { firstName?: string; lastName?: string };
          },
          done: (err: Error | null, user?: SessionUser) => void
        ) => {
          try {
            const sub = `apple_${profile.id}`;
            const { user, isNew } = await upsertOAuthUser({
              sub,
              email: profile.email ?? idToken?.email,
              firstName: profile.name?.firstName,
              lastName: profile.name?.lastName,
              provider: "apple",
            });
            done(null, toSessionUser(user, "apple", isNew));
          } catch (err) {
            done(err as Error);
          }
        }
      )
    );
    console.log("[auth] Apple Sign In registered");
  } else {
    console.warn("[auth] Apple Sign In credentials not set");
  }

  if (!isWebOAuthConfigured(process.env)) {
    console.warn(
      "[auth] Web OAuth disabled — set GOOGLE_CLIENT_ID/SECRET or Apple Sign In vars in .env for login. " +
        "The web app will not call /api/auth/user until configured."
    );
  }

  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google" }),
    (req, res) => {
      const user = req.user as SessionUser;
      res.redirect(postAuthRedirect(user));
    }
  );

  app.get("/api/auth/apple", passport.authenticate("apple"));

  app.post(
    "/api/auth/apple/callback",
    passport.authenticate("apple", { failureRedirect: "/login?error=apple" }),
    (req, res) => {
      const user = req.user as SessionUser;
      res.redirect(postAuthRedirect(user));
    }
  );

  app.get("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => res.redirect("/login"));
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated?.() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
