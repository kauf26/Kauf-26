import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 7 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function getBaseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) return `https://${domains.split(",")[0].trim()}`;
  return process.env.APP_BASE_URL || "https://kauf26.com";
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user as Express.User));

  // ── passport-apple: dynamic import works in both ESM dev and CJS prod bundle
  // (createRequire(import.meta.url) breaks when bundled — import.meta.url is undefined in CJS)
  const appleModule = await import("passport-apple");
  const AppleStrategy = (appleModule as any).default ?? appleModule;

  // ── Google OAuth 2.0 ──────────────────────────────────────────────────────
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
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: any,
          done: Function
        ) => {
          try {
            const userId = `google_${profile.id}`;
            const email = profile.emails?.[0]?.value;
            const firstName = profile.name?.givenName;
            const lastName = profile.name?.familyName;
            const profileImageUrl = profile.photos?.[0]?.value;

            await authStorage.upsertUser({
              id: userId,
              email,
              firstName,
              lastName,
              profileImageUrl,
            });

            done(null, {
              claims: { sub: userId },
              provider: "google",
              email,
              firstName,
              lastName,
              profileImageUrl,
            });
          } catch (err) {
            done(err);
          }
        }
      )
    );
    console.log("[auth] Google OAuth strategy registered");
  } else {
    console.warn("[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google sign-in disabled");
  }

  // ── Apple Sign In ─────────────────────────────────────────────────────────
  const appleClientId = process.env.APPLE_CLIENT_ID;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const appleKeyId = process.env.APPLE_KEY_ID;
  const applePrivateKey = process.env.APPLE_PRIVATE_KEY;

  if (appleClientId && appleTeamId && appleKeyId && applePrivateKey) {
    passport.use(
      new AppleStrategy(
        {
          clientID: appleClientId,
          teamID: appleTeamId,
          keyID: appleKeyId,
          // Stored in env as single line with literal \n — convert back to real newlines
          privateKeyString: applePrivateKey.replace(/\\n/g, "\n"),
          // Apple requires an absolute HTTPS callback URL registered in their portal
          callbackURL: `${getBaseUrl()}/api/auth/apple/callback`,
          scope: ["name", "email"],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          idToken: any,
          profile: any,
          done: Function
        ) => {
          try {
            const userId = `apple_${profile.id}`;
            // Apple only sends name/email on the VERY FIRST sign-in — store what we get
            const email = profile.email ?? idToken?.email ?? undefined;
            const firstName = profile.name?.firstName ?? undefined;
            const lastName = profile.name?.lastName ?? undefined;

            await authStorage.upsertUser({ id: userId, email, firstName, lastName });

            done(null, {
              claims: { sub: userId },
              provider: "apple",
              email,
              firstName,
              lastName,
            });
          } catch (err) {
            done(err);
          }
        }
      )
    );
    console.log("[auth] Apple Sign In strategy registered");
  } else {
    console.warn("[auth] Apple Sign In credentials not set — Apple sign-in disabled");
  }

  // ── Google routes ─────────────────────────────────────────────────────────
  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google" }),
    (_req, res) => res.redirect("/")
  );

  // ── Apple routes — Apple uses POST for the callback, not GET ──────────────
  app.get("/api/auth/apple", passport.authenticate("apple"));

  app.post(
    "/api/auth/apple/callback",
    passport.authenticate("apple", { failureRedirect: "/login?error=apple" }),
    (_req, res) => res.redirect("/")
  );

  // ── Backward compat: /api/login now just goes to the login page ───────────
  app.get("/api/login", (_req, res) => res.redirect("/login"));

  // ── Logout ────────────────────────────────────────────────────────────────
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/login"));
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
