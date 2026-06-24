-- Migration 013: Renombrar estado 'listo' a 'cumplido' + campo anulation_reason + RLS portal fix

-- ── 1. Status: listo → cumplido ─────────────────────────────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE public.orders SET status = 'cumplido' WHERE status = 'listo';
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pendiente', 'confirmado', 'cumplido', 'anulado'));

-- ── 2. Campo motivo de anulación ─────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS anulation_reason TEXT;

-- ── 3. Campo delivered (por si la migration 009 no fue aplicada) ─────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;

-- ── 4. RLS: permitir inserción anónima en order_items y notifications (portal) ─
-- order_items
DROP POLICY IF EXISTS "Public can insert portal order_items" ON public.order_items;
CREATE POLICY "Public can insert portal order_items" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.origin = 'portal'
    )
  );

-- notifications
DROP POLICY IF EXISTS "Public can insert portal notifications" ON public.notifications;
CREATE POLICY "Public can insert portal notifications" ON public.notifications
  FOR INSERT TO anon
  WITH CHECK (true);
