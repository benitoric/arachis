"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2, ChevronDown, ChevronRight, TrendingUp, RefreshCw, AlertCircle, History,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderRow {
  id: string;
  order_number: number | null;
  order_date: string;
  client_id: string | null;
  guest_name: string | null;
  payment_method: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
}

interface ExpenseRow {
  id: string;
  date: string;
  category_id: string;
  category_name: string;
  description: string | null;
  amount: number;
}

interface EventRow {
  id: string;
  date: string;
  description: string;
  income: number;
  expenses: number;
  notes: string | null;
}

interface ExchangeRate {
  date: string;
  rate: number;
}

interface LoadedData {
  orders: OrderRow[];
  orderItems: OrderItemRow[];
  expenses: ExpenseRow[];
  events: EventRow[];
  clientMap: Record<string, string>;
  productNameMap: Record<string, string>;
  exchangeRates: ExchangeRate[];
}

// ─── Interfaces for P&L ───────────────────────────────────────────────────────

interface PLOrder {
  id: string;
  order_number: number | null;
  order_date: string;
  client_display: string;
  gross: number;
  grossUSD: number | null;
  isCourtesy: boolean;
}

interface PLCourtesyOrder {
  id: string;
  order_number: number | null;
  order_date: string;
  client_display: string;
  amount: number;
  amountUSD: number | null;
}

interface PLDiscount {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  amountUSD: number | null;
}

interface PLCMVItem {
  id: string;
  product_id: string;
  order_number: number | null;
  order_date: string;
  product_name: string;
  quantity: number;
  unitCMV: number;
  total: number;
  totalUSD: number | null;
}

interface CmvBreakdownRow {
  material_id: string;
  material_name: string;
  material_unit: string;
  recipe_qty: number | string;
  unit_cost: number | string;
  source_purchase_date: string | null;
  source_supplier: string | null;
  contribution: number | string;
}

interface PLExpenseItem {
  id: string;
  date: string;
  description: string | null;
  amount: number;
  amountUSD: number | null;
}

interface PLCategory {
  id: string;
  name: string;
  total: number;
  totalUSD: number | null;
  items: PLExpenseItem[];
}

interface PLEvent {
  id: string;
  date: string;
  description: string;
  income: number;
  expenses: number;
  result: number;
  resultUSD: number | null;
}

