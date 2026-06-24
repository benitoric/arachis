-- Add finalized_at to inventory_counts to track completion status
ALTER TABLE public.inventory_counts
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
