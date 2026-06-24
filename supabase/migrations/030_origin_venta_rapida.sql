-- Migration 030: Nuevo origen "venta_rapida" para ventas en el momento
--
-- Las ventas rápidas son ventas espontáneas (sin pedido previo) donde la
-- entrega ocurre en el acto y el cobro puede hacerse en el momento o quedar
-- pendiente. Se distinguen con un origen propio para poder filtrarlas y
-- analizarlas por separado de los pedidos manuales y del portal.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_origin_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_origin_check
  CHECK (origin IN ('manual', 'portal', 'venta_rapida'));
