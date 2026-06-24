-- 006_price_history_rls.sql
-- Enable RLS and add policies for price_list_history tables
-- (migration 004 created the tables but omitted RLS setup)

ALTER TABLE public.price_list_history        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_history_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view price_list_history"
  ON public.price_list_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage price_list_history"
  ON public.price_list_history FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view price_list_history_items"
  ON public.price_list_history_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage price_list_history_items"
  ON public.price_list_history_items FOR ALL
  USING (auth.uid() IS NOT NULL);
