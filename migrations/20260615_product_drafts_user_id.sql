ALTER TABLE "product_drafts"
  ADD COLUMN IF NOT EXISTS "user_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_drafts_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "product_drafts"
      ADD CONSTRAINT "product_drafts_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "product_drafts_user_id_idx" ON "product_drafts" ("user_id");
