-- ==============================================================
-- Arachis — Esquema consolidado (base de datos LIMPIA)
-- Generado a partir de supabase/migrations/ (001 -> 030).
-- Pegar y ejecutar en el SQL Editor de un proyecto Supabase NUEVO.
-- No contiene datos de negocio (pedidos, clientes, productos, etc.).
-- ==============================================================


-- ============================================================
-- 001_initial_schema.sql
-- ============================================================
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- CLIENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  business_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  price_type TEXT NOT NULL DEFAULT 'minorista' CHECK (price_type IN ('minorista', 'mayorista', 'otra')),
  notes TEXT,
  last_contact_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- PRODUCTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- MATERIALS (insumos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  critical_stock NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- EXPENSE CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- RECIPES (fichas técnicas)
-- =============================================
CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC NOT NULL,
  UNIQUE(product_id, material_id)
);

-- =============================================
-- PRICE MARGINS
-- =============================================
CREATE TABLE IF NOT EXISTS public.price_margins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  price_type TEXT NOT NULL CHECK (price_type IN ('minorista', 'mayorista', 'otra')),
  margin_percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- PRODUCT COSTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.product_costs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL UNIQUE,
  direct_cost NUMERIC,
  price_minorista NUMERIC,
  price_mayorista NUMERIC,
  price_otra NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- PURCHASES (compras de insumos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  supplier TEXT,
  material_id UUID REFERENCES public.materials(id) NOT NULL,
  quantity NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  unit_cost NUMERIC GENERATED ALWAYS AS (
    CASE WHEN quantity > 0 THEN total_cost / quantity ELSE NULL END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INDIRECT EXPENSES (gastos indirectos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.indirect_expenses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- PRODUCTION LOGS (registro de producción)
-- =============================================
CREATE TABLE IF NOT EXISTS public.production_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  batch_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- ORDERS (pedidos)
-- =============================================
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_number SERIAL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_phone TEXT,
  guest_email TEXT,
  desired_date DATE,
  payment_method TEXT CHECK (payment_method IN ('efectivo', 'transferencia')),
  delivery_method TEXT CHECK (delivery_method IN ('retiro', 'cadeteria')),
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (
    status IN ('pendiente', 'confirmado', 'en_produccion', 'listo', 'entregado', 'cobrado')
  ),
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'portal')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- ORDER ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- PAYMENTS (cobros)
-- =============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('efectivo', 'transferencia')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INVENTORY COUNTS (recuentos de inventario)
-- =============================================
CREATE TABLE IF NOT EXISTS public.inventory_counts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  count_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('materials', 'products')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- INVENTORY COUNT ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.inventory_count_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  count_id UUID REFERENCES public.inventory_counts(id) ON DELETE CASCADE NOT NULL,
  material_id UUID REFERENCES public.materials(id),
  product_id UUID REFERENCES public.products(id),
  theoretical_stock NUMERIC NOT NULL DEFAULT 0,
  physical_stock NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC GENERATED ALWAYS AS (physical_stock - theoretical_stock) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- STOCK ADJUSTMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  count_item_id UUID REFERENCES public.inventory_count_items(id),
  material_id UUID REFERENCES public.materials(id),
  product_id UUID REFERENCES public.products(id),
  adjustment NUMERIC NOT NULL,
  reason TEXT NOT NULL DEFAULT 'inventory_count',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- TRIGGERS: updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- TRIGGER: auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'operator');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_margins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indirect_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can view all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role() = 'admin');
CREATE POLICY "Admin can manage profiles" ON public.profiles
  FOR ALL USING (public.get_user_role() = 'admin');

-- DATA TABLES: admin full access, operator CRUD
-- Clients
CREATE POLICY "Authenticated users can view clients" ON public.clients
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert clients" ON public.clients
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update clients" ON public.clients
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can delete clients" ON public.clients
  FOR DELETE USING (public.get_user_role() = 'admin');

-- Products
CREATE POLICY "Authenticated users can view products" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage products" ON public.products
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Materials
CREATE POLICY "Authenticated users can view materials" ON public.materials
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage materials" ON public.materials
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Expense categories (config — admin only for write)
CREATE POLICY "Authenticated users can view expense_categories" ON public.expense_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can manage expense_categories" ON public.expense_categories
  FOR ALL USING (public.get_user_role() = 'admin');

