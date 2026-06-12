import { describe, expect, it } from "vitest";
import { DEV_LOGIN_PIN, isDevLoginEnabled } from "./devAuth";

describe("devAuth", () => {
  it("is enabled only in development with MOCK_OAUTH_MODE=true", () => {
    expect(
      isDevLoginEnabled({ NODE_ENV: "development", MOCK_OAUTH_MODE: "true" })
    ).toBe(true);
    expect(
      isDevLoginEnabled({ NODE_ENV: "production", MOCK_OAUTH_MODE: "true" })
    ).toBe(false);
    expect(
      isDevLoginEnabled({ NODE_ENV: "development", MOCK_OAUTH_MODE: "false" })
    ).toBe(false);
  });

  it("uses fixed dev PIN", () => {
    expect(DEV_LOGIN_PIN).toBe("1234");
  });
});
