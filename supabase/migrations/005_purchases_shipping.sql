-- Add shipping_cost_share column to purchases
-- Stores the portion of the total shipping cost allocated to each item in a multi-item purchase

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS shipping_cost_share numeric(12,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN purchases.shipping_cost_share IS
  'Porción del costo de envío imputada a este ítem, distribuida proporcionalmente por cantidad.';
