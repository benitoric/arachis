-- Migration 019: Create quotes and quote_items tables (idempotent)
-- Combines 002_quotes.sql + 010_quotes_client_split.sql into one safe migration.
-- Run this if the quotes table was never created in your Supabase project.

CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador', 'enviado', 'aceptado', 'rechazado')),

  -- Client info
  client_name TEXT NOT NULL,
  client_first_name TEXT,
  client_last_name TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_phone TEXT,
  client_email TEXT,

  -- Event info
  event_date DATE,
  event_type TEXT,
  estimated_guests INTEGER,

  -- Pricing
  margin_percentage NUMERIC NOT NULL DEFAULT 100,
  labor_cost NUMERIC NOT NULL DEFAULT 0,
  extra_charge_amount NUMERIC NOT NULL DEFAULT 0,
  extra_charge_description TEXT,
  final_price NUMERIC NOT NULL DEFAULT 0,

  -- Conditions
  validity_days INTEGER NOT NULL DEFAULT 15,
  payment_terms TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add columns that 010_quotes_client_split adds (safe if quotes already existed)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS client_first_name TEXT,
  ADD COLUMN IF NOT EXISTS client_last_name TEXT,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON public.quotes(date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);
