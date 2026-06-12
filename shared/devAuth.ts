/** Dev-only PIN login — enabled when MOCK_OAUTH_MODE=true and NODE_ENV≠production. */

export const DEV_LOGIN_PIN = "1234";

export function isDevLoginEnabled(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): boolean {
  const nodeEnv = env.NODE_ENV ?? "development";
  return nodeEnv !== "production" && env.MOCK_OAUTH_MODE === "true";
}
