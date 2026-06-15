import { AsyncLocalStorage } from "node:async_hooks";

/** Per-request marketplace credentials — never persisted by the server. */
export type ClientMarketplaceCredential = {
  accessToken: string;
  refreshToken?: string;
  shopDomain?: string;
  shopId?: string;
};

export type PublishTokenContext = {
  marketplaceTokens?: Record<string, ClientMarketplaceCredential>;
};

const storage = new AsyncLocalStorage<PublishTokenContext>();

export function runWithPublishTokens<T>(
  ctx: PublishTokenContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return storage.run(ctx, fn);
}

export function getClientMarketplaceToken(
  marketplaceId: string
): ClientMarketplaceCredential | null {
  const bundle = storage.getStore()?.marketplaceTokens?.[marketplaceId.toLowerCase()];
  if (!bundle?.accessToken?.trim()) return null;
  return bundle;
}

export function parseMarketplaceTokensFromBody(
  body: unknown
): Record<string, ClientMarketplaceCredential> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const raw = (body as { marketplaceTokens?: unknown }).marketplaceTokens;
  if (!raw || typeof raw !== "object") return undefined;

  const out: Record<string, ClientMarketplaceCredential> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const accessToken = typeof row.accessToken === "string" ? row.accessToken.trim() : "";
    if (!accessToken) continue;
    out[id.toLowerCase()] = {
      accessToken,
      refreshToken:
        typeof row.refreshToken === "string" ? row.refreshToken : undefined,
      shopDomain:
        typeof row.shopDomain === "string" ? row.shopDomain : undefined,
      shopId: typeof row.shopId === "string" ? row.shopId : undefined,
    };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Web session tokens (never written to marketplace_connections). */
export function marketplaceTokensFromSession(
  session: { marketplaceSessionTokens?: Record<string, { accessToken?: string; refreshToken?: string; shopDomain?: string; marketplaceShopId?: string }> } | undefined
): Record<string, ClientMarketplaceCredential> {
  const raw = session?.marketplaceSessionTokens;
  if (!raw) return {};

  const out: Record<string, ClientMarketplaceCredential> = {};
  for (const [id, row] of Object.entries(raw)) {
    const accessToken = row?.accessToken?.trim();
    if (!accessToken) continue;
    out[id.toLowerCase()] = {
      accessToken,
      refreshToken: row.refreshToken,
      shopDomain: row.shopDomain,
      shopId: row.marketplaceShopId,
    };
  }
  return out;
}

/** Merge request-body tokens (mobile) with session tokens (web). Body wins on conflict. */
export function mergePublishTokenSources(
  body: unknown,
  session?: { marketplaceSessionTokens?: Record<string, { accessToken?: string; refreshToken?: string; shopDomain?: string; marketplaceShopId?: string }> }
): PublishTokenContext["marketplaceTokens"] {
  const fromBody = parseMarketplaceTokensFromBody(body) ?? {};
  const fromSession = marketplaceTokensFromSession(session);
  const merged = { ...fromSession, ...fromBody };
  return Object.keys(merged).length > 0 ? merged : undefined;
}
