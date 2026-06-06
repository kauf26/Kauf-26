import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { publishToMarketplacesParallel } from "./publishEngine";
import type { DraftPublishPayload } from "../publishToMarketplaces";

const minimalDraft: DraftPublishPayload = {
  draftId: 1,
  title: "Test Cap",
  sku: "TEST-SKU",
  images: ["data:image/jpeg;base64,abc"],
  attributes: {
    brand: "Test",
    condition: "Used",
    medianPrice: "25",
    marketPrices: { recommendedPrice: "25" },
    aiDescription: "A test product",
  },
};

describe("publishToMarketplacesParallel", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.EBAY_CLIENT_ID;
    delete process.env.ALLEGRO_CLIENT_ID;
    delete process.env.FACEBOOK_ACCESS_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("posts to all requested marketplaces simultaneously (dry-run without credentials)", async () => {
    const outcomes = await publishToMarketplacesParallel(minimalDraft, [
      "ebay",
      "allegro",
      "facebook",
    ]);

    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.success)).toBe(true);
    expect(outcomes.map((o) => o.marketplace).sort()).toEqual(
      ["allegro", "ebay", "facebook"].sort()
    );
    expect(outcomes.every((o) => o.dryRun === true)).toBe(true);
  });

  it("continues when one marketplace adapter throws", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes("identity/v1/oauth2/token")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (u.includes("/sell/inventory/v1/inventory_item/")) {
        return new Response("", { status: 500, statusText: "Server Error" });
      }
      return new Response(JSON.stringify({ id: "allegro-1" }), { status: 200 });
    });

    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
    process.env.EBAY_REFRESH_TOKEN = "refresh";
    process.env.ALLEGRO_CLIENT_ID = "id";
    process.env.ALLEGRO_CLIENT_SECRET = "secret";

    const outcomes = await publishToMarketplacesParallel(
      minimalDraft,
      ["ebay", "allegro"],
      fetchMock as typeof fetch
    );

    expect(outcomes).toHaveLength(2);
    const ebay = outcomes.find((o) => o.marketplace === "ebay");
    const allegro = outcomes.find((o) => o.marketplace === "allegro");
    expect(ebay?.success).toBe(false);
    expect(allegro?.success).toBe(true);
  });

  it("uses mocked eBay + Allegro success paths", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("oauth2/token") || u.includes("oauth/token")) {
        return new Response(
          JSON.stringify({ access_token: "tok", expires_in: 3600 }),
          { status: 200 }
        );
      }
      if (u.includes("/sell/inventory/v1/inventory_item/")) {
        return new Response("", { status: 200 });
      }
      if (u.includes("/publish") && init?.method === "POST") {
        return new Response(JSON.stringify({ listingId: "ebay-123" }), {
          status: 200,
        });
      }
      if (u.endsWith("/offer") && init?.method === "POST") {
        return new Response(JSON.stringify({ offerId: "offer-1" }), {
          status: 200,
        });
      }
      if (u.includes("sale/product-offers")) {
        return new Response(JSON.stringify({ id: "allegro-456" }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 404 });
    });

    process.env.EBAY_CLIENT_ID = "id";
    process.env.EBAY_CLIENT_SECRET = "secret";
    process.env.EBAY_REFRESH_TOKEN = "refresh";
    process.env.ALLEGRO_CLIENT_ID = "id";
    process.env.ALLEGRO_CLIENT_SECRET = "secret";

    const outcomes = await publishToMarketplacesParallel(
      minimalDraft,
      ["ebay", "allegro"],
      fetchMock as typeof fetch
    );

    expect(outcomes.every((o) => o.success)).toBe(true);
    expect(outcomes.find((o) => o.marketplace === "ebay")?.listingId).toBe(
      "ebay-123"
    );
    expect(outcomes.find((o) => o.marketplace === "allegro")?.listingId).toBe(
      "allegro-456"
    );
  });
});
