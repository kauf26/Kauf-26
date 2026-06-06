/**
 * Optional polling job — checks marketplace order APIs every 5 minutes.
 * Enable with INVENTORY_POLL_ENABLED=true
 */
import { db } from "./db";
import { inventoryPools } from "../shared/schema";
import { eq } from "drizzle-orm";
import { recordSale } from "./services/inventoryService";

const POLL_MS = Number(process.env.INVENTORY_POLL_INTERVAL_MS ?? 5 * 60 * 1000);

async function pollMarketplaceOrders(): Promise<void> {
  const pools = await db
    .select()
    .from(inventoryPools)
    .where(eq(inventoryPools.status, "active"));

  for (const pool of pools) {
    if (pool.quantity <= 0) continue;
    // Placeholder: real implementation would call each marketplace orders API
    // and invoke recordSale for new order IDs (dedup handles idempotency).
    void pool;
  }
}

export function startInventoryPoller(): void {
  if (process.env.INVENTORY_POLL_ENABLED !== "true") {
    console.log(
      "[InventoryPoller] Disabled (set INVENTORY_POLL_ENABLED=true to enable)"
    );
    return;
  }
  console.log(`[InventoryPoller] Started — polling every ${POLL_MS / 1000}s`);
  setInterval(() => {
    void pollMarketplaceOrders().catch((err) => {
      console.error("[InventoryPoller] Error:", err);
    });
  }, POLL_MS);
}
