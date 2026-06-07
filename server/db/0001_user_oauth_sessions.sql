ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oauth_provider" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_image_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed" boolean DEFAULT false NOT NULL;

CREATE TABLE IF NOT EXISTS "user_marketplace_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "marketplace_id" text NOT NULL,
  "encrypted_payload" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_marketplace_sessions_user_marketplace_unique"
  ON "user_marketplace_sessions" ("user_id", "marketplace_id");
