-- Migration 014: Marcar como leídas las notificaciones de pedidos anulados (limpieza)

UPDATE public.notifications
SET read = true
WHERE read = false
  AND order_id IN (
    SELECT id FROM public.orders WHERE status = 'anulado'
  );
