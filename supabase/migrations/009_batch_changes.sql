-- ==========================================================
-- MIGRACIÓN 009: Estados pedidos + Nombre/Apellido clientes
-- ==========================================================

-- ─────────────────────────────────────────────────────────
-- 1. ORDERS: Agregar campo delivered
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────
-- 2. ORDERS: Migrar estados anteriores → nuevos estados
--    en_produccion → confirmado
--    entregado     → confirmado + delivered=true
--    cobrado       → listo     + delivered=true
-- ─────────────────────────────────────────────────────────
UPDATE public.orders SET status = 'confirmado'
  WHERE status = 'en_produccion';

UPDATE public.orders SET status = 'confirmado', delivered = true
  WHERE status = 'entregado';

UPDATE public.orders SET status = 'listo', delivered = true
  WHERE status = 'cobrado';

-- ─────────────────────────────────────────────────────────
-- 3. ORDERS: Actualizar constraint de status
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pendiente', 'confirmado', 'listo', 'anulado'));

-- ─────────────────────────────────────────────────────────
-- 4. CLIENTS: Agregar first_name y last_name
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

-- ─────────────────────────────────────────────────────────
-- 5. CLIENTS: Migrar business_name → last_name, first_name
--    La mayoría están como "Apellido, Nombre"
-- ─────────────────────────────────────────────────────────
UPDATE public.clients SET
  last_name = CASE
    WHEN position(', ' IN business_name) > 0
    THEN trim(substring(business_name FROM 1 FOR position(', ' IN business_name) - 1))
    ELSE trim(business_name)
  END,
  first_name = CASE
    WHEN position(', ' IN business_name) > 0
    THEN trim(substring(business_name FROM position(', ' IN business_name) + 2))
    ELSE ''
  END;

-- ─────────────────────────────────────────────────────────
-- 6. CLIENTS: Eliminar columna business_name
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS business_name;

-- Actualizar índice de ordenamiento
DROP INDEX IF EXISTS idx_clients_business_name;
CREATE INDEX IF NOT EXISTS idx_clients_last_name ON public.clients(last_name);
