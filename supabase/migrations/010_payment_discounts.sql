-- Add discount columns to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
