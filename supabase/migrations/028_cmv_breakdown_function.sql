-- Migration 028: Función para desglosar la composición del CMV unitario
--
-- Dado un product_id y una fecha, devuelve la lista de ingredientes con el
-- aporte de cada uno al CMV unitario, mostrando qué compra (fecha + proveedor)
-- se usó como costo de reposición. Si no hay compra <= fecha y existe
-- manual_unit_cost, se cae a ese costo y los campos de origen quedan NULL.
-- Pensada para que la UI del reporte de Resultado expanda cada línea de CMV
-- y muestre cómo se compone el costo congelado del pedido.

CREATE OR REPLACE FUNCTION public.order_item_cmv_breakdown(
  p_product_id uuid,
  p_date       date
)
RETURNS TABLE (
  material_id          uuid,
  material_name        text,
  material_unit        text,
  recipe_qty           numeric,
  unit_cost            numeric,
  source_purchase_date date,
  source_supplier      text,
  contribution         numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.name,
    m.unit,
    r.quantity,
    COALESCE(lp.unit_cost, m.manual_unit_cost, 0) AS unit_cost,
    lp.date     AS source_purchase_date,
    lp.supplier AS source_supplier,
    r.quantity * COALESCE(lp.unit_cost, m.manual_unit_cost, 0) AS contribution
  FROM   public.recipes   r
  JOIN   public.materials m ON m.id = r.material_id
  LEFT JOIN LATERAL (
    SELECT pu.unit_cost, pu.date, pu.supplier
    FROM   public.purchases pu
    WHERE  pu.material_id = r.material_id
      AND  pu.unit_cost IS NOT NULL
      AND  pu.date <= p_date
    ORDER BY pu.date DESC, pu.created_at DESC
    LIMIT  1
  ) lp ON TRUE
  WHERE  r.product_id = p_product_id
  ORDER BY contribution DESC NULLS LAST;
$$;
