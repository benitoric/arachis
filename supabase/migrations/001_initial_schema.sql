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
