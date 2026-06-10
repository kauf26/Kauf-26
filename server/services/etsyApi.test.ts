import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
/**
 * Etsy API tests — HTTP mocked via vitest fetch stub.
 * Optional: `npm install -D nock` and swap to nock for stricter request matching.
 */
import {
  publishEtsyListing,
  uploadEtsyListingImages,
  formatEtsyApiError,
} from "./etsyApi";
import * as listingService from "./listingService";

describe("etsyApi image upload", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ETSY_CLIENT_ID: "test-etsy-key",
    };
    vi.spyOn(listingService, "getAccessTokenForListingPublish").mockResolvedValue(
      "oauth-access-token"
    );
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("formatEtsyApiError parses JSON error bodies", () => {
    const msg = formatEtsyApiError(
      400,
      JSON.stringify({ error: "invalid_grant", error_description: "Token expired" })
    );
    expect(msg).toContain("400");
    expect(msg).toContain("Token expired");
  });

  it("uploadEtsyListingImages POSTs to shops/{shop}/listings/{id}/images", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ listing_image_id: 1 }), { status: 201 })
    );

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;

    const result = await uploadEtsyListingImages(
      "999",
      "12345",
      "oauth-access-token",
      [dataUrl],
      fetchMock as typeof fetch
    );

    expect(result.uploaded).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/shops/999/listings/12345/images"
    );
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
  });

  it("publishEtsyListing creates draft then uploads images using OAuth token", async () => {
    fetchMock.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/users/me")) {
        return new Response(JSON.stringify({ shop_id: 999 }), { status: 200 });
      }
      if (u.endsWith("/listings") && init?.method === "POST") {
        return new Response(JSON.stringify({ listing_id: 12345 }), { status: 201 });
      }
      if (u.includes("/listings/12345/images")) {
        return new Response(JSON.stringify({ listing_image_id: 1 }), { status: 201 });
      }
      return new Response("not found", { status: 404 });
    });

    const tinyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const dataUrl = `data:image/png;base64,${tinyPng.toString("base64")}`;

    const result = await publishEtsyListing(
      {
        quantity: 1,
        title: "Test Item",
        description: "Desc",
        price: 25,
        who_made: "someone_else",
        when_made: "2020_2025",
        taxonomy_id: 1,
        type: "physical",
      },
      { images: [dataUrl], userId: null },
      fetchMock as typeof fetch
    );

    expect(result.listingId).toBe("12345");
    expect(result.imagesUploaded).toBe(1);
    expect(listingService.getAccessTokenForListingPublish).toHaveBeenCalledWith(
      "etsy",
      null
    );
  });

  it("surfaces Etsy API errors when listing create fails", async () => {
    fetchMock.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/users/me")) {
        return new Response(JSON.stringify({ shop_id: 999 }), { status: 200 });
      }
      if (u.endsWith("/listings") && init?.method === "POST") {
        return new Response(
          JSON.stringify({ error: "Bad Request", error_description: "Invalid taxonomy_id" }),
          { status: 400 }
        );
      }
      return new Response("not found", { status: 404 });
    });

    await expect(
      publishEtsyListing(
        {
          quantity: 1,
          title: "Bad",
          description: "Desc",
          price: 10,
          who_made: "someone_else",
          when_made: "2020_2025",
          taxonomy_id: 0,
          type: "physical",
        },
        { images: [], userId: null },
        fetchMock as typeof fetch
      )
    ).rejects.toThrow(/Invalid taxonomy_id/);
  });
});
