-- =============================================
-- QUOTES (Presupuestos de mesas dulces)
-- =============================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_number INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador', 'enviado', 'aceptado', 'rechazado')),

  -- Client info (free text, no FK to clients)
  client_name TEXT NOT NULL,
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

-- =============================================
-- QUOTE ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL,   -- denormalized for historical accuracy
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,   -- internal: costo directo
  unit_price NUMERIC NOT NULL DEFAULT 0,  -- external: precio al cliente
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON public.quotes(date DESC);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);
