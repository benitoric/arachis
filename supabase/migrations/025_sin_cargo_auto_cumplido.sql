-- Migration 025: Auto-cumplido para pedidos sin cargo
--
-- Los pedidos con modalidad de pago "sin_cargo" no generan cobro, por lo
-- tanto el ciclo de vida termina con la entrega. Cuando un pedido sin cargo
-- está confirmado y tiene delivered_date, debe pasar a "cumplido".
--
-- 1) Backfill: actualizar los pedidos existentes que cumplen la condición.
-- 2) Trigger: aplicar la regla automáticamente para futuros INSERT/UPDATE.

-- ── 1) Backfill ─────────────────────────────────────────────────────────────
UPDATE public.orders
SET    status     = 'cumplido',
       updated_at = NOW()
WHERE  payment_method = 'sin_cargo'
  AND  status         = 'confirmado'
  AND  delivered_date IS NOT NULL;

-- ── 2) Trigger ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_cumplido_sin_cargo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_method = 'sin_cargo'
     AND NEW.status     = 'confirmado'
     AND NEW.delivered_date IS NOT NULL THEN
    NEW.status := 'cumplido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_cumplido_sin_cargo ON public.orders;

CREATE TRIGGER trg_auto_cumplido_sin_cargo
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_cumplido_sin_cargo();
