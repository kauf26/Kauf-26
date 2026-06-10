/** True when Google or Apple web login env vars are configured (server + Vite dev). */
export function isWebOAuthConfigured(
  env: Record<string, string | undefined>
): boolean {
  const google = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const apple = Boolean(
    env.APPLE_CLIENT_ID &&
      env.APPLE_TEAM_ID &&
      env.APPLE_KEY_ID &&
      env.APPLE_PRIVATE_KEY
  );
  return google || apple;
}