interface PLResult {
  grossRevenue: number;
  grossRevenueUSD: number | null;
  orders: PLOrder[];
  discounts: number;
  discountsUSD: number | null;
  discountItems: PLDiscount[];
  netRevenue: number;
  netRevenueUSD: number | null;
  cmv: number;
  cmvUSD: number | null;
  cmvItems: PLCMVItem[];
  contribution: number;
  contributionUSD: number | null;
  courtesy: number;
  courtesyUSD: number | null;
  courtesyOrders: PLCourtesyOrder[];
  expenseCategories: PLCategory[];
  totalIndirect: number;
  totalIndirectUSD: number | null;
  partial: number;
  partialUSD: number | null;
  eventsResult: number;
  eventsResultUSD: number | null;
  eventItems: PLEvent[];
  finalResult: number;
  finalResultUSD: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

function lookupRate(rates: ExchangeRate[], date: string): number | null {
  // rates is assumed sorted desc by date
  for (const r of rates) {
    if (r.date <= date) return r.rate;
  }
  return null;
}

// ─── P&L Computation ─────────────────────────────────────────────────────────

function computePL(data: LoadedData, dateFrom: string, dateTo: string, currency: "ARS" | "USD"): PLResult {
  const sortedRates = [...data.exchangeRates].sort((a, b) => b.date.localeCompare(a.date));

  const toUSD = (amount: number, date: string): number | null => {
    if (currency === "ARS") return null;
    const rate = lookupRate(sortedRates, date);
    return rate ? amount / rate : null;
  };

  // ── Completed orders in period ──────────────────────────────────────────
  const periodOrders = data.orders.filter(
    (o) => o.order_date >= dateFrom && o.order_date <= dateTo
  );
  const periodOrderIds = new Set(periodOrders.map((o) => o.id));
  const periodItems = data.orderItems.filter((i) => periodOrderIds.has(i.order_id));

  const orderTotals: Record<string, number> = {};
  periodItems.forEach((i) => {
    orderTotals[i.order_id] = (orderTotals[i.order_id] ?? 0) + i.quantity * i.unit_price;
  });

  const plOrders: PLOrder[] = periodOrders
    .map((o) => ({
      id: o.id,
      order_number: o.order_number,
      order_date: o.order_date,
      client_display: data.clientMap[o.client_id ?? ""] ?? o.guest_name ?? "—",
      gross: orderTotals[o.id] ?? 0,
      grossUSD: toUSD(orderTotals[o.id] ?? 0, o.order_date),
      isCourtesy: o.payment_method === "sin_cargo",
    }))
    .sort((a, b) => a.order_date.localeCompare(b.order_date));

  const grossRevenue = plOrders.reduce((s, o) => s + o.gross, 0);
  const grossRevenueUSD =
    currency === "USD" ? plOrders.reduce((s, o) => s + (o.grossUSD ?? 0), 0) : null;

  // ── Discounts ────────────────────────────────────────────────────────────
  const DISCOUNT_CAT = "descuentos otorgados";
  const periodExpenses = data.expenses.filter((e) => e.date >= dateFrom && e.date <= dateTo);
  const discountExpenses = periodExpenses.filter(
    (e) => e.category_name.toLowerCase() === DISCOUNT_CAT
  );
  const otherExpenses = periodExpenses.filter(
    (e) => e.category_name.toLowerCase() !== DISCOUNT_CAT
  );

  const discountItems: PLDiscount[] = discountExpenses.map((e) => ({
    id: e.id,
    date: e.date,
    description: e.description,
    amount: e.amount,
    amountUSD: toUSD(e.amount, e.date),
  }));
  const discounts = discountItems.reduce((s, d) => s + d.amount, 0);
  const discountsUSD =
    currency === "USD" ? discountItems.reduce((s, d) => s + (d.amountUSD ?? 0), 0) : null;

  // ── Cortesía (pedidos sin cargo a precio de lista) ───────────────────────
  // Se resta de los ingresos brutos —igual que los descuentos otorgados— para
  // determinar la venta neta. La venta (en ingresos brutos) y la cortesía se
  // netean, dejando un efecto neutro a nivel de ingresos.
  const courtesyOrders: PLCourtesyOrder[] = plOrders
    .filter((o) => o.isCourtesy)
    .map((o) => ({
      id: o.id,
      order_number: o.order_number,
      order_date: o.order_date,
      client_display: o.client_display,
      amount: o.gross,
      amountUSD: o.grossUSD,
    }));
  const courtesy = courtesyOrders.reduce((s, o) => s + o.amount, 0);
  const courtesyUSD =
    currency === "USD" ? courtesyOrders.reduce((s, o) => s + (o.amountUSD ?? 0), 0) : null;

  const netRevenue = grossRevenue - discounts - courtesy;
  const netRevenueUSD =
    currency === "USD"
      ? (grossRevenueUSD ?? 0) - (discountsUSD ?? 0) - (courtesyUSD ?? 0)
      : null;

  // ── CMV (costo congelado en order_items.unit_cost al momento de la venta) ─
  const cmvItems: PLCMVItem[] = [];
  periodOrders.forEach((order) => {
    const items = periodItems.filter((i) => i.order_id === order.id);
    items.forEach((item) => {
      const unitCMV = item.unit_cost ?? 0;
      const total = unitCMV * item.quantity;
      if (total <= 0) return;
      cmvItems.push({
        id: item.id,
        product_id: item.product_id,
        order_number: order.order_number,
        order_date: order.order_date,
        product_name: data.productNameMap[item.product_id] ?? "—",
        quantity: item.quantity,
        unitCMV,
        total,
        totalUSD: toUSD(total, order.order_date),
      });
    });
  });

  const cmv = cmvItems.reduce((s, i) => s + i.total, 0);
  const cmvUSD =
    currency === "USD" ? cmvItems.reduce((s, i) => s + (i.totalUSD ?? 0), 0) : null;

  const contribution = netRevenue - cmv;
  const contributionUSD =
    currency === "USD" ? (netRevenueUSD ?? 0) - (cmvUSD ?? 0) : null;

  // ── Indirect expenses by category ────────────────────────────────────────
  const catMap: Record<string, PLCategory> = {};
  otherExpenses.forEach((e) => {
    if (!catMap[e.category_id]) {
      catMap[e.category_id] = {
        id: e.category_id,
        name: e.category_name,
        total: 0,
        totalUSD: currency === "USD" ? 0 : null,
        items: [],
      };
    }
    const usd = toUSD(e.amount, e.date);
    catMap[e.category_id].total += e.amount;
    if (currency === "USD") {
      catMap[e.category_id].totalUSD = (catMap[e.category_id].totalUSD ?? 0) + (usd ?? 0);
    }
    catMap[e.category_id].items.push({
      id: e.id,
      date: e.date,
      description: e.description,
      amount: e.amount,
      amountUSD: usd,
    });
  });

  const expenseCategories = Object.values(catMap).sort((a, b) => b.total - a.total);
  const totalIndirect = expenseCategories.reduce((s, c) => s + c.total, 0);
  const totalIndirectUSD =
    currency === "USD"
      ? expenseCategories.reduce((s, c) => s + (c.totalUSD ?? 0), 0)
      : null;

  const partial = contribution - totalIndirect;
  const partialUSD =
    currency === "USD"
      ? (contributionUSD ?? 0) - (totalIndirectUSD ?? 0)
      : null;

  // ── Events ───────────────────────────────────────────────────────────────
  const periodEvents = data.events.filter((e) => e.date >= dateFrom && e.date <= dateTo);
  const eventItems: PLEvent[] = periodEvents.map((e) => {
    const result = e.income - e.expenses;
    return {
      id: e.id,
      date: e.date,
      description: e.description,
      income: e.income,
      expenses: e.expenses,
      result,
      resultUSD: toUSD(result, e.date),
    };
  });

  const eventsResult = eventItems.reduce((s, e) => s + e.result, 0);
  const eventsResultUSD =
    currency === "USD" ? eventItems.reduce((s, e) => s + (e.resultUSD ?? 0), 0) : null;

  const finalResult = partial + eventsResult;
  const finalResultUSD =
    currency === "USD" ? (partialUSD ?? 0) + (eventsResultUSD ?? 0) : null;

  return {
    grossRevenue, grossRevenueUSD, orders: plOrders,
    discounts, discountsUSD, discountItems,
    netRevenue, netRevenueUSD,
    cmv, cmvUSD, cmvItems,
    contribution, contributionUSD,
    courtesy, courtesyUSD, courtesyOrders,
    expenseCategories, totalIndirect, totalIndirectUSD,
    partial, partialUSD,
    eventsResult, eventsResultUSD, eventItems,
    finalResult, finalResultUSD,
  };
}

// ─── Chart Computation ────────────────────────────────────────────────────────

interface ChartPoint {
  month: string;
  netRevenue: number;
  cmv: number;
  contribution: number;
  indirect: number;
  result: number;
}

function computeChart(data: LoadedData, currency: "ARS" | "USD"): ChartPoint[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const from = `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(yr, mo + 1, 0).getDate();
    const to = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const pl = computePL(data, from, to, currency);
    return {
      month: `${MONTHS_ES[mo]} ${String(yr).slice(2)}`,
      netRevenue: currency === "USD" ? (pl.netRevenueUSD ?? 0) : pl.netRevenue,
      cmv: currency === "USD" ? (pl.cmvUSD ?? 0) : pl.cmv,
      contribution: currency === "USD" ? (pl.contributionUSD ?? 0) : pl.contribution,
      indirect: currency === "USD" ? (pl.totalIndirectUSD ?? 0) : pl.totalIndirect,
      result: currency === "USD" ? (pl.finalResultUSD ?? 0) : pl.finalResult,
    };
  });
}

// ─── P&L Row Component ────────────────────────────────────────────────────────

function PLRow({
  prefix,
  label,
  amount,
  amountUSD,
  grossRevenue,
  currency,
  bold,
  indent,
  expandKey,
  expanded,
  onToggle,
  colorClass,
  children,
}: {
  prefix?: string;
  label: string;
  amount: number;
  amountUSD: number | null;
  grossRevenue: number;
  currency: "ARS" | "USD";
  bold?: boolean;
  indent?: boolean;
  expandKey?: string;
  expanded?: boolean;
  onToggle?: () => void;
  colorClass?: string;
  children?: React.ReactNode;
}) {
  const displayAmt = currency === "USD" ? (amountUSD ?? null) : amount;
  const pct =
    grossRevenue > 0 && currency === "ARS"
      ? `${((Math.abs(amount) / grossRevenue) * 100).toFixed(1)}%`
      : grossRevenue > 0 && currency === "USD" && amountUSD !== null
      ? `${((Math.abs(amountUSD) / (grossRevenue / (displayAmt !== null ? amount / (displayAmt || 1) : 1))) * 100).toFixed(1)}%`
      : "—";

  // Simplified pct: always use ARS amounts for percentage
  const pctVal =
    grossRevenue > 0
      ? `${((Math.abs(amount) / grossRevenue) * 100).toFixed(1)}%`
      : "—";

  const fmtAmt = (n: number | null) => {
    if (n === null) return <span className="text-gray-300">—</span>;
    const formatted = currency === "USD" ? fmtUSD(n) : fmtARS(n);
    return formatted;
  };

  return (
    <>
      <div
        className={`flex items-center justify-between py-2.5 px-1 rounded-lg transition-colors ${
          expandKey ? "cursor-pointer hover:bg-gray-50" : ""
        } ${indent ? "pl-4" : ""}`}
        onClick={expandKey ? onToggle : undefined}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {expandKey && (
            <span className="text-gray-400 flex-shrink-0">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          {prefix && (
            <span className="text-xs font-mono text-gray-400 w-5 flex-shrink-0">{prefix}</span>
          )}
          <span className={`text-sm truncate ${bold ? "font-semibold text-gray-900" : indent ? "text-gray-500" : "text-gray-700"}`}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="text-xs text-gray-400 w-10 text-right hidden sm:block">{pctVal}</span>
          <span className={`text-sm font-semibold w-32 text-right ${colorClass ?? (bold ? "text-gray-900" : "text-gray-800")}`}>
            {fmtAmt(displayAmt)}
          </span>
        </div>
      </div>
      {expanded && children && (
        <div className="mx-1 mb-2 bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
          {children}
        </div>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ResultadoTab() {
  const supabase = createClient();
  const now = new Date();

  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = (() => {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  })();

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSeries, setShowSeries] = useState({
    netRevenue: true,
    cmv: false,
    contribution: true,
    indirect: false,
    result: true,
  });

  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [historicalMsg, setHistoricalMsg] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualRate, setManualRate] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  // Desglose por línea de CMV (lazy: se carga al expandir cada item)
  const [expandedCmvItems, setExpandedCmvItems] = useState<Set<string>>(new Set());
  const [cmvBreakdownCache, setCmvBreakdownCache] = useState<Record<string, CmvBreakdownRow[]>>({});
  const [loadingBreakdown, setLoadingBreakdown] = useState<Set<string>>(new Set());

  async function toggleCmvItem(item: PLCMVItem) {
    setExpandedCmvItems((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    if (cmvBreakdownCache[item.id] || loadingBreakdown.has(item.id)) return;
    setLoadingBreakdown((prev) => new Set(prev).add(item.id));
    const { data: rows, error } = await supabase.rpc("order_item_cmv_breakdown", {
      p_product_id: item.product_id,
      p_date: item.order_date,
    });
    if (!error && rows) {
      setCmvBreakdownCache((prev) => ({ ...prev, [item.id]: rows as CmvBreakdownRow[] }));
    }
    setLoadingBreakdown((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  }

  // Load all data for 12 months + selected period
  const loadData = useCallback(async () => {
    setLoading(true);

    const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 10);
    const rangeFrom = dateFrom < twelveAgo ? dateFrom : twelveAgo;

    const [
      { data: orders },
      { data: orderItems },
      { data: expenses },
      { data: categories },
      { data: events },
      { data: clients },
      { data: products },
      { data: exchangeRates },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, order_date, client_id, guest_name, payment_method")
        .eq("status", "cumplido")
        .gte("order_date", rangeFrom),
      supabase.from("order_items").select("id, order_id, product_id, quantity, unit_price, unit_cost"),
      supabase
        .from("indirect_expenses")
        .select("id, date, category_id, description, amount")
        .gte("date", rangeFrom),
      supabase.from("expense_categories").select("id, name"),
      supabase.from("event_results").select("*").gte("date", rangeFrom),
      supabase.from("clients").select("id, last_name, first_name"),
      supabase.from("products").select("id, name, presentation"),
      supabase.from("exchange_rates").select("date, rate").order("date", { ascending: false }),
    ]);

    // category name map
    const catNameMap: Record<string, string> = {};
    (categories ?? []).forEach((c) => { catNameMap[c.id] = c.name; });

    // enrich expenses with category name
    const enrichedExpenses: ExpenseRow[] = (expenses ?? []).map((e) => ({
      ...e,
      category_name: catNameMap[e.category_id] ?? "Sin categoría",
    }));

    const clientMap: Record<string, string> = {};
    (clients ?? []).forEach((c) => {
      clientMap[c.id] = c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name;
    });

    const productNameMap: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (products ?? [] as any[]).forEach((p: { id: string; name: string; presentation: string | null }) => {
      productNameMap[p.id] = p.presentation ? `${p.name} (${p.presentation})` : p.name;
    });

    // filter order items to only those belonging to loaded orders
    const orderIdSet = new Set((orders ?? []).map((o) => o.id));
    const filteredItems = (orderItems ?? []).filter((i) => orderIdSet.has(i.order_id));

    setData({
      orders: orders ?? [],
      orderItems: filteredItems,
      expenses: enrichedExpenses,
      events: events ?? [],
      clientMap,
      productNameMap,
      exchangeRates: exchangeRates ?? [],
    });
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  const pl = useMemo(
    () => (data ? computePL(data, dateFrom, dateTo, currency) : null),
    [data, dateFrom, dateTo, currency]
  );

  const chartData = useMemo(
    () => (data ? computeChart(data, currency) : []),
    [data, currency]
  );

  const hasRates = (data?.exchangeRates?.length ?? 0) > 0;

  async function fetchCurrentRate() {
    setFetchingRate(true);
    try {
      const res = await fetch("/api/exchange-rate");
      if (res.ok) {
        await loadData();
      }
    } finally {
      setFetchingRate(false);
    }
  }

  async function loadHistoricalRates() {
    setLoadingHistorical(true);
    setHistoricalMsg(null);
    setShowManualForm(false);
    try {
      const res = await fetch("/api/load-historical-rates");
      const body = await res.json() as { loaded?: number; from?: string; source?: string; error?: string; manual?: boolean };
      if (res.ok && body.loaded) {
        const srcLabel = body.source === "dolarapi" ? " (solo TC actual — cargá los históricos manualmente)" : "";
        setHistoricalMsg(`✓ ${body.loaded} tipo${body.loaded !== 1 ? "s" : ""} de cambio cargado${body.loaded !== 1 ? "s" : ""} desde ${body.from}${srcLabel}`);
        if (body.source === "dolarapi") setShowManualForm(true);
        await loadData();
      } else {
        setHistoricalMsg(body.error ?? "No se pudieron cargar los TCs históricos.");
        if (body.manual) setShowManualForm(true);
      }
    } catch {
      setHistoricalMsg("Error de conexión al cargar TCs históricos.");
      setShowManualForm(true);
    } finally {
      setLoadingHistorical(false);
    }
  }

  async function saveManualRate() {
    const rate = parseFloat(manualRate);
    if (!manualDate || !rate || rate <= 0) return;
    setSavingManual(true);
    try {
      const res = await fetch("/api/load-historical-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: manualDate, rate }),
      });
      const body = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && body.ok) {
        setHistoricalMsg(`✓ TC guardado: ${manualDate} = $${rate}`);
        setManualRate("");
        await loadData();
      } else {
        setHistoricalMsg(`Error al guardar: ${body.error ?? "desconocido"}`);
      }
    } catch {
      setHistoricalMsg("Error de conexión al guardar TC manual.");
    } finally {
      setSavingManual(false);
    }
  }

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  const fmt = (n: number | null) => {
    if (n === null) return "—";
    return currency === "USD" ? fmtUSD(n) : fmtARS(n);
  };

  const grossRef = pl?.grossRevenue ?? 0;

  const SERIES = [
    { key: "netRevenue", label: "Ing. netos", color: "#49789d" },
    { key: "cmv", label: "CMV", color: "#e8475f" },
    { key: "contribution", label: "Contrib. marginal", color: "#22c55e" },
    { key: "indirect", label: "Gastos ind.", color: "#f59e0b" },
    { key: "result", label: "Resultado final", color: "#8b5cf6" },
  ] as const;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>

        {/* ARS / USD toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
          <button
            onClick={() => setCurrency("ARS")}
            className={`px-4 py-2 transition-colors ${currency === "ARS" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={currency === "ARS" ? { backgroundColor: "#49789d" } : undefined}
          >
            ARS
          </button>
          <button
            onClick={() => { setCurrency("USD"); if (!hasRates) fetchCurrentRate(); }}
            className={`px-4 py-2 transition-colors ${currency === "USD" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={currency === "USD" ? { backgroundColor: "#49789d" } : undefined}
          >
            USD
          </button>
        </div>

        {currency === "USD" && !hasRates && (
          <button
            onClick={fetchCurrentRate}
            disabled={fetchingRate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-60"
          >
            {fetchingRate ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Cargar TC actual
          </button>
        )}
        {currency === "USD" && hasRates && (
          <button
            onClick={fetchCurrentRate}
            disabled={fetchingRate}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-60"
            title="Actualizar tipo de cambio"
          >
            {fetchingRate ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Actualizar TC
          </button>
        )}

        {/* Historical rates */}
        <button
          onClick={loadHistoricalRates}
          disabled={loadingHistorical}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-60"
          title="Cargar tipos de cambio históricos desde argentinadatos.com"
        >
          {loadingHistorical ? <Loader2 size={12} className="animate-spin" /> : <History size={12} />}
          TCs históricos
        </button>
      </div>

      {historicalMsg && (
        <div className={`text-xs rounded-lg px-3 py-2 mb-3 ${historicalMsg.startsWith("✓") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {historicalMsg}
        </div>
      )}

      {/* Manual TC entry form */}
      {showManualForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">Cargar tipo de cambio manualmente</p>
            <button onClick={() => setShowManualForm(false)} className="text-gray-400 hover:text-gray-600 text-xs">Cerrar</button>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
              <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">$ por 1 USD (venta oficial)</label>
              <input type="number" value={manualRate} onChange={(e) => setManualRate(e.target.value)}
                min={0} step={0.01} placeholder="Ej: 1200.50"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-36" />
            </div>
            <button
              onClick={saveManualRate}
              disabled={savingManual || !manualRate || parseFloat(manualRate) <= 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "#49789d" }}
            >
              {savingManual ? <Loader2 size={13} className="animate-spin" /> : null}
              Guardar TC
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Podés cargar un TC por día. Se usará como tipo de cambio para todas las operaciones de esa fecha.
          </p>
        </div>
      )}