-- Recipes
CREATE POLICY "Authenticated users can view recipes" ON public.recipes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage recipes" ON public.recipes
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Price margins (config — admin only)
CREATE POLICY "Authenticated users can view price_margins" ON public.price_margins
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin can manage price_margins" ON public.price_margins
  FOR ALL USING (public.get_user_role() = 'admin');

-- Product costs
CREATE POLICY "Authenticated users can view product_costs" ON public.product_costs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage product_costs" ON public.product_costs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Purchases
CREATE POLICY "Authenticated users can view purchases" ON public.purchases
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage purchases" ON public.purchases
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Indirect expenses
CREATE POLICY "Authenticated users can view indirect_expenses" ON public.indirect_expenses
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage indirect_expenses" ON public.indirect_expenses
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Production logs
CREATE POLICY "Authenticated users can view production_logs" ON public.production_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage production_logs" ON public.production_logs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Orders
CREATE POLICY "Authenticated users can view orders" ON public.orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage orders" ON public.orders
  FOR ALL USING (auth.uid() IS NOT NULL);
-- Public portal can insert orders
CREATE POLICY "Public can insert portal orders" ON public.orders
  FOR INSERT WITH CHECK (origin = 'portal');

-- Order items
CREATE POLICY "Authenticated users can view order_items" ON public.order_items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage order_items" ON public.order_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Payments
CREATE POLICY "Authenticated users can view payments" ON public.payments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage payments" ON public.payments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Inventory
CREATE POLICY "Authenticated users can view inventory_counts" ON public.inventory_counts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage inventory_counts" ON public.inventory_counts
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view inventory_count_items" ON public.inventory_count_items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage inventory_count_items" ON public.inventory_count_items
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view stock_adjustments" ON public.stock_adjustments
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage stock_adjustments" ON public.stock_adjustments
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Notifications
CREATE POLICY "Authenticated users can view notifications" ON public.notifications
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage notifications" ON public.notifications
  FOR ALL USING (auth.uid() IS NOT NULL);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_price_type ON public.clients(price_type);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_production_logs_date ON public.production_logs(date);
CREATE INDEX IF NOT EXISTS idx_purchases_material_id ON public.purchases(material_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);


-- ============================================================
-- 002_quotes.sql
-- ============================================================
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


-- ============================================================
-- 003_inventory_status.sql
-- ============================================================
-- Add finalized_at to inventory_counts to track completion status
ALTER TABLE public.inventory_counts
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;


-- ============================================================
-- 004_costs_price_history.sql
-- ============================================================
-- 004_costs_price_history.sql
-- Updates product_costs schema and adds price list history tables

-- 1. Update product_costs: add new fields
ALTER TABLE public.product_costs
  ADD COLUMN IF NOT EXISTS labor_cost        NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0;

-- 2. Drop price_otra (no longer used — "otra" prices are defined per order)
ALTER TABLE public.product_costs
  DROP COLUMN IF EXISTS price_otra;

