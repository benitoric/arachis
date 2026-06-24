-- 022_exchange_rates.sql
-- Tabla para almacenar tipos de cambio dólar oficial BNA

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date       DATE        NOT NULL UNIQUE,
  rate       NUMERIC     NOT NULL,
  source     TEXT        NOT NULL DEFAULT 'BNA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage exchange_rates"
  ON public.exchange_rates FOR ALL USING (auth.uid() IS NOT NULL);
