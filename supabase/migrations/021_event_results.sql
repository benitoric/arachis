-- 021_event_results.sql
-- Tabla para registrar resultados de eventos

CREATE TABLE IF NOT EXISTS public.event_results (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date        DATE        NOT NULL,
  description TEXT        NOT NULL,
  income      NUMERIC     NOT NULL DEFAULT 0,
  expenses    NUMERIC     NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage event_results"
  ON public.event_results FOR ALL USING (auth.uid() IS NOT NULL);
