CREATE TABLE IF NOT EXISTS marketplace_auth (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  shop_domain TEXT,
  account_label TEXT,
  expires_at TIMESTAMP,
  connected BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_auth_user_marketplace_unique
  ON marketplace_auth (user_id, marketplace);

CREATE INDEX IF NOT EXISTS marketplace_auth_marketplace_idx
  ON marketplace_auth (marketplace);
