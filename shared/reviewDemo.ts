/** Optional App Store review demo login — enable only during Apple review, then disable. */

export function isReviewDemoEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): boolean {
  return (
    env.APP_REVIEW_DEMO_ENABLED === "true" &&
    Boolean(env.APP_REVIEW_DEMO_EMAIL?.trim()) &&
    Boolean(env.APP_REVIEW_DEMO_PASSWORD?.trim())
  );
}

export function getReviewDemoCredentials(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): { email: string; password: string } | null {
  if (!isReviewDemoEnabled(env)) return null;
  return {
    email: env.APP_REVIEW_DEMO_EMAIL!.trim(),
    password: env.APP_REVIEW_DEMO_PASSWORD!.trim(),
  };
}
