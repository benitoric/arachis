-- Migration 016: Agregar campo "brand" (marca) a la tabla purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS brand TEXT;
