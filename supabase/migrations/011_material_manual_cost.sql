-- Add manual unit cost to materials table
ALTER TABLE materials ADD COLUMN IF NOT EXISTS manual_unit_cost NUMERIC;
