-- 008_promos.sql
-- Módulo de placas promocionales

-- 1. Ajustes del módulo (key-value persistente)
CREATE TABLE IF NOT EXISTS public.promo_settings (
  id    UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key   TEXT    NOT NULL UNIQUE,
  value TEXT    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Defaults
INSERT INTO public.promo_settings (key, value) VALUES
  ('phone',      '381 206 7869'),
  ('portal_url', 'https://www.arachis.com.ar/pedidos')
ON CONFLICT (key) DO NOTHING;

-- 2. Placas guardadas
CREATE TABLE IF NOT EXISTS public.promos (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title          TEXT        NOT NULL,
  subtitle       TEXT,
  promo_text     TEXT,
  template_style TEXT        NOT NULL DEFAULT 'elegante',
  items          JSONB       NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.promo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage promo_settings"
  ON public.promo_settings FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage promos"
  ON public.promos FOR ALL USING (auth.uid() IS NOT NULL);