-- 3. Price list history header
CREATE TABLE IF NOT EXISTS public.price_list_history (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Price list history items (snapshot per product)
CREATE TABLE IF NOT EXISTS public.price_list_history_items (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  history_id          UUID    NOT NULL REFERENCES public.price_list_history(id) ON DELETE CASCADE,
  product_id          UUID    NOT NULL REFERENCES public.products(id),
  product_name        TEXT    NOT NULL,
  direct_cost         NUMERIC NOT NULL DEFAULT 0,
  labor_cost          NUMERIC NOT NULL DEFAULT 0,
  total_cost          NUMERIC NOT NULL DEFAULT 0,
  margin_percentage   NUMERIC NOT NULL DEFAULT 0,
  price_minorista     NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC NOT NULL DEFAULT 0,
  price_mayorista     NUMERIC NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_list_history_items_history_id
  ON public.price_list_history_items(history_id);


-- ============================================================
-- 005_purchases_shipping.sql
-- ============================================================
-- Add shipping_cost_share column to purchases
-- Stores the portion of the total shipping cost allocated to each item in a multi-item purchase

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS shipping_cost_share numeric(12,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN purchases.shipping_cost_share IS
  'Porción del costo de envío imputada a este ítem, distribuida proporcionalmente por cantidad.';


-- ============================================================
-- 006_price_history_rls.sql
-- ============================================================
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


-- ============================================================
-- 007_notifications_cascade.sql
-- ============================================================
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


-- ============================================================
-- 008_promos.sql
-- ============================================================
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
-- TODO: reemplazar por los datos de la marca nueva
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


-- ============================================================
-- 009_batch_changes.sql
-- ============================================================
-- ==========================================================
-- MIGRACIÓN 009: Estados pedidos + Nombre/Apellido clientes
-- ==========================================================

-- ─────────────────────────────────────────────────────────
-- 1. ORDERS: Agregar campo delivered
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────
-- 2. ORDERS: Migrar estados anteriores → nuevos estados
--    en_produccion → confirmado
--    entregado     → confirmado + delivered=true
--    cobrado       → listo     + delivered=true
-- ─────────────────────────────────────────────────────────
UPDATE public.orders SET status = 'confirmado'
  WHERE status = 'en_produccion';

UPDATE public.orders SET status = 'confirmado', delivered = true
  WHERE status = 'entregado';

UPDATE public.orders SET status = 'listo', delivered = true
  WHERE status = 'cobrado';

-- ─────────────────────────────────────────────────────────
-- 3. ORDERS: Actualizar constraint de status
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pendiente', 'confirmado', 'listo', 'anulado'));

-- ─────────────────────────────────────────────────────────
-- 4. CLIENTS: Agregar first_name y last_name
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

-- ─────────────────────────────────────────────────────────
-- 5. CLIENTS: Migrar business_name → last_name, first_name
--    La mayoría están como "Apellido, Nombre"
-- ─────────────────────────────────────────────────────────
UPDATE public.clients SET
  last_name = CASE
    WHEN position(', ' IN business_name) > 0
    THEN trim(substring(business_name FROM 1 FOR position(', ' IN business_name) - 1))
    ELSE trim(business_name)
  END,
  first_name = CASE
    WHEN position(', ' IN business_name) > 0
    THEN trim(substring(business_name FROM position(', ' IN business_name) + 2))
    ELSE ''
  END;

-- ─────────────────────────────────────────────────────────
-- 6. CLIENTS: Eliminar columna business_name
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS business_name;

-- Actualizar índice de ordenamiento
DROP INDEX IF EXISTS idx_clients_business_name;
CREATE INDEX IF NOT EXISTS idx_clients_last_name ON public.clients(last_name);


-- ============================================================
-- 009_show_in_portal.sql
-- ============================================================
-- Add show_in_portal column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_in_portal BOOLEAN DEFAULT false NOT NULL;


-- ============================================================
-- 010_payment_discounts.sql
-- ============================================================
-- Add discount columns to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS discount_type TEXT CHECK (discount_type IN ('fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;


-- ============================================================
-- 010_quotes_client_split.sql
-- ============================================================
-- Migration 010: Split quotes.client_name into client_first_name + client_last_name
-- Also add client_id FK for linking accepted quotes to clients table

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS client_first_name TEXT,
  ADD COLUMN IF NOT EXISTS client_last_name  TEXT,
  ADD COLUMN IF NOT EXISTS client_id         UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Populate from existing client_name
-- Strategy: last word → last_name, rest → first_name
UPDATE quotes
SET
  client_last_name  = CASE
    WHEN client_name ~ '\s'
      THEN regexp_replace(client_name, '^.*\s', '')
    ELSE client_name
  END,
  client_first_name = CASE
    WHEN client_name ~ '\s'
      THEN regexp_replace(client_name, '\s[^\s]+$', '')
    ELSE ''
  END
WHERE client_last_name IS NULL;

-- Index for client_id FK
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);


-- ============================================================
-- 011_material_manual_cost.sql
-- ============================================================
-- Add manual unit cost to materials table
ALTER TABLE materials ADD COLUMN IF NOT EXISTS manual_unit_cost NUMERIC;


-- ============================================================
-- 011_orders_guest_city.sql
-- ============================================================
-- Migration 011: Add guest_city to orders table for portal orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS guest_city TEXT;


-- ============================================================
-- 012_products_presentation.sql
-- ============================================================
-- Add presentation (gramos) column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS presentation INTEGER;

-- Migrate existing data: "Marroc (400g)" → name="Marroc", presentation=400
UPDATE public.products
SET
  presentation = CASE
    WHEN name ~ '\(([0-9]+)g\)'
    THEN (regexp_match(name, '\(([0-9]+)g\)'))[1]::INTEGER
    ELSE 0
  END,
  name = CASE
    WHEN name ~ '\(([0-9]+)g\)'
    THEN trim(regexp_replace(name, '\s*\([0-9]+g\).*$', ''))
    ELSE name
  END;

-- Default any remaining NULLs (products without "Xg" pattern)
UPDATE public.products SET presentation = 0 WHERE presentation IS NULL;

-- Make NOT NULL with default
ALTER TABLE public.products ALTER COLUMN presentation SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN presentation SET DEFAULT 0;

-- Unique constraint: no two products with same sabor + presentación
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_presentation
  ON public.products (lower(trim(name)), presentation)
  WHERE active = true OR active = false;


-- ============================================================
-- 013_orders_cumplido_anulation.sql
-- ============================================================
-- Migration 013: Renombrar estado 'listo' a 'cumplido' + campo anulation_reason + RLS portal fix

-- ── 1. Status: listo → cumplido ─────────────────────────────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
UPDATE public.orders SET status = 'cumplido' WHERE status = 'listo';
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pendiente', 'confirmado', 'cumplido', 'anulado'));

-- ── 2. Campo motivo de anulación ─────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS anulation_reason TEXT;

-- ── 3. Campo delivered (por si la migration 009 no fue aplicada) ─────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;

-- ── 4. RLS: permitir inserción anónima en order_items y notifications (portal) ─
-- order_items
DROP POLICY IF EXISTS "Public can insert portal order_items" ON public.order_items;
CREATE POLICY "Public can insert portal order_items" ON public.order_items
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.origin = 'portal'
    )
  );

-- notifications
DROP POLICY IF EXISTS "Public can insert portal notifications" ON public.notifications;
CREATE POLICY "Public can insert portal notifications" ON public.notifications
  FOR INSERT TO anon
  WITH CHECK (true);


-- ============================================================
-- 014_cleanup_anulado_notifications.sql
-- ============================================================
-- Migration 014: Marcar como leídas las notificaciones de pedidos anulados (limpieza)

UPDATE public.notifications
SET read = true
WHERE read = false
  AND order_id IN (
    SELECT id FROM public.orders WHERE status = 'anulado'
  );


-- ============================================================
-- 015_fix_cumplido_status.sql
-- ============================================================
-- Migration 015: Revertir pedidos incorrectamente marcados como "cumplido"
-- Un pedido "cumplido" debe cumplir AMBAS condiciones:
--   1. delivered = true
--   2. saldo cobrado = total del pedido (balance <= 0.01)

-- Revertir a "confirmado" los pedidos cumplidos que NO cumplan ambas condiciones
UPDATE public.orders o
SET status = 'confirmado', updated_at = NOW()
WHERE o.status = 'cumplido'
  AND (
    o.delivered = false
    OR (
      o.id NOT IN (
        SELECT oi_ord.id
        FROM public.orders oi_ord
        JOIN public.order_items oi ON oi.order_id = oi_ord.id
        LEFT JOIN public.payments p ON p.order_id = oi_ord.id
        GROUP BY oi_ord.id
        HAVING COALESCE(SUM(p.amount), 0) >= SUM(oi.quantity * oi.unit_price) - 0.01
      )
    )
  );

-- Verificación: mostrar cuántos pedidos fueron revertidos (debería ser >= 1 para #0005)
-- SELECT order_number, status, delivered FROM public.orders
-- WHERE order_number IN (5) ORDER BY order_number;


-- ============================================================
-- 016_purchases_brand.sql
-- ============================================================
-- Migration 016: Agregar campo "brand" (marca) a la tabla purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS brand TEXT;


-- ============================================================
-- 017_orders_delivered_date.sql
-- ============================================================
-- Migration 017: Reemplazar delivered BOOLEAN por delivered_date DATE en orders

-- 1. Agregar nueva columna
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_date DATE;

-- 2. Migrar datos existentes: si delivered = true, usar desired_date o en su defecto order_date
UPDATE public.orders
SET delivered_date = COALESCE(desired_date::date, order_date::date)
WHERE delivered = true;

-- 3. Eliminar columna antigua
ALTER TABLE public.orders DROP COLUMN IF EXISTS delivered;


-- ============================================================
-- 018_payment_delivery_methods.sql
-- ============================================================
-- Migration 018: Agregar nuevas modalidades de pago y entrega

-- Eliminar constraints existentes
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_method_check;

-- Agregar nuevos constraints con valores extendidos
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('efectivo', 'transferencia', 'sin_cargo'));

ALTER TABLE public.orders
  ADD CONSTRAINT orders_delivery_method_check
  CHECK (delivery_method IN ('retiro', 'cadeteria', 'envio_gratis'));


-- ============================================================
-- 019_create_quotes_tables.sql
-- ============================================================
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


-- ============================================================
-- 020_purchase_delivery_date.sql
-- ============================================================
-- 020_purchase_delivery_date.sql
-- Add delivery_date column to purchases table

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Existing purchases are already received — set delivery_date = date
UPDATE public.purchases SET delivery_date = date WHERE delivery_date IS NULL;


-- ============================================================
-- 021_event_results.sql
-- ============================================================
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


-- ============================================================
-- 022_exchange_rates.sql
-- ============================================================
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


-- ============================================================
-- 023_product_image_url.sql
-- ============================================================
-- Add image_url column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;


-- ============================================================
-- 024_storage_product_images.sql
-- ============================================================
-- Ensure product-images bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;

-- Public read access (so image URLs work without auth)
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated users can upload
CREATE POLICY "product_images_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Authenticated users can update (upsert)
CREATE POLICY "product_images_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images');

-- Authenticated users can delete
CREATE POLICY "product_images_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images');


-- ============================================================
-- 025_sin_cargo_auto_cumplido.sql
-- ============================================================
-- Migration 025: Auto-cumplido para pedidos sin cargo
--
-- Los pedidos con modalidad de pago "sin_cargo" no generan cobro, por lo
-- tanto el ciclo de vida termina con la entrega. Cuando un pedido sin cargo
-- está confirmado y tiene delivered_date, debe pasar a "cumplido".
--
-- 1) Backfill: actualizar los pedidos existentes que cumplen la condición.
-- 2) Trigger: aplicar la regla automáticamente para futuros INSERT/UPDATE.

