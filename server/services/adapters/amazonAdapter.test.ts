import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { publishToAmazon } from "./amazonAdapter";
import * as listingService from "../listingService";

describe("amazonAdapter OAuth", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AMAZON_CLIENT_ID: "amzn-client-id",
      AMAZON_CLIENT_SECRET: "amzn-client-secret",
      AMAZON_SELLER_ID: "SELLER123",
    };
    fetchMock = vi.fn();
    vi.spyOn(listingService, "getAccessTokenForListingPublish").mockResolvedValue(
      "oauth-amazon-token"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it("uses per-request OAuth token for SP-API publish", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ submissionId: "sub-1" }), { status: 200 })
    );

    const formatted = {
      marketplace: "amazon",
      sku: "SKU-001",
      apiBody: { productType: "PRODUCT", requirements: "LISTING", attributes: {} },
    };

    const result = await publishToAmazon(formatted, fetchMock as typeof fetch, null);

    expect(listingService.getAccessTokenForListingPublish).toHaveBeenCalledWith("amazon", null);
    expect(result.dryRun).toBe(false);
    expect(result.listingId).toBe("sub-1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/listings/2021-08-01/items/SELLER123/SKU-001"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth-amazon-token",
          "x-amz-access-token": "oauth-amazon-token",
        }),
      })
    );
  });

  it("throws when Amazon OAuth token is missing", async () => {
    vi.mocked(listingService.getAccessTokenForListingPublish).mockResolvedValueOnce(null);

    await expect(
      publishToAmazon(
        {
          marketplace: "amazon",
          sku: "SKU-002",
          apiBody: { productType: "PRODUCT" },
        },
        fetchMock as typeof fetch,
        null
      )
    ).rejects.toThrow("Amazon account not connected. Please connect in Connections.");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
