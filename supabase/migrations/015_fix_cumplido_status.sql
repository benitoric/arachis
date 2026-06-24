-- Migration 015: Revertir pedidos incorrectamente marcados como "cumplido"
-- Un pedido "cumplido" debe cumplir AMBAS condiciones:
--   1. delivered = true
--   2. saldo cobrado = total del pedido (balance <= 0.01)

-- Revertir a "confirmado" los pedidos cumplidos que NO cumplan ambas condiciones
UPDATE public.orders o
SET status = 'confirmado', updated_at = NOW()
WHERE o.status = 'cumplido'
  AND (
    o.delivered = false
    OR (
      o.id NOT IN (
        SELECT oi_ord.id
        FROM public.orders oi_ord
        JOIN public.order_items oi ON oi.order_id = oi_ord.id
        LEFT JOIN public.payments p ON p.order_id = oi_ord.id
        GROUP BY oi_ord.id
        HAVING COALESCE(SUM(p.amount), 0) >= SUM(oi.quantity * oi.unit_price) - 0.01
      )
    )
  );

-- Verificación: mostrar cuántos pedidos fueron revertidos (debería ser >= 1 para #0005)
-- SELECT order_number, status, delivered FROM public.orders
-- WHERE order_number IN (5) ORDER BY order_number;
