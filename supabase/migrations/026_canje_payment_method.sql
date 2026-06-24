-- Migration 026: Modalidad de pago "canje"
--
-- Se entrega mercadería a cambio de un servicio (ej. publicidad). El importe
-- canjeado se imputa directamente a un rubro de gasto, igualando el efecto
-- en el resultado.

-- ── Permitir 'canje' en orders.payment_method ───────────────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('efectivo', 'transferencia', 'sin_cargo', 'canje'));

-- ── Permitir 'canje' en payments.method ─────────────────────────────────────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
  CHECK (method IN ('efectivo', 'transferencia', 'canje'));
