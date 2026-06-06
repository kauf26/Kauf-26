import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../db";
import { productDrafts, inventoryPools } from "../../shared/schema";
import { eq } from "drizzle-orm";
import {
  getOrCreatePool,
  recordSale,
  setPoolQuantity,
} from "./inventoryService";

describe("inventoryService", () => {
  let draftId: number;

  beforeAll(async () => {
    const [draft] = await db
      .insert(productDrafts)
      .values({ title: "Inventory test draft", status: "draft" })
      .returning();
    draftId = draft.id;
  });

  afterAll(async () => {
    if (draftId) {
      await db.delete(inventoryPools).where(eq(inventoryPools.draftId, draftId));
      await db.delete(productDrafts).where(eq(productDrafts.id, draftId));
    }
  });

  it("creates pool and sets quantity", async () => {
    const pool = await getOrCreatePool(draftId, 50);
    expect(pool.quantity).toBe(50);

    const snap = await setPoolQuantity(draftId, 25);
    expect(snap.quantity).toBe(25);
  });

  it("decrements atomically and deduplicates sales", async () => {
    await setPoolQuantity(draftId, 3);

    const afterFirst = await recordSale({
      draftId,
      marketplaceId: "ebay",
      externalOrderId: "order-abc",
      quantitySold: 1,
    });
    expect(afterFirst.quantity).toBe(2);

    const dup = await recordSale({
      draftId,
      marketplaceId: "ebay",
      externalOrderId: "order-abc",
      quantitySold: 1,
    });
    expect(dup.quantity).toBe(2);

    const afterSecond = await recordSale({
      draftId,
      marketplaceId: "shopify",
      externalOrderId: "order-xyz",
      quantitySold: 1,
    });
    expect(afterSecond.quantity).toBe(1);
  });

  it("rejects sale when insufficient stock", async () => {
    await setPoolQuantity(draftId, 0);
    await expect(
      recordSale({
        draftId,
        marketplaceId: "ebay",
        externalOrderId: "order-overflow",
        quantitySold: 1,
      })
    ).rejects.toThrow(/Insufficient inventory/);
  });
});
