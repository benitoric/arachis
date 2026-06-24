"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingBag, DollarSign, AlertTriangle, Bell,
  TrendingUp, Globe, Loader2, Package, Truck,
} from "lucide-react";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Order = Database["public"]["Tables"]["orders"]["Row"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmt(n);
};

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function StatCard({
  title, value, subtitle, icon: Icon, bg, loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  bg: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <div className="mt-1"><Loader2 size={20} className="animate-spin text-gray-200" /></div>
          ) : (
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{value}</p>
          )}
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pendiente:  "Pendiente",
  confirmado: "Confirmado",
  cumplido:   "Cumplido",
  anulado:    "Anulado",
};
const STATUS_STYLE: Record<string, string> = {
  pendiente:  "bg-amber-100 text-amber-700",
  confirmado: "bg-blue-100 text-blue-700",
  cumplido:   "bg-teal-100 text-teal-700",
  anulado:    "bg-red-100 text-red-600",
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats
  const [toDeliver, setToDeliver] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [criticalStock, setCriticalStock] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Lists
  const [deliverOrders, setDeliverOrders] = useState<(Order & { total: number; client_display: string })[]>([]);
  const [collectOrders, setCollectOrders] = useState<(Order & { total: number; client_display: string; paid: number })[]>([]);
  const [criticalMaterials, setCriticalMaterials] = useState<{ name: string; unit: string; stock: number; critical: number }[]>([]);
  const [portalOrders, setPortalOrders] = useState<(Order & { total: number; client_display: string; paid: number })[]>([]);

  // P&L
  const [plMonth, setPlMonth] = useState<{
    grossRevenue: number;
    discounts: number;
    netRevenue: number;
    cmv: number;
    contribution: number;
    courtesy: number;
    totalIndirect: number;
    partial: number;
    eventsResult: number;
    finalResult: number;
  } | null>(null);

  // Chart
  const [chartData, setChartData] = useState<{ month: string; ventas: number }[]>([]);

  // Incomplete costs
  const [incompleteCosts, setIncompleteCosts] = useState<{ productName: string; missingIngredients: string[] }[]>([]);

  // Pending purchases
  const [pendingPurchases, setPendingPurchases] = useState<{ date: string; supplier: string | null; materialName: string; unit: string; quantity: number }[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    // 12-month range for chart
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);

    const [
      { data: ordersAll },
      { data: orderItems },
      { data: payments },
      { data: materials },
      { data: purchases },
      { data: prodLogs },
      { data: recipes },
      { data: matAdj },
      { data: prodAdj },
      { data: clients },
      { data: indirectExpenses },
      { data: activeProducts },
      { data: expenseCategories },
      { data: eventResults },
    ] = await Promise.all([
      supabase.from("orders").select("*").order("order_date", { ascending: false }),
      supabase.from("order_items").select("order_id, quantity, unit_price, product_id"),
      supabase.from("payments").select("order_id, amount"),
      supabase.from("materials").select("id, name, unit, critical_stock, manual_unit_cost"),
      supabase.from("purchases").select("material_id, quantity, unit_cost, total_cost, date, delivery_date, supplier").order("date", { ascending: false }),
      supabase.from("production_logs").select("product_id, quantity"),
      supabase.from("recipes").select("product_id, material_id, quantity"),
      supabase.from("stock_adjustments").select("material_id, adjustment").not("material_id", "is", null),
      supabase.from("stock_adjustments").select("product_id, adjustment").not("product_id", "is", null),
      supabase.from("clients").select("id, last_name, first_name"),
      supabase.from("indirect_expenses").select("amount, date, category_id"),
      supabase.from("products").select("id, name, presentation").eq("active", true).order("name"),
      supabase.from("expense_categories").select("id, name"),
      supabase.from("event_results").select("date, income, expenses"),
    ]);

    // Maps
    const totalsMap: Record<string, number> = {};
    (orderItems ?? []).forEach((oi) => {
      totalsMap[oi.order_id] = (totalsMap[oi.order_id] ?? 0) + oi.quantity * oi.unit_price;
    });

    const paidMap: Record<string, number> = {};
    (payments ?? []).forEach((p) => {
      paidMap[p.order_id] = (paidMap[p.order_id] ?? 0) + p.amount;
    });

    const clientMap: Record<string, string> = {};
    (clients ?? []).forEach((c) => { clientMap[c.id] = c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name; });

    const ordersWithTotal = (ordersAll ?? []).map((o) => ({
      ...o,
      total: totalsMap[o.id] ?? 0,
      paid: paidMap[o.id] ?? 0,
      client_display: o.client_id && clientMap[o.client_id] ? clientMap[o.client_id] : (o.guest_name ?? "—"),
    }));

    // Stats
    const toDeliverList = ordersWithTotal.filter((o) =>
      o.status === "confirmado" && o.delivered_date == null
    );
    const toCollectList = ordersWithTotal.filter((o) =>
      o.status === "confirmado" &&
      o.payment_method !== "sin_cargo" &&
      (o.total - o.paid) > 0.01
    );

    setToDeliver(toDeliverList.length);
    setPendingBalance(toCollectList.reduce((sum, o) => sum + (o.total - o.paid), 0));

    setDeliverOrders(toDeliverList.slice(0, 8));
    setCollectOrders(toCollectList.slice(0, 8));

    // Critical stock (only received purchases — delivery_date IS NOT NULL)
    const purchaseMap: Record<string, number> = {};
    (purchases ?? []).forEach((p) => {
      if (p.delivery_date) {
        purchaseMap[p.material_id] = (purchaseMap[p.material_id] ?? 0) + p.quantity;
      }
    });

    const consumedMap: Record<string, number> = {};
    (prodLogs ?? []).forEach((log) => {
      (recipes ?? []).filter((r) => r.product_id === log.product_id).forEach((r) => {
        consumedMap[r.material_id] = (consumedMap[r.material_id] ?? 0) + log.quantity * r.quantity;
      });
    });

    const matAdjMap: Record<string, number> = {};
    (matAdj ?? []).forEach((a) => { if (a.material_id) matAdjMap[a.material_id] = (matAdjMap[a.material_id] ?? 0) + a.adjustment; });

    const criticals = (materials ?? [])
      .map((m) => ({
        ...m,
        stock: (purchaseMap[m.id] ?? 0) - (consumedMap[m.id] ?? 0) + (matAdjMap[m.id] ?? 0),
        critical: m.critical_stock ?? 0,
      }))
      .filter((m) => m.critical_stock != null && m.stock <= m.critical_stock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6);

    setCriticalStock(criticals.length);
    setCriticalMaterials(criticals.map((m) => ({
      name: m.name,
      unit: m.unit,
      stock: m.stock,
      critical: m.critical,
    })));

    // Portal pending orders
    const portalPendingOrders = ordersWithTotal.filter(
      (o) => o.origin === "portal" && o.status === "pendiente"
    );
    setUnreadCount(portalPendingOrders.length);
    setPortalOrders(portalPendingOrders);

    // P&L current month — full structure
    const monthOrders = ordersWithTotal.filter(
      (o) => o.order_date >= monthStart && o.order_date <= monthEnd && o.status === "cumplido"
    );
    const grossRevenue = monthOrders.reduce((sum, o) => sum + o.total, 0);

    // Last purchase unit cost per material (purchases already sorted by date desc)
    const lastCostMap: Record<string, number> = {};
    (purchases ?? []).forEach((p) => {
      if (!(p.material_id in lastCostMap)) {
        const cost = p.unit_cost ?? p.total_cost / (p.quantity || 1);
        lastCostMap[p.material_id] = cost;
      }
    });

    const matMap: Record<string, { manual_unit_cost: number | null }> = {};
    (materials ?? []).forEach((m) => { matMap[m.id] = { manual_unit_cost: m.manual_unit_cost ?? null }; });

    const matUnitCost = (matId: string): number =>
      matMap[matId]?.manual_unit_cost ?? lastCostMap[matId] ?? 0;

    // CMV: order items × recipe ingredients × unit cost
    const monthOrderIds = new Set(monthOrders.map((o) => o.id));
    const monthItems = (orderItems ?? []).filter((i) => monthOrderIds.has(i.order_id));
    let cmv = 0;
    monthItems.forEach((item) => {
      const unitCMV = (recipes ?? [])
        .filter((r) => r.product_id === item.product_id)
        .reduce((sum, r) => sum + r.quantity * matUnitCost(r.material_id), 0);
      cmv += item.quantity * unitCMV;
    });

    // Discounts and indirect expenses
    const discountCatId = (expenseCategories ?? []).find(
      (c) => c.name.toLowerCase() === "descuentos otorgados"
    )?.id;
    const monthExpenses = (indirectExpenses ?? []).filter(
      (e) => e.date >= monthStart && e.date <= monthEnd
    );
    const discounts = discountCatId
      ? monthExpenses.filter((e) => (e as { category_id: string }).category_id === discountCatId).reduce((sum, e) => sum + e.amount, 0)
      : 0;
    const totalIndirect = discountCatId
      ? monthExpenses.filter((e) => (e as { category_id: string }).category_id !== discountCatId).reduce((sum, e) => sum + e.amount, 0)
      : monthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const netRevenue = grossRevenue - discounts;
    const contribution = netRevenue - cmv;

    // Cortesía: pedidos sin cargo a precio de lista (bonificación 100%)
    const courtesy = monthOrders
      .filter((o) => o.payment_method === "sin_cargo")
      .reduce((sum, o) => sum + o.total, 0);

    const partial = contribution - courtesy - totalIndirect;

    const eventsResult = (eventResults ?? [])
      .filter((e) => e.date >= monthStart && e.date <= monthEnd)
      .reduce((sum, e) => sum + e.income - e.expenses, 0);
    const finalResult = partial + eventsResult;

    setPlMonth({ grossRevenue, discounts, netRevenue, cmv, contribution, courtesy, totalIndirect, partial, eventsResult, finalResult });

    // Chart: monthly revenue last 12 months
    const chartMap: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      chartMap[key] = 0;
    }

    ordersWithTotal
      .filter((o) => o.order_date >= twelveMonthsAgo && o.status === "cumplido")
      .forEach((o) => {
        const key = o.order_date.slice(0, 7);
        if (key in chartMap) chartMap[key] = (chartMap[key] ?? 0) + o.total;
      });

    const chart = Object.entries(chartMap).map(([key, val]) => {
      const [year, month] = key.split("-");
      return {
        month: `${MONTHS_ES[parseInt(month) - 1]} ${year.slice(2)}`,
        ventas: val,
      };
    });
    setChartData(chart);

    // Incomplete costs: active products whose recipe has ingredients with no price (no manual_unit_cost and no purchase)
    const purchasedMatIds = new Set<string>();
    (purchases ?? []).forEach((p) => { purchasedMatIds.add(p.material_id); });

    const matInfoMap: Record<string, { name: string; manual_unit_cost: number | null }> = {};
    (materials ?? []).forEach((m) => { matInfoMap[m.id] = { name: m.name, manual_unit_cost: m.manual_unit_cost ?? null }; });

    const incompletes: { productName: string; missingIngredients: string[] }[] = [];
    (activeProducts ?? []).forEach((prod) => {
      const prodRecipes = (recipes ?? []).filter((r) => r.product_id === prod.id);
      if (prodRecipes.length === 0) return;
      const missing = prodRecipes
        .filter((r) => {
          const mat = matInfoMap[r.material_id];
          return mat?.manual_unit_cost == null && !purchasedMatIds.has(r.material_id);
        })
        .map((r) => matInfoMap[r.material_id]?.name ?? r.material_id);
      if (missing.length > 0) {
        incompletes.push({ productName: pName(prod), missingIngredients: missing });
      }
    });
    setIncompleteCosts(incompletes);

    // Pending purchases (delivery_date IS NULL)
    const matNameMap: Record<string, { name: string; unit: string }> = {};
    (materials ?? []).forEach((m) => { matNameMap[m.id] = { name: m.name, unit: m.unit }; });

    const pending = (purchases ?? [])
      .filter((p) => !p.delivery_date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8)
      .map((p) => ({
        date: p.date,
        supplier: p.supplier,
        materialName: matNameMap[p.material_id]?.name ?? "—",
        unit: matNameMap[p.material_id]?.unit ?? "",
        quantity: p.quantity,
      }));
    setPendingPurchases(pending);

    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-0.5">Resumen de operaciones</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="A entregar" value={toDeliver} subtitle="Pendientes y confirmados" icon={ShoppingBag} bg="#49789d" loading={loading} />
        <StatCard title="Saldo pendiente" value={loading ? 0 : fmt(pendingBalance)} subtitle="Entregados sin cobrar" icon={DollarSign} bg="#e8a95a" loading={loading} />
        <StatCard title="Insumos críticos" value={criticalStock} subtitle="Bajo stock mínimo" icon={AlertTriangle} bg="#E8475F" loading={loading} />
        <StatCard title="Pedidos portal" value={unreadCount} subtitle="Pendientes de confirmar" icon={Bell} bg="#6b7280" loading={loading} />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Pedidos a entregar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8f0f7" }}>
                <ShoppingBag size={15} style={{ color: "#49789d" }} />
              </div>
              <h2 className="font-semibold text-gray-900">A entregar</h2>
            </div>
            <button onClick={() => router.push("/orders")} className="text-xs font-medium hover:underline" style={{ color: "#49789d" }}>Ver todos</button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-200" /></div>
          ) : deliverOrders.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No hay pedidos pendientes de entrega.</p>
          ) : (
            <div className="space-y-1">
              {deliverOrders.map((o) => (
                <div key={o.id} onClick={() => router.push(`/orders/${o.id}`)}
                  className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.client_display}</p>
                    <p className="text-xs text-gray-400">
                      #{String(o.order_number ?? "—").padStart(4, "0")} ·{" "}
                      {o.desired_date
                        ? new Date(o.desired_date + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })
                        : "—"}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[o.status]}`}>
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resultado del mes */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
                <TrendingUp size={15} className="text-emerald-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Resultado del mes</h2>
            </div>
          </div>
          {loading || !plMonth ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-200" /></div>
          ) : (
            <>
              <div className="space-y-0 text-xs">
                {[
                  { label: "(+) Ingresos brutos", amt: plMonth.grossRevenue, bold: false },
                  { label: "(−) Descuentos", amt: -plMonth.discounts, bold: false, skip: plMonth.discounts === 0 },
                  { label: "Ingresos netos", amt: plMonth.netRevenue, bold: true, sep: true },
                  { label: "(−) CMV", amt: -plMonth.cmv, bold: false },
                  { label: "Contribución marginal", amt: plMonth.contribution, bold: true, sep: true },
                  { label: "(−) Cortesía", amt: -plMonth.courtesy, bold: false, skip: plMonth.courtesy === 0 },
                  { label: "(−) Gastos indirectos", amt: -plMonth.totalIndirect, bold: false },
                  { label: "Resultado parcial", amt: plMonth.partial, bold: true, sep: true },
                  { label: "(±) Eventos", amt: plMonth.eventsResult, bold: false, skip: plMonth.eventsResult === 0 },
                ].map(({ label, amt, bold, sep, skip }) => skip ? null : (
                  <div key={label}>
                    {sep && <div className="border-t border-gray-100 my-1" />}
                    <div className="flex justify-between items-center py-1">
                      <span className={bold ? "font-semibold text-gray-800" : "text-gray-500"}>{label}</span>
                      <span className={`font-${bold ? "bold" : "semibold"} ${amt >= 0 ? (bold ? "text-gray-900" : "text-gray-700") : "text-red-500"}`}>
                        {amt < 0 ? "−" : ""}{fmt(Math.abs(amt))}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="border-t-2 border-gray-200 mt-1 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">Resultado final</span>
                    <span className={`text-sm font-bold ${plMonth.finalResult >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {plMonth.finalResult < 0 ? "−" : ""}{fmt(Math.abs(plMonth.finalResult))}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-gray-50">
                <button onClick={() => router.push("/finances?tab=resultado")}
                  className="text-xs font-medium hover:underline" style={{ color: "#49789d" }}>
                  Ver detalle completo →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Pedidos a cobrar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50">
                <DollarSign size={15} className="text-amber-600" />
              </div>
              <h2 className="font-semibold text-gray-900">A cobrar</h2>
            </div>
            <button onClick={() => router.push("/finances")} className="text-xs font-medium hover:underline" style={{ color: "#49789d" }}>Ver finanzas</button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-200" /></div>
          ) : collectOrders.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No hay pedidos pendientes de cobro.</p>
          ) : (
            <div className="space-y-1">
              {collectOrders.map((o) => (
                <div key={o.id} onClick={() => router.push(`/orders/${o.id}`)}
                  className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.client_display}</p>
                    <p className="text-xs text-gray-400">#{String(o.order_number ?? "—").padStart(4, "0")}</p>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">{fmt(o.total - o.paid)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pedidos del portal */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#fef3cd" }}>
                <Bell size={15} className="text-amber-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Pedidos del portal</h2>
              {portalOrders.length > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{portalOrders.length}</span>
              )}
            </div>
            <button onClick={() => router.push("/orders")} className="text-xs font-medium hover:underline" style={{ color: "#49789d" }}>Ver todos</button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-200" /></div>
          ) : portalOrders.length === 0 ? (
            <div className="text-center py-8">
              <Globe size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Sin pedidos pendientes del portal.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {portalOrders.map((o) => (
                <div key={o.id} onClick={() => router.push(`/orders/${o.id}`)}
                  className="flex items-center justify-between py-2 px-2 rounded-lg bg-amber-50/50 hover:bg-amber-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 leading-tight">{o.client_display}</p>
                      <p className="text-xs text-gray-400">
                        #{String(o.order_number ?? "—").padStart(4, "0")} · {fmtDateTime(o.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{fmt(o.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Insumos críticos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
                <Package size={15} className="text-red-500" />
              </div>
              <h2 className="font-semibold text-gray-900">Insumos críticos</h2>
            </div>
            <button onClick={() => router.push("/stock")} className="text-xs font-medium hover:underline" style={{ color: "#49789d" }}>Ver stock</button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-200" /></div>
          ) : criticalMaterials.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">Todos los insumos están sobre el mínimo.</p>
          ) : (
            <div className="space-y-2">
              {criticalMaterials.map((m) => (
                <div key={m.name} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900">{m.name}</span>
                    <span className="text-xs text-gray-400">{m.unit}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-red-600">{m.stock % 1 === 0 ? m.stock : m.stock.toFixed(2)}</span>
                    <span className="text-xs text-gray-400 ml-1">/ mín. {m.critical}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ventas chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8f0f7" }}>
              <TrendingUp size={15} style={{ color: "#49789d" }} />
            </div>
            <h2 className="font-semibold text-gray-900">Ventas — últimos 12 meses</h2>
          </div>
          {loading || !mounted ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-200" /></div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={50} />
                <Tooltip
                  formatter={(value) => [fmt(value as number), "Ventas"]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #f0f0f0", fontSize: "12px" }}
                />
                <Bar dataKey="ventas" fill="#49789d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Compras pendientes de entrega */}
      {!loading && pendingPurchases.length > 0 && (
        <div className="mt-5 bg-white border border-amber-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50">
                <Truck size={15} className="text-amber-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Compras pendientes de entrega</h2>
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingPurchases.length}
              </span>
            </div>
            <button onClick={() => router.push("/purchases")} className="text-xs font-medium hover:underline" style={{ color: "#49789d" }}>
              Ver compras
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {pendingPurchases.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.materialName}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.date + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                    {p.supplier ? ` · ${p.supplier}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-amber-600">
                  {p.quantity % 1 === 0 ? p.quantity : p.quantity.toFixed(2)} {p.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Costos incompletos */}
      {!loading && incompleteCosts.length > 0 && (
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100">
                <AlertTriangle size={15} className="text-amber-600" />
              </div>
              <h2 className="font-semibold text-amber-900">Costos incompletos</h2>
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {incompleteCosts.length}
              </span>
            </div>
            <button
              onClick={() => router.push("/costs")}
              className="text-xs font-medium text-amber-700 hover:underline"
            >
              Ir a costos
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {incompleteCosts.map((item) => (
              <div key={item.productName} className="bg-white rounded-lg px-3 py-2.5 border border-amber-100">
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Sin precio: {item.missingIngredients.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
