-- Run manually if `npm run db:push` prompts interactively:
-- psql $DATABASE_URL -f migrations/20260610_shipping_labels.sql

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS shipping_label_created BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS shipping_labels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  from_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  to_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  package_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  service TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  label_pdf_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS shipping_labels_sale_id_idx ON shipping_labels(sale_id);
