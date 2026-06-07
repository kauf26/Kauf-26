import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { decryptJson, encryptJson } from "./encryption";

describe("session encryption", () => {
  const prev = process.env.SESSION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SESSION_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.SESSION_ENCRYPTION_KEY;
    else process.env.SESSION_ENCRYPTION_KEY = prev;
  });

  it("round-trips Playwright storageState JSON", () => {
    const payload = {
      cookies: [{ name: "sid", value: "abc", domain: ".ebay.com" }],
      origins: [{ origin: "https://www.ebay.com", localStorage: [] }],
    };
    const encrypted = encryptJson(payload);
    expect(decryptJson(encrypted)).toEqual(payload);
  });
});
