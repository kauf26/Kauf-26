-- Deprecate encrypted marketplace token columns (tokens live on device only).
-- Safe to run on existing databases; drops legacy token payload fields.

ALTER TABLE IF EXISTS marketplace_connections
  DROP COLUMN IF EXISTS encrypted_payload,
  DROP COLUMN IF EXISTS iv,
  DROP COLUMN IF EXISTS auth_tag,
  DROP COLUMN IF EXISTS token_expires_at;

ALTER TABLE IF EXISTS marketplace_auth
  DROP COLUMN IF EXISTS encrypted_payload,
  DROP COLUMN IF EXISTS iv,
  DROP COLUMN IF EXISTS auth_tag,
  DROP COLUMN IF EXISTS token_expires_at;
