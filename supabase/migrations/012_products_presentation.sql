-- Add presentation (gramos) column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS presentation INTEGER;

-- Migrate existing data: "Marroc (400g)" → name="Marroc", presentation=400
UPDATE public.products
SET
  presentation = CASE
    WHEN name ~ '\(([0-9]+)g\)'
    THEN (regexp_match(name, '\(([0-9]+)g\)'))[1]::INTEGER
    ELSE 0
  END,
  name = CASE
    WHEN name ~ '\(([0-9]+)g\)'
    THEN trim(regexp_replace(name, '\s*\([0-9]+g\).*$', ''))
    ELSE name
  END;

-- Default any remaining NULLs (products without "Xg" pattern)
UPDATE public.products SET presentation = 0 WHERE presentation IS NULL;

-- Make NOT NULL with default
ALTER TABLE public.products ALTER COLUMN presentation SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN presentation SET DEFAULT 0;

-- Unique constraint: no two products with same sabor + presentación
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_presentation
  ON public.products (lower(trim(name)), presentation)
  WHERE active = true OR active = false;
