import React, { useCallback, useEffect, useState } from "react";

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
    createdAt: string | null;
  }>;
};

type Props = {
  draftId: number | null;
  initialQuantity?: number;
};

export default function InventoryQuantityCounter({
  draftId,
  initialQuantity = 1,
}: Props) {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [inputQty, setInputQty] = useState(String(initialQuantity));
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (draftId == null) return;
    try {
      const res = await fetch(
        `/api/inventory/draft/${draftId}?initialQuantity=${encodeURIComponent(String(initialQuantity))}`
      );
      if (!res.ok) throw new Error("Failed to load inventory");
      const data = (await res.json()) as InventorySnapshot;
      setSnapshot(data);
      setInputQty(String(data.quantity));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }, [draftId, initialQuantity]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (draftId == null) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/inventory/draft/${draftId}/stream`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as InventorySnapshot;
          setSnapshot(data);
          setInputQty(String(data.quantity));
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
      };
    } catch {
      /* SSE unsupported — fallback poll */
    }

    const poll = setInterval(() => void load(), 4000);

    return () => {
      es?.close();
      clearInterval(poll);
    };
  }, [draftId, load]);

  const applyQuantity = async (qty: number) => {
    if (draftId == null) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/draft/${draftId}/quantity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Update failed");
      }
      const data = (await res.json()) as InventorySnapshot;
      setSnapshot(data);
      setInputQty(String(data.quantity));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleManualOverride = () => {
    const qty = Math.max(0, Math.floor(Number(inputQty) || 0));
    void applyQuantity(qty);
  };

  const step = (delta: number) => {
    const current = snapshot?.quantity ?? Math.max(0, Number(inputQty) || 0);
    void applyQuantity(Math.max(0, current + delta));
  };

  if (draftId == null) {
    return (
      <div className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-200">
        Save a product draft first to enable shared inventory tracking.
      </div>
    );
  }

  const remaining = (snapshot?.quantity ?? Number(inputQty)) || 0;
  const outOfStock = snapshot?.status === "out_of_stock" || remaining === 0;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
          Shared Inventory
        </h3>
      </div>

      <p className="text-xs text-zinc-500">
        One quantity pool shared across eBay, Etsy, Shopify, and all selected
        marketplaces. Sales on any channel decrement this counter and sync to
        every listing.
      </p>

      <div
        className={`text-center py-3 rounded-lg border ${
          outOfStock
            ? "border-red-800/60 bg-red-950/30"
            : "border-emerald-800/40 bg-emerald-950/20"
        }`}
      >
        <div className="text-xs text-zinc-500 uppercase tracking-wide">
          Remaining
        </div>
        <div
          className={`text-4xl font-bold tabular-nums ${
            outOfStock ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {remaining}
        </div>
        {outOfStock && (
          <div className="text-xs text-red-300 mt-1">
            Out of stock — all marketplaces set to 0
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={syncing || remaining <= 0}
          className="w-12 h-12 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xl font-bold"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={inputQty}
          onChange={(e) => setInputQty(e.target.value)}
          className="flex-1 text-center bg-zinc-900 border border-zinc-700 rounded-lg py-2 text-lg font-semibold tabular-nums"
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={syncing}
          className="w-12 h-12 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xl font-bold"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={handleManualOverride}
        disabled={syncing}
        className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-sm font-semibold text-white"
      >
        {syncing ? "Syncing to marketplaces…" : "Apply & sync to all listings"}
      </button>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {snapshot && snapshot.listings.length > 0 && (
        <div className="text-xs text-zinc-500 space-y-1">
          <div className="font-medium text-zinc-400">Linked listings</div>
          {snapshot.listings.map((l) => (
            <div key={l.marketplaceId} className="flex justify-between">
              <span>{l.marketplaceId}</span>
              <span>
                sync: {l.lastSyncedQuantity ?? "—"} · {l.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {snapshot && snapshot.events.length > 0 && (
        <div className="border-t border-zinc-800 pt-3 space-y-1 max-h-36 overflow-y-auto">
          <div className="text-xs font-medium text-zinc-400 mb-1">
            Recent sync events
          </div>
          {snapshot.events.slice(0, 8).map((ev) => (
            <div
              key={ev.id}
              className="text-xs text-zinc-500 leading-snug"
            >
              {ev.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