      {currency === "USD" && !hasRates && !fetchingRate && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
          <AlertCircle size={15} className="flex-shrink-0" />
          No hay tipos de cambio cargados. Hacé clic en &quot;Cargar TC actual&quot; para obtener el dólar oficial BNA.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : pl && (
        <>
          {/* P&L Card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} style={{ color: "#49789d" }} />
              <h3 className="font-semibold text-gray-900">Estado de Resultados</h3>
              {currency === "USD" && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">USD</span>
              )}
            </div>

            <div className="space-y-0">
              {/* Header */}
              <div className="flex items-center justify-between pb-1 border-b border-gray-100 mb-1">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Concepto</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase w-10 text-right hidden sm:block">%</span>
                  <span className="text-xs font-semibold text-gray-400 uppercase w-32 text-right">Monto</span>
                </div>
              </div>

              {/* (+) Ingresos brutos */}
              <PLRow
                prefix="(+)" label="Ingresos brutos" bold
                amount={pl.grossRevenue} amountUSD={pl.grossRevenueUSD}
                grossRevenue={grossRef} currency={currency}
                expandKey="gross" expanded={expanded === "gross"} onToggle={() => toggle("gross")}
              >
                <div className="divide-y divide-gray-100">
                  <div className="grid grid-cols-4 px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                    <span>N°</span><span>Fecha</span><span>Cliente</span>
                    <span className="text-right">Total</span>
                  </div>
                  {pl.orders.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-gray-400">Sin pedidos cumplidos en el período.</p>
                  ) : pl.orders.map((o) => (
                    <div key={o.id} className="grid grid-cols-4 px-4 py-2 text-xs hover:bg-gray-100">
                      <span className="font-mono text-gray-600">#{String(o.order_number ?? "—").padStart(4, "0")}</span>
                      <span className="text-gray-500">{fmtDate(o.order_date)}</span>
                      <span className="text-gray-700 truncate pr-2">{o.client_display}</span>
                      <span className="text-right font-semibold text-gray-900">
                        {currency === "USD" ? fmtUSD(o.grossUSD ?? 0) : fmtARS(o.gross)}
                      </span>
                    </div>
                  ))}
                </div>
              </PLRow>

              {/* (-) Descuentos */}
              {pl.discounts > 0 && (
                <PLRow
                  prefix="(−)" label="Descuentos otorgados"
                  amount={-pl.discounts} amountUSD={pl.discountsUSD !== null ? -pl.discountsUSD : null}
                  grossRevenue={grossRef} currency={currency}
                  colorClass="text-red-600"
                  expandKey="discounts" expanded={expanded === "discounts"} onToggle={() => toggle("discounts")}
                >
                  <div className="divide-y divide-gray-100">
                    {pl.discountItems.map((d) => (
                      <div key={d.id} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-gray-100">
                        <div>
                          <span className="text-gray-500">{fmtDate(d.date)}</span>
                          {d.description && <span className="text-gray-600 ml-3">{d.description}</span>}
                        </div>
                        <span className="font-semibold text-red-600">
                          −{currency === "USD" ? fmtUSD(d.amountUSD ?? 0) : fmtARS(d.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </PLRow>
              )}

              {/* (-) Cortesía */}
              {pl.courtesy > 0 && (
                <PLRow
                  prefix="(−)" label="Cortesía"
                  amount={-pl.courtesy} amountUSD={pl.courtesyUSD !== null ? -pl.courtesyUSD : null}
                  grossRevenue={grossRef} currency={currency}
                  colorClass="text-red-600"
                  expandKey="courtesy" expanded={expanded === "courtesy"} onToggle={() => toggle("courtesy")}
                >
                  <div className="divide-y divide-gray-100">
                    <div className="grid grid-cols-4 px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                      <span>N°</span><span>Fecha</span><span>Cliente</span>
                      <span className="text-right">Bonificación</span>
                    </div>
                    {pl.courtesyOrders.map((o) => (
                      <div key={o.id} className="grid grid-cols-4 px-4 py-2 text-xs hover:bg-gray-100">
                        <span className="font-mono text-gray-600">#{String(o.order_number ?? "—").padStart(4, "0")}</span>
                        <span className="text-gray-500">{fmtDate(o.order_date)}</span>
                        <span className="text-gray-700 truncate pr-2">{o.client_display}</span>
                        <span className="text-right font-semibold text-red-600">
                          −{currency === "USD" ? fmtUSD(o.amountUSD ?? 0) : fmtARS(o.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </PLRow>
              )}

              {/* (=) Ingresos netos */}
              <div className="flex items-center justify-between py-2 px-1 border-t border-gray-200 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">(=)</span>
                  <span className="text-sm font-bold text-gray-900">Ingresos netos</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-10 text-right hidden sm:block">
                    {grossRef > 0 ? `${((pl.netRevenue / grossRef) * 100).toFixed(1)}%` : "—"}
                  </span>
                  <span className="text-sm font-bold text-gray-900 w-32 text-right">{fmt(currency === "USD" ? pl.netRevenueUSD : pl.netRevenue)}</span>
                </div>
              </div>

              <div className="pt-2 mt-1">
                {/* (-) CMV */}
                <PLRow
                  prefix="(−)" label="Costo de Mercadería Vendida (CMV)"
                  amount={-pl.cmv} amountUSD={pl.cmvUSD !== null ? -pl.cmvUSD : null}
                  grossRevenue={grossRef} currency={currency}
                  colorClass="text-red-600"
                  expandKey="cmv" expanded={expanded === "cmv"} onToggle={() => toggle("cmv")}
                >
                  <div className="divide-y divide-gray-100">
                    {pl.cmvItems.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">Sin recetas configuradas para los productos vendidos.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-5 px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                          <span>Pedido</span><span>Artículo</span>
                          <span className="text-right">Cant.</span>
                          <span className="text-right">CMV unit.</span>
                          <span className="text-right">Total</span>
                        </div>
                        {pl.cmvItems.map((i) => {
                          const isOpen = expandedCmvItems.has(i.id);
                          const isLoading = loadingBreakdown.has(i.id);
                          const rows = cmvBreakdownCache[i.id];
                          return (
                            <div key={i.id}>
                              <button
                                type="button"
                                onClick={() => toggleCmvItem(i)}
                                className="w-full grid grid-cols-5 px-4 py-2 text-xs hover:bg-gray-100 text-left"
                              >
                                <span className="font-mono text-gray-500 flex items-center gap-1">
                                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  #{String(i.order_number ?? "—").padStart(4, "0")}
                                </span>
                                <span className="text-gray-700 truncate pr-2">{i.product_name}</span>
                                <span className="text-right text-gray-600">{i.quantity}</span>
                                <span className="text-right text-gray-600">
                                  {currency === "USD"
                                    ? fmtUSD((i.totalUSD ?? 0) / (i.quantity || 1))
                                    : fmtARS(i.unitCMV)}
                                </span>
                                <span className="text-right font-semibold text-red-600">
                                  −{currency === "USD" ? fmtUSD(i.totalUSD ?? 0) : fmtARS(i.total)}
                                </span>
                              </button>
                              {isOpen && (
                                <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
                                  {isLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-500 py-1">
                                      <Loader2 size={12} className="animate-spin" />
                                      Cargando composición…
                                    </div>
                                  ) : rows && rows.length > 0 ? (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-gray-400 uppercase">
                                          <th className="text-left font-semibold py-1">Material</th>
                                          <th className="text-right font-semibold py-1">Receta</th>
                                          <th className="text-right font-semibold py-1">Costo unit.</th>
                                          <th className="text-left font-semibold py-1 pl-3">Compra usada</th>
                                          <th className="text-right font-semibold py-1">Aporte</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {rows.map((b) => (
                                          <tr key={b.material_id} className="border-t border-gray-200">
                                            <td className="py-1 text-gray-700">{b.material_name}</td>
                                            <td className="py-1 text-right text-gray-600">
                                              {Number(b.recipe_qty)} {b.material_unit}
                                            </td>
                                            <td className="py-1 text-right text-gray-600">
                                              {fmtARS(Number(b.unit_cost))}
                                            </td>
                                            <td className="py-1 pl-3 text-gray-500">
                                              {b.source_purchase_date
                                                ? `${fmtDate(b.source_purchase_date)}${b.source_supplier ? ` · ${b.source_supplier}` : ""}`
                                                : Number(b.unit_cost) > 0
                                                  ? "costo manual"
                                                  : "—"}
                                            </td>
                                            <td className="py-1 text-right font-medium text-gray-700">
                                              {fmtARS(Number(b.contribution))}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-xs text-gray-400 py-1">Sin receta configurada para este producto.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </PLRow>

                {/* (=) Contribución marginal */}
                <div className="flex items-center justify-between py-2 px-1 border-t border-gray-200 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">(=)</span>
                    <span className="text-sm font-bold text-gray-900">Contribución marginal</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-10 text-right hidden sm:block">
                      {grossRef > 0 ? `${((pl.contribution / grossRef) * 100).toFixed(1)}%` : "—"}
                    </span>
                    <span className={`text-sm font-bold w-32 text-right ${pl.contribution >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {fmt(currency === "USD" ? pl.contributionUSD : pl.contribution)}
                    </span>
                  </div>
                </div>
              </div>

              {/* (-) Indirect expenses */}
              <div className="pt-2 mt-1 space-y-0">
                {pl.expenseCategories.length === 0 && (
                  <div className="flex items-center justify-between py-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">(−)</span>
                      <span className="text-sm text-gray-500">Gastos indirectos</span>
                    </div>
                    <span className="text-sm text-gray-400 w-32 text-right">—</span>
                  </div>
                )}
                {pl.expenseCategories.map((cat) => (
                  <PLRow
                    key={cat.id}
                    prefix="(−)" label={cat.name} indent
                    amount={-cat.total} amountUSD={cat.totalUSD !== null ? -cat.totalUSD : null}
                    grossRevenue={grossRef} currency={currency}
                    colorClass="text-red-500"
                    expandKey={`cat-${cat.id}`}
                    expanded={expanded === `cat-${cat.id}`}
                    onToggle={() => toggle(`cat-${cat.id}`)}
                  >
                    <div className="divide-y divide-gray-100">
                      {cat.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-gray-100">
                          <div>
                            <span className="text-gray-500">{fmtDate(item.date)}</span>
                            {item.description && (
                              <span className="text-gray-600 ml-3">{item.description}</span>
                            )}
                          </div>
                          <span className="font-semibold text-red-500">
                            −{currency === "USD" ? fmtUSD(item.amountUSD ?? 0) : fmtARS(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </PLRow>
                ))}
              </div>

              {/* (=) Resultado parcial */}
              <div className="flex items-center justify-between py-2 px-1 border-t border-gray-200 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">(=)</span>
                  <span className="text-sm font-bold text-gray-900">Resultado parcial</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-10 text-right hidden sm:block">
                    {grossRef > 0 ? `${((pl.partial / grossRef) * 100).toFixed(1)}%` : "—"}
                  </span>
                  <span className={`text-sm font-bold w-32 text-right ${pl.partial >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {fmt(currency === "USD" ? pl.partialUSD : pl.partial)}
                  </span>
                </div>
              </div>

              {/* (+/-) Eventos */}
              <div className="pt-1">
                <PLRow
                  prefix="(±)" label="Resultado de eventos"
                  amount={pl.eventsResult} amountUSD={pl.eventsResultUSD}
                  grossRevenue={grossRef} currency={currency}
                  colorClass={pl.eventsResult >= 0 ? "text-green-600" : "text-red-600"}
                  expandKey="events" expanded={expanded === "events"} onToggle={() => toggle("events")}
                >
                  <div className="divide-y divide-gray-100">
                    {pl.eventItems.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">Sin eventos en el período.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-5 px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase">
                          <span>Fecha</span><span className="col-span-2">Descripción</span>
                          <span className="text-right">Ingresos</span>
                          <span className="text-right">Gastos</span>
                        </div>
                        {pl.eventItems.map((e) => (
                          <div key={e.id} className="grid grid-cols-5 px-4 py-2 text-xs hover:bg-gray-100">
                            <span className="text-gray-500">{fmtDate(e.date)}</span>
                            <span className="col-span-2 text-gray-700 truncate pr-2">{e.description}</span>
                            <span className="text-right text-green-600 font-medium">
                              {currency === "USD"
                                ? fmtUSD((e.resultUSD ?? 0) > 0 ? (e.resultUSD ?? 0) : 0)
                                : fmtARS(e.income)}
                            </span>
                            <span className="text-right text-red-500 font-medium">
                              {e.expenses > 0
                                ? `−${currency === "USD" ? fmtUSD(e.expenses / ((e.resultUSD ?? 1) !== 0 ? Math.abs(e.income - e.expenses) / Math.abs(e.result) : 1)) : fmtARS(e.expenses)}`
                                : <span className="text-gray-300">—</span>}
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </PLRow>
              </div>

              {/* (=) Resultado final */}
              <div className={`flex items-center justify-between py-4 px-4 rounded-xl mt-3 ${pl.finalResult >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">(=)</span>
                  <span className={`text-base font-bold ${pl.finalResult >= 0 ? "text-green-800" : "text-red-800"}`}>
                    Resultado final
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 hidden sm:block">
                    {grossRef > 0 ? `${((pl.finalResult / grossRef) * 100).toFixed(1)}%` : "—"}
                  </span>
                  <span className={`text-xl font-bold ${pl.finalResult >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {fmt(currency === "USD" ? pl.finalResultUSD : pl.finalResult)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Evolution Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp size={15} style={{ color: "#49789d" }} />
                Evolución — últimos 12 meses
                {currency === "USD" && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">USD</span>
                )}
              </h3>
            </div>

            {/* Series toggles */}
            <div className="flex flex-wrap gap-2 mb-4">
              {SERIES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setShowSeries((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
                  style={
                    showSeries[s.key]
                      ? { backgroundColor: s.color, borderColor: s.color, color: "#fff" }
                      : { borderColor: "#e5e7eb", color: "#6b7280" }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false} tickLine={false} width={55}
                  tickFormatter={(v: number) =>
                    currency === "USD"
                      ? `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}`
                      : v >= 1_000_000
                      ? `$${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1000
                      ? `$${(v / 1000).toFixed(0)}k`
                      : `$${v}`
                  }
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any) => {
                    const labels: Record<string, string> = {
                      netRevenue: "Ing. netos", cmv: "CMV",
                      contribution: "Contrib. marginal", indirect: "Gastos ind.",
                      result: "Resultado final",
                    };
                    const n = typeof value === "number" ? value : 0;
                    const formatted = currency === "USD" ? fmtUSD(n) : fmtARS(n);
                    return [formatted, labels[String(name)] ?? String(name)];
                  }}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #f0f0f0", fontSize: "12px" }}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      netRevenue: "Ing. netos", cmv: "CMV",
                      contribution: "Contrib. marginal", indirect: "Gastos ind.",
                      result: "Resultado final",
                    };
                    return labels[value] ?? value;
                  }}
                  wrapperStyle={{ fontSize: "11px" }}
                />
                {SERIES.map((s) =>
                  showSeries[s.key] ? (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
