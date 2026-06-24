-- 007_notifications_cascade.sql
-- 1. Elimina notificaciones huérfanas (order_id quedó NULL porque el pedido fue eliminado)
-- 2. Cambia el FK de ON DELETE SET NULL a ON DELETE CASCADE para que sea automático

-- Paso 1: limpiar huérfanas existentes.
-- Las notificaciones de tipo nuevo_pedido_portal siempre deben tener order_id;
-- si está NULL es porque el pedido fue eliminado previamente.
DELETE FROM public.notifications
WHERE order_id IS NULL
  AND type = 'nuevo_pedido_portal';

-- Paso 2: reemplazar el FK con comportamiento CASCADE
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_order_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES public.orders(id)
    ON DELETE CASCADE;
