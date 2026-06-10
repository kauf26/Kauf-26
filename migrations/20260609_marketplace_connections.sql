-- Universal marketplace OAuth connections (encrypted tokens at rest)
CREATE TABLE IF NOT EXISTS marketplace_connections (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  token_expires_at TIMESTAMP,
  scope TEXT,
  marketplace_shop_id TEXT,
  shop_domain TEXT,
  account_label TEXT,
  connected BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_connections_user_provider_unique
  ON marketplace_connections (user_id, provider);

CREATE INDEX IF NOT EXISTS marketplace_connections_provider_idx
  ON marketplace_connections (provider);

-- Migrate legacy marketplace_auth rows when present
INSERT INTO marketplace_connections (
  user_id,
  provider,
  encrypted_payload,
  iv,
  auth_tag,
  token_expires_at,
  shop_domain,
  account_label,
  connected,
  created_at,
  updated_at
)
SELECT
  user_id,
  marketplace,
  encrypted_payload,
  iv,
  auth_tag,
  expires_at,
  shop_domain,
  account_label,
  connected,
  created_at,
  updated_at
FROM marketplace_auth
WHERE NOT EXISTS (
  SELECT 1 FROM marketplace_connections mc
  WHERE mc.user_id IS NOT DISTINCT FROM marketplace_auth.user_id
    AND mc.provider = marketplace_auth.marketplace
);