-- ── 1) Backfill ─────────────────────────────────────────────────────────────
UPDATE public.orders
SET    status     = 'cumplido',
       updated_at = NOW()
WHERE  payment_method = 'sin_cargo'
  AND  status         = 'confirmado'
  AND  delivered_date IS NOT NULL;

-- ── 2) Trigger ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_cumplido_sin_cargo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_method = 'sin_cargo'
     AND NEW.status     = 'confirmado'
     AND NEW.delivered_date IS NOT NULL THEN
    NEW.status := 'cumplido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_cumplido_sin_cargo ON public.orders;

CREATE TRIGGER trg_auto_cumplido_sin_cargo
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_cumplido_sin_cargo();


-- ============================================================
-- 026_canje_payment_method.sql
-- ============================================================
-- Migration 026: Modalidad de pago "canje"
--
-- Se entrega mercadería a cambio de un servicio (ej. publicidad). El importe
-- canjeado se imputa directamente a un rubro de gasto, igualando el efecto
-- en el resultado.

-- ── Permitir 'canje' en orders.payment_method ───────────────────────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('efectivo', 'transferencia', 'sin_cargo', 'canje'));

-- ── Permitir 'canje' en payments.method ─────────────────────────────────────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_method_check
  CHECK (method IN ('efectivo', 'transferencia', 'canje'));


-- ============================================================
-- 027_freeze_order_item_cmv.sql
-- ============================================================
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


-- ============================================================
-- 028_cmv_breakdown_function.sql
-- ============================================================
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


-- ============================================================
-- 029_product_images_table.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  storage_path TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id, position);

-- Migrate existing image_url values into the new table
INSERT INTO product_images (product_id, url, storage_path, position)
SELECT id, image_url, NULL, 0
FROM products
WHERE image_url IS NOT NULL;


-- ============================================================
-- 030_origin_venta_rapida.sql
-- ============================================================
-- Migration 030: Nuevo origen "venta_rapida" para ventas en el momento
--
-- Las ventas rápidas son ventas espontáneas (sin pedido previo) donde la
-- entrega ocurre en el acto y el cobro puede hacerse en el momento o quedar
-- pendiente. Se distinguen con un origen propio para poder filtrarlas y
-- analizarlas por separado de los pedidos manuales y del portal.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_origin_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_origin_check
  CHECK (origin IN ('manual', 'portal', 'venta_rapida'));

