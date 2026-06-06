import express from "express";
import {
  getInventorySnapshot,
  getOrCreatePool,
  recordSale,
  setPoolQuantity,
  subscribeInventory,
} from "./services/inventoryService";

const router = express.Router();

// GET /api/inventory/draft/:draftId
router.get("/draft/:draftId", async (req, res) => {
  const draftId = Number(req.params.draftId);
  if (Number.isNaN(draftId)) {
    return res.status(400).json({ error: "Invalid draftId" });
  }
  try {
    const initial = Number(req.query.initialQuantity);
    if (Number.isFinite(initial) && initial >= 0) {
      await getOrCreatePool(draftId, initial);
    }
    const snapshot = await getInventorySnapshot(draftId);
    return res.json(snapshot);
  } catch (err) {
    console.error("[Inventory] GET draft:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load inventory",
    });
  }
});

// PUT /api/inventory/draft/:draftId/quantity
router.put("/draft/:draftId/quantity", async (req, res) => {
  const draftId = Number(req.params.draftId);
  const quantity = Number(req.body?.quantity);
  if (Number.isNaN(draftId) || Number.isNaN(quantity) || quantity < 0) {
    return res.status(400).json({ error: "draftId and quantity >= 0 required" });
  }
  try {
    const snapshot = await setPoolQuantity(draftId, quantity);
    return res.json(snapshot);
  } catch (err) {
    console.error("[Inventory] PUT quantity:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update quantity",
    });
  }
});

// POST /api/inventory/webhooks/:marketplace
// Body: { draftId, orderId, quantitySold? }
router.post("/webhooks/:marketplace", async (req, res) => {
  const marketplaceId = req.params.marketplace.toLowerCase();
  const draftId = Number(req.body?.draftId);
  const orderId = String(req.body?.orderId ?? req.body?.externalOrderId ?? "").trim();
  const quantitySold = Number(req.body?.quantitySold ?? 1);

  if (Number.isNaN(draftId) || !orderId) {
    return res.status(400).json({ error: "draftId and orderId required" });
  }

  try {
    const snapshot = await recordSale({
      draftId,
      marketplaceId,
      externalOrderId: orderId,
      quantitySold: Number.isFinite(quantitySold) ? quantitySold : 1,
    });
    return res.json({ success: true, ...snapshot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sale processing failed";
    const status = message.includes("Insufficient") ? 409 : 500;
    console.error("[Inventory] webhook:", err);
    return res.status(status).json({ error: message });
  }
});

// POST /api/inventory/draft/:draftId/simulate-sale (dev / test)
router.post("/draft/:draftId/simulate-sale", async (req, res) => {
  const draftId = Number(req.params.draftId);
  const marketplaceId = String(req.body?.marketplaceId ?? "ebay").toLowerCase();
  if (Number.isNaN(draftId)) {
    return res.status(400).json({ error: "Invalid draftId" });
  }
  const orderId =
    String(req.body?.orderId ?? "").trim() || `sim-${Date.now()}`;
  try {
    const snapshot = await recordSale({
      draftId,
      marketplaceId,
      externalOrderId: orderId,
      quantitySold: 1,
    });
    return res.json(snapshot);
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Simulate sale failed",
    });
  }
});

// GET /api/inventory/draft/:draftId/stream — SSE live updates
router.get("/draft/:draftId/stream", async (req, res) => {
  const draftId = Number(req.params.draftId);
  if (Number.isNaN(draftId)) {
    return res.status(400).end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const push = async () => {
    try {
      const snapshot = await getInventorySnapshot(draftId);
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch {
      /* ignore */
    }
  };

  await push();
  const unsubscribe = subscribeInventory(draftId, () => {
    void push();
  });

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
