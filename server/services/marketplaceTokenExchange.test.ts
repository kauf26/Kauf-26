import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  isOAuthExchangeSupported,
  resolveServerClientSecret,
} from "./marketplaceTokenExchange";

describe("marketplaceTokenExchange", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("maps EXPO_PUBLIC mobile secret env names to server env keys", () => {
    process.env.EBAY_CLIENT_SECRET = "server-ebay-secret";
    expect(resolveServerClientSecret("ebay")).toBe("server-ebay-secret");
  });

  it("supports oauth marketplaces from manifest", () => {
    expect(isOAuthExchangeSupported("etsy")).toBe(true);
    expect(isOAuthExchangeSupported("depop")).toBe(false);
  });
});
