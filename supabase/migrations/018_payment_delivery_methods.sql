-- Migration 018: Agregar nuevas modalidades de pago y entrega

-- Eliminar constraints existentes
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_method_check;

-- Agregar nuevos constraints con valores extendidos
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('efectivo', 'transferencia', 'sin_cargo'));

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_method_check
  CHECK (delivery_method IN ('retiro', 'cadeteria', 'envio_gratis'));
