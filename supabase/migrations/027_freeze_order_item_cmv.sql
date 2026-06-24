-- Migration 027: Congelar el costo de mercadería vendida (CMV) por línea de venta
--
-- Hasta ahora el CMV de cada venta se recalculaba al generar el reporte usando
-- los costos vigentes de los materiales. Como consecuencia, el margen de una
-- venta vieja cambiaba retroactivamente cada vez que subían los costos.
--
-- A partir de esta migración el CMV unitario se congela en order_items.unit_cost
-- al momento de la venta, usando el método de "costo de reposición":
--   - Por cada material de la receta, se toma el unit_cost de la última compra
--     con fecha <= order_date.
--   - Si el material no tiene compras registradas, se usa materials.manual_unit_cost
--     como fallback.
--   - Si tampoco hay manual, vale 0.
--
-- Cobertura:
--   1) Columna order_items.unit_cost.
--   2) Función order_item_replacement_cmv(product_id, fecha).
--   3) Trigger BEFORE INSERT en order_items (rellena unit_cost automáticamente
--      para ventas nuevas y para ediciones que reinsertan ítems).
--   4) Backfill de todos los order_items existentes a la fecha de su pedido.

-- ── 1) Columna ──────────────────────────────────────────────────────────────
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS unit_cost NUMERIC;

COMMENT ON COLUMN public.order_items.unit_cost IS
  'CMV unitario congelado al momento de la venta. Método: costo de reposición (última compra del material <= order_date; fallback materials.manual_unit_cost; si no hay nada, 0).';

-- ── 2) Función de cálculo ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.order_item_replacement_cmv(
  p_product_id uuid,
  p_date       date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    r.quantity * COALESCE(
      (
        SELECT p.unit_cost
        FROM   public.purchases p
        WHERE  p.material_id = r.material_id
          AND  p.unit_cost IS NOT NULL
          AND  p.date <= p_date
        ORDER BY p.date DESC, p.created_at DESC
        LIMIT  1
      ),
      m.manual_unit_cost,
      0
    )
  ), 0)
  FROM   public.recipes   r
  JOIN   public.materials m ON m.id = r.material_id
  WHERE  r.product_id = p_product_id;
$$;

-- ── 3) Trigger BEFORE INSERT ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_order_item_unit_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date date;
BEGIN
  IF NEW.unit_cost IS NULL THEN
    SELECT order_date INTO v_date FROM public.orders WHERE id = NEW.order_id;
    NEW.unit_cost := public.order_item_replacement_cmv(
      NEW.product_id,
      COALESCE(v_date, CURRENT_DATE)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_item_unit_cost ON public.order_items;

CREATE TRIGGER trg_set_order_item_unit_cost
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.set_order_item_unit_cost();

-- ── 4) Backfill ─────────────────────────────────────────────────────────────
UPDATE public.order_items oi
SET    unit_cost = public.order_item_replacement_cmv(oi.product_id, o.order_date)
FROM   public.orders o
WHERE  oi.order_id = o.id
  AND  oi.unit_cost IS NULL;
