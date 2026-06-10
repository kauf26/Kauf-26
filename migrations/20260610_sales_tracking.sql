-- Sales payment & fulfillment tracking
-- psql $DATABASE_URL -f migrations/20260610_sales_tracking.sql

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'not_shipped',
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

UPDATE sales SET payment_status = 'pending' WHERE payment_status IS NULL;
UPDATE sales SET fulfillment_status = 'not_shipped' WHERE fulfillment_status IS NULL;
