/**
 * Central inventory pool — shared quantity across marketplace listings.
 * Uses row-level locking (SELECT FOR UPDATE) to prevent negative quantity.
 */
import { db, pool as pgPool } from "../db";
import {
  inventoryMarketplaceListings,
  inventoryPools,
  inventorySaleDedup,
  inventorySyncEvents,
  productDrafts,
} from "../../shared/schema";
import { and, desc, eq } from "drizzle-orm";
import { pushQuantityToAllListings } from "./inventoryMarketplaceSync";

export type InventorySnapshot = {
  poolId: number;
  draftId: number;
  quantity: number;
  version: number;
  status: "active" | "out_of_stock";
  sku: string | null;
  listings: Array<{
    marketplaceId: string;
    listingId: string | null;
    status: string;
    lastSyncedQuantity: number | null;
  }>;
  events: Array<{
    id: number;
    eventType: string;
    marketplaceId: string | null;
    message: string;
    quantityBefore: number | null;
    quantityAfter: number | null;
    createdAt: Date | null;
  }>;
};

const listeners = new Map<number, Set<() => void>>();

export function subscribeInventory(draftId: number, cb: () => void): () => void {
  if (!listeners.has(draftId)) listeners.set(draftId, new Set());
  listeners.get(draftId)!.add(cb);
  return () => listeners.get(draftId)?.delete(cb);
}

function notifyInventory(draftId: number): void {
  for (const cb of listeners.get(draftId) ?? []) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
}

async function logEvent(
  poolId: number,
  event: {
    eventType: string;
    marketplaceId?: string;
    message: string;
    quantityBefore?: number;
    quantityAfter?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(inventorySyncEvents).values({
    poolId,
    eventType: event.eventType,
    marketplaceId: event.marketplaceId ?? null,
    message: event.message,
    quantityBefore: event.quantityBefore ?? null,
    quantityAfter: event.quantityAfter ?? null,
    metadata: event.metadata ?? null,
  });
}

export async function getPoolByDraftId(
  draftId: number
): Promise<typeof inventoryPools.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(inventoryPools)
    .where(eq(inventoryPools.draftId, draftId));
  return row ?? null;
}

