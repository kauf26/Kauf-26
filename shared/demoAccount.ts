/**
 * Development-only demo account for local testing and QA.
 * Disabled in production (NODE_ENV=production) — never available on Render/App Store builds.
 */

export const DEMO_ACCOUNT_EMAIL = "demo@kauf26.com";
export const DEMO_ACCOUNT_PASSWORD = "DemoReview2026!";
export const DEMO_ACCOUNT_USER_SUB = "demo_kauf26_reviewer";

export function isDemoAccountEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): boolean {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (nodeEnv === "production") return false;
  return env.DEMO_ACCOUNT_ENABLED !== "false";
}
