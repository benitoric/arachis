-- Migration 017: Reemplazar delivered BOOLEAN por delivered_date DATE en orders

-- 1. Agregar nueva columna
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_date DATE;

-- 2. Migrar datos existentes: si delivered = true, usar desired_date o en su defecto order_date
UPDATE public.orders
SET delivered_date = COALESCE(desired_date::date, order_date::date)
WHERE delivered = true;

-- 3. Eliminar columna antigua
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivered;