export async function getOrCreatePool(
  draftId: number,
  initialQuantity = 1
): Promise<typeof inventoryPools.$inferSelect> {
  const existing = await getPoolByDraftId(draftId);
  if (existing) return existing;

  const [draft] = await db
    .select()
    .from(productDrafts)
    .where(eq(productDrafts.id, draftId));
  const qty = Math.max(0, Math.floor(initialQuantity));

  const [created] = await db
    .insert(inventoryPools)
    .values({
      draftId,
      quantity: qty,
      sku: draft?.sku ?? `draft-${draftId}`,
      status: qty > 0 ? "active" : "out_of_stock",
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    await logEvent(created.id, {
      eventType: "initialized",
      message: `Inventory pool created with quantity ${qty}`,
      quantityAfter: qty,
    });
    return created;
  }

  return (await getPoolByDraftId(draftId))!;
}

export async function registerMarketplaceListing(
  draftId: number,
  marketplaceId: string,
  listingId: string | null,
  sku?: string | null
): Promise<void> {
  const invPool = await getOrCreatePool(draftId);
  const [existing] = await db
    .select()
    .from(inventoryMarketplaceListings)
    .where(
      and(
        eq(inventoryMarketplaceListings.poolId, invPool.id),
        eq(inventoryMarketplaceListings.marketplaceId, marketplaceId)
      )
    );

  if (existing) {
    await db
      .update(inventoryMarketplaceListings)
      .set({
        listingId: listingId ?? existing.listingId,
        sku: sku ?? existing.sku,
        lastSyncedQuantity: invPool.quantity,
        updatedAt: new Date(),
      })
      .where(eq(inventoryMarketplaceListings.id, existing.id));
  } else {
    await db.insert(inventoryMarketplaceListings).values({
      poolId: invPool.id,
      marketplaceId,
      listingId,
      sku: sku ?? invPool.sku,
      lastSyncedQuantity: invPool.quantity,
    });
    await logEvent(invPool.id, {
      eventType: "listing_registered",
      marketplaceId,
      message: `Registered ${marketplaceId} listing ${listingId ?? "pending"}`,
      quantityAfter: invPool.quantity,
    });
  }

  await syncPoolToMarketplaces(invPool.id);
  notifyInventory(draftId);
}

export async function setPoolQuantity(
  draftId: number,
  quantity: number
): Promise<InventorySnapshot> {
  const qty = Math.max(0, Math.floor(quantity));
  const invPool = await getOrCreatePool(draftId, qty);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{
      id: number;
      quantity: number;
      version: number;
    }>(
      `SELECT id, quantity, version FROM inventory_pools WHERE id = $1 FOR UPDATE`,
      [invPool.id]
    );
    const row = locked.rows[0];
    if (!row) throw new Error("Pool not found");

    const before = row.quantity;
    const status = qty === 0 ? "out_of_stock" : "active";

    await client.query(
      `UPDATE inventory_pools
       SET quantity = $1, version = version + 1, status = $2, updated_at = NOW()
       WHERE id = $3`,
      [qty, status, row.id]
    );
    await client.query("COMMIT");

    await logEvent(row.id, {
      eventType: "manual_set",
      message: `Quantity manually set to ${qty}`,
      quantityBefore: before,
      quantityAfter: qty,
    });

    await syncPoolToMarketplaces(row.id);
    notifyInventory(draftId);
    return getInventorySnapshot(draftId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function recordSale(params: {
  draftId: number;
  marketplaceId: string;
  externalOrderId: string;
  quantitySold?: number;
}): Promise<InventorySnapshot> {
  const sold = Math.max(1, Math.floor(params.quantitySold ?? 1));
  const invPool = await getOrCreatePool(params.draftId);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const dedup = await client.query(
      `SELECT id FROM inventory_sale_dedup
       WHERE pool_id = $1 AND marketplace_id = $2 AND external_order_id = $3`,
      [invPool.id, params.marketplaceId, params.externalOrderId]
    );
    if (dedup.rows.length > 0) {
      await client.query("COMMIT");
      return getInventorySnapshot(params.draftId);
    }

    const locked = await client.query<{
      id: number;
      quantity: number;
      draft_id: number;
    }>(
      `SELECT id, quantity, draft_id FROM inventory_pools WHERE id = $1 FOR UPDATE`,
      [invPool.id]
    );
    const row = locked.rows[0];
    if (!row) throw new Error("Pool not found");

    const before = row.quantity;
    if (before < sold) {
      await client.query("ROLLBACK");
      throw new Error(
        `Insufficient inventory: ${before} available, ${sold} requested`
      );
    }

    const after = before - sold;
    const status = after === 0 ? "out_of_stock" : "active";

    await client.query(
      `UPDATE inventory_pools
       SET quantity = $1, version = version + 1, status = $2, updated_at = NOW()
       WHERE id = $3`,
      [after, status, row.id]
    );

    await client.query(
      `INSERT INTO inventory_sale_dedup (pool_id, marketplace_id, external_order_id)
       VALUES ($1, $2, $3)`,
      [row.id, params.marketplaceId, params.externalOrderId]
    );

    await client.query("COMMIT");

    const label =
      params.marketplaceId.charAt(0).toUpperCase() +
      params.marketplaceId.slice(1);
    await logEvent(row.id, {
      eventType: "sale",
      marketplaceId: params.marketplaceId,
      message: `Sold ${sold} on ${label} → quantity now ${after}`,
      quantityBefore: before,
      quantityAfter: after,
      metadata: { externalOrderId: params.externalOrderId, sold },
    });

    await syncPoolToMarketplaces(row.id);
    notifyInventory(params.draftId);
    return getInventorySnapshot(params.draftId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function syncPoolToMarketplaces(poolId: number): Promise<void> {
  const [poolRow] = await db
    .select()
    .from(inventoryPools)
    .where(eq(inventoryPools.id, poolId));
  if (!poolRow) return;

  const listings = await db
    .select()
    .from(inventoryMarketplaceListings)
    .where(eq(inventoryMarketplaceListings.poolId, poolId));

  const results = await pushQuantityToAllListings(listings, poolRow.quantity);

  for (const listing of listings) {
    const result = results.find((r) => r.marketplaceId === listing.marketplaceId);
    await db
      .update(inventoryMarketplaceListings)
      .set({
        lastSyncedQuantity: poolRow.quantity,
        status: poolRow.quantity === 0 ? "out_of_stock" : "active",
        updatedAt: new Date(),
      })
      .where(eq(inventoryMarketplaceListings.id, listing.id));

    if (result) {
      await logEvent(poolId, {
        eventType: poolRow.quantity === 0 ? "out_of_stock" : "sync_push",
        marketplaceId: listing.marketplaceId,
        message: result.message,
        quantityAfter: poolRow.quantity,
      });
    }
  }
}

export async function getInventorySnapshot(
  draftId: number
): Promise<InventorySnapshot> {
  const invPool = await getOrCreatePool(draftId);

  const listings = await db
    .select()
    .from(inventoryMarketplaceListings)
    .where(eq(inventoryMarketplaceListings.poolId, invPool.id));

  const events = await db
    .select()
    .from(inventorySyncEvents)
    .where(eq(inventorySyncEvents.poolId, invPool.id))
    .orderBy(desc(inventorySyncEvents.createdAt))
    .limit(20);

  return {
    poolId: invPool.id,
    draftId: invPool.draftId,
    quantity: invPool.quantity,
    version: invPool.version,
    status: (invPool.status as "active" | "out_of_stock") ?? "active",
    sku: invPool.sku,
    listings: listings.map((l) => ({
      marketplaceId: l.marketplaceId,
      listingId: l.listingId,
      status: l.status,
      lastSyncedQuantity: l.lastSyncedQuantity,
    })),
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      marketplaceId: e.marketplaceId,
      message: e.message,
      quantityBefore: e.quantityBefore,
      quantityAfter: e.quantityAfter,
      createdAt: e.createdAt,
    })),
  };
}
