-- 004_costs_price_history.sql
-- Updates product_costs schema and adds price list history tables

-- 1. Update product_costs: add new fields
ALTER TABLE public.product_costs
  ADD COLUMN IF NOT EXISTS labor_cost        NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0;

-- 2. Drop price_otra (no longer used — "otra" prices are defined per order)
ALTER TABLE public.product_costs
  DROP COLUMN IF EXISTS price_otra;

-- 3. Price list history header
CREATE TABLE IF NOT EXISTS public.price_list_history (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Price list history items (snapshot per product)
CREATE TABLE IF NOT EXISTS public.price_list_history_items (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  history_id          UUID    NOT NULL REFERENCES public.price_list_history(id) ON DELETE CASCADE,
  product_id          UUID    NOT NULL REFERENCES public.products(id),
  product_name        TEXT    NOT NULL,
  direct_cost         NUMERIC NOT NULL DEFAULT 0,
  labor_cost          NUMERIC NOT NULL DEFAULT 0,
  total_cost          NUMERIC NOT NULL DEFAULT 0,
  margin_percentage   NUMERIC NOT NULL DEFAULT 0,
  price_minorista     NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC NOT NULL DEFAULT 0,
  price_mayorista     NUMERIC NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_list_history_items_history_id
  ON public.price_list_history_items(history_id);
