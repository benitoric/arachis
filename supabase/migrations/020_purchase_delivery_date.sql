-- 020_purchase_delivery_date.sql
-- Add delivery_date column to purchases table

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Existing purchases are already received — set delivery_date = date
UPDATE public.purchases SET delivery_date = date WHERE delivery_date IS NULL;
