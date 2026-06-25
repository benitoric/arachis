"use client";

import { useState, useEffect, useCallback } from "react";
import { pName } from "@/lib/utils/product";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return fmt(n);
};

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const COLORS = ["#a9760a", "#E8475F", "#e8a95a", "#c99a3a", "#26282e", "#a78bfa", "#34d399", "#f97316", "#94a3b8", "#e879f9"];
const CANAL_COLORS: Record<string, string> = {
  minorista: "#a9760a",
  mayorista: "#26282e",
  portal: "#E8475F",
  otra: "#e8a95a",
};

type Tab = "articulos" | "clientes" | "canales" | "estacionalidad";

interface ArticuloRow { name: string; units: number; revenue: number; margin: number | null }
interface ClienteRow { name: string; units: number; revenue: number }
interface CanalRow { canal: string; units: number; revenue: number; orders: number }
interface MonthRow { month: string; revenue: number; units: number; orders: number }

export default function RankingsPage() {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("articulos");
  const [loading, setLoading] = useState(true);

  const [articulos, setArticulos] = useState<ArticuloRow[]>([]);
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [canales, setCanales] = useState<CanalRow[]>([]);
  const [estacionalidad, setEstacionalidad] = useState<MonthRow[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: articulosSorted, sort: artSort, toggleSort: artToggleSort } = useSortableData(articulos as any[]);
  const sortedArticulos = articulosSorted as ArticuloRow[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: clientesSorted, sort: cliSort, toggleSort: cliToggleSort } = useSortableData(clientes as any[]);
  const sortedClientes = clientesSorted as ClienteRow[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: estacionalidadSorted, sort: estSort, toggleSort: estToggleSort } = useSortableData(estacionalidad as any[]);
  const sortedEstacionalidad = estacionalidadSorted as MonthRow[];

  useEffect(() => { setMounted(true); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      { data: orders },
      { data: orderItems },
      { data: products },
      { data: productCosts },
      { data: clients },
    ] = await Promise.all([
      supabase.from("orders").select("id, client_id, guest_name, status, order_date").eq("status", "cumplido"),
      supabase.from("order_items").select("order_id, product_id, quantity, unit_price"),
      supabase.from("products").select("id, name, presentation"),
      supabase.from("product_costs").select("product_id, direct_cost"),
      supabase.from("clients").select("id, last_name, first_name, price_type"),
    ]);

    const orderMap = new Map((orders ?? []).map((o) => [o.id, o]));
    const productMap = new Map((products ?? []).map((p) => [p.id, pName(p)]));
    const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));
    const costMap = new Map((productCosts ?? []).map((pc) => [pc.product_id, pc.direct_cost ?? 0]));

    // ── Artículos ────────────────────────────────────────────────────────
    const artMap = new Map<string, { name: string; units: number; revenue: number }>();
    (orderItems ?? []).forEach((oi) => {
      const order = orderMap.get(oi.order_id);
      if (!order) return;
      const name = productMap.get(oi.product_id) ?? "—";
      const prev = artMap.get(oi.product_id) ?? { name, units: 0, revenue: 0 };
      artMap.set(oi.product_id, {
        name,
        units: prev.units + oi.quantity,
        revenue: prev.revenue + oi.quantity * oi.unit_price,
      });
    });

    const artRows: ArticuloRow[] = Array.from(artMap.entries()).map(([pid, v]) => {
      const directCost = costMap.get(pid) ?? 0;
      const margin = v.revenue > 0 && directCost > 0
        ? ((v.revenue - directCost * v.units) / v.revenue) * 100
        : null;
      return { ...v, margin };
    });
    setArticulos(artRows);

    // ── Clientes ─────────────────────────────────────────────────────────
    const cliMap = new Map<string, { name: string; units: number; revenue: number }>();
    (orderItems ?? []).forEach((oi) => {
      const order = orderMap.get(oi.order_id);
      if (!order) return;
      const clientKey = order.client_id ?? `guest:${order.guest_name ?? "—"}`;
      const clientData = order.client_id ? clientMap.get(order.client_id) : null;
      const name = clientData
        ? (clientData.first_name ? `${clientData.last_name}, ${clientData.first_name}` : clientData.last_name)
        : (order.guest_name ?? "Anónimo");
      const prev = cliMap.get(clientKey) ?? { name, units: 0, revenue: 0 };
      cliMap.set(clientKey, {
        name,
        units: prev.units + oi.quantity,
        revenue: prev.revenue + oi.quantity * oi.unit_price,
      });
    });
    setClientes(Array.from(cliMap.values()));

    // ── Canales ───────────────────────────────────────────────────────────
    const canalMap = new Map<string, { units: number; revenue: number; orders: Set<string> }>();

    (orderItems ?? []).forEach((oi) => {
      const order = orderMap.get(oi.order_id);
      if (!order) return;

      let canal: string;
      if (order.client_id) {
        canal = clientMap.get(order.client_id)?.price_type ?? "otra";
      } else if ((order as { origin?: string }).origin === "venta_rapida") {
        canal = "venta rápida";
      } else if (order.guest_name != null || (order as { origin?: string }).origin === "portal") {
        canal = "portal";
      } else {
        canal = "otra";
      }

      const prev = canalMap.get(canal) ?? { units: 0, revenue: 0, orders: new Set<string>() };
      prev.orders.add(oi.order_id);
      canalMap.set(canal, {
        units: prev.units + oi.quantity,
        revenue: prev.revenue + oi.quantity * oi.unit_price,
        orders: prev.orders,
      });
    });

    const canalRows: CanalRow[] = Array.from(canalMap.entries()).map(([canal, v]) => ({
      canal,
      units: v.units,
      revenue: v.revenue,
      orders: v.orders.size,
    }));
    setCanales(canalRows.sort((a, b) => b.revenue - a.revenue));

    // ── Estacionalidad ────────────────────────────────────────────────────
    const now = new Date();
    const monthMap = new Map<string, { revenue: number; units: number; orders: Set<string> }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, { revenue: 0, units: 0, orders: new Set() });
    }

    (orderItems ?? []).forEach((oi) => {
      const order = orderMap.get(oi.order_id);
      if (!order) return;
      const key = order.order_date.slice(0, 7);
      if (!monthMap.has(key)) return;
      const prev = monthMap.get(key)!;
      prev.orders.add(oi.order_id);
      monthMap.set(key, {
        revenue: prev.revenue + oi.quantity * oi.unit_price,
        units: prev.units + oi.quantity,
        orders: prev.orders,
      });
    });

    const monthRows: MonthRow[] = Array.from(monthMap.entries()).map(([key, v]) => {
      const [year, month] = key.split("-");
      return {
        month: `${MONTHS_ES[parseInt(month) - 1]} ${year.slice(2)}`,
        revenue: v.revenue,
        units: v.units,
        orders: v.orders.size,
      };
    });
    setEstacionalidad(monthRows);

    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const top10byRevenue = [...articulos].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const top10byUnits = [...articulos].sort((a, b) => b.units - a.units).slice(0, 10);
  const top10cliRevenue = [...clientes].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const top10cliUnits = [...clientes].sort((a, b) => b.units - a.units).slice(0, 10);
  const totalCanalRevenue = canales.reduce((s, c) => s + c.revenue, 0);

  const CANAL_LABEL: Record<string, string> = {
    minorista: "Minorista",
    mayorista: "Mayorista",
    portal: "Portal web",
    otra: "Otra",
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "articulos", label: "Artículos" },
    { key: "clientes", label: "Clientes" },
    { key: "canales", label: "Canales" },
    { key: "estacionalidad", label: "Estacionalidad" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-gray-500 mt-0.5">Basado en pedidos listos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : (
        <>
          {/* ─── ARTÍCULOS ──────────────────────────────────────────── */}
          {tab === "articulos" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Top 10 by revenue */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Top 10 por ventas</h2>
                  {mounted && (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={top10byRevenue} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => [fmt(v as number), "Ventas"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="revenue" fill="#a9760a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Top 10 by units */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Top 10 por unidades</h2>
                  {mounted && (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={top10byUnits} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => [`${v} uds.`, "Unidades"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="units" fill="#E8475F" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Tabla con margen */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <SortableHeader label="Artículo" sortKey="name" sort={artSort} onSort={artToggleSort} className="px-5" />
                      <SortableHeader label="Unidades" sortKey="units" sort={artSort} onSort={artToggleSort} align="right" />
                      <SortableHeader label="Ventas" sortKey="revenue" sort={artSort} onSort={artToggleSort} align="right" />
                      <SortableHeader label="Margen est." sortKey="margin" sort={artSort} onSort={artToggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedArticulos.map((a, i) => (
                      <tr key={a.name} className="hover:bg-gray-50/60">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                              {i + 1}
                            </span>
                            <span className="font-medium text-gray-900">{a.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{a.units}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(a.revenue)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {a.margin != null ? (
                            <span className={`font-semibold ${a.margin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {a.margin.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {articulos.length === 0 && (
                  <p className="text-center py-10 text-sm text-gray-400">No hay datos todavía.</p>
                )}
              </div>
            </div>
          )}

          {/* ─── CLIENTES ────────────────────────────────────────────── */}
          {tab === "clientes" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Top 10 por ventas</h2>
                  {mounted && (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={top10cliRevenue} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => [fmt(v as number), "Ventas"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="revenue" fill="#a9760a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Top 10 por unidades compradas</h2>
                  {mounted && (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={top10cliUnits} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => [`${v} uds.`, "Unidades"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Bar dataKey="units" fill="#E8475F" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <SortableHeader label="Cliente" sortKey="name" sort={cliSort} onSort={cliToggleSort} className="px-5" />
                      <SortableHeader label="Unidades" sortKey="units" sort={cliSort} onSort={cliToggleSort} align="right" />
                      <SortableHeader label="Total comprado" sortKey="revenue" sort={cliSort} onSort={cliToggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedClientes.map((c, i) => (
                      <tr key={c.name + i} className="hover:bg-gray-50/60">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                              {i + 1}
                            </span>
                            <span className="font-medium text-gray-900">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{c.units}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(c.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clientes.length === 0 && (
                  <p className="text-center py-10 text-sm text-gray-400">No hay datos todavía.</p>
                )}
              </div>
            </div>
          )}

          {/* ─── CANALES ─────────────────────────────────────────────── */}
          {tab === "canales" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Pie chart */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Distribución por canal</h2>
                  {mounted && canales.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={canales.map((c) => ({ name: CANAL_LABEL[c.canal] ?? c.canal, value: c.revenue }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {canales.map((c) => (
                            <Cell key={c.canal} fill={CANAL_COLORS[c.canal] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [fmt(v as number), "Ventas"]} contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                        <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center py-16 text-sm text-gray-400">No hay datos todavía.</p>
                  )}
                </div>

                {/* Canal table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                  <h2 className="font-semibold text-gray-900 mb-4">Detalle por canal</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">Canal</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">Pedidos</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">Unidades</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">Ventas</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-2">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {canales.map((c) => (
                        <tr key={c.canal}>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CANAL_COLORS[c.canal] ?? "#94a3b8" }} />
                              <span className="font-medium text-gray-900">{CANAL_LABEL[c.canal] ?? c.canal}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-right text-gray-600">{c.orders}</td>
                          <td className="py-2.5 text-right text-gray-600">{c.units}</td>
                          <td className="py-2.5 text-right font-semibold text-gray-900">{fmt(c.revenue)}</td>
                          <td className="py-2.5 text-right text-gray-500">
                            {totalCanalRevenue > 0 ? ((c.revenue / totalCanalRevenue) * 100).toFixed(1) : "0"}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {canales.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-gray-200">
                          <td className="py-2 font-bold text-gray-900">Total</td>
                          <td className="py-2 text-right font-bold text-gray-900">{canales.reduce((s, c) => s + c.orders, 0)}</td>
                          <td className="py-2 text-right font-bold text-gray-900">{canales.reduce((s, c) => s + c.units, 0)}</td>
                          <td className="py-2 text-right font-bold text-gray-900">{fmt(totalCanalRevenue)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                  {canales.length === 0 && (
                    <p className="text-center py-8 text-sm text-gray-400">No hay datos todavía.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── ESTACIONALIDAD ──────────────────────────────────────── */}
          {tab === "estacionalidad" && (
            <div className="space-y-6">
              {/* Line chart */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Ventas — últimos 12 meses</h2>
                {mounted ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={estacionalidad} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={55} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip
                        formatter={(value, name) =>
                          name === "revenue" ? [fmt(value as number), "Ventas"] : [`${value} uds.`, "Unidades"]
                        }
                        contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      />
                      <Legend formatter={(v) => <span style={{ fontSize: 12 }}>{v === "revenue" ? "Ventas ($)" : "Unidades"}</span>} />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#a9760a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="revenue" />
                      <Line yAxisId="right" type="monotone" dataKey="units" stroke="#E8475F" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} strokeDasharray="4 2" name="units" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : null}
              </div>

              {/* Monthly table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <SortableHeader label="Mes" sortKey="month" sort={estSort} onSort={estToggleSort} className="px-5" />
                      <SortableHeader label="Pedidos" sortKey="orders" sort={estSort} onSort={estToggleSort} align="right" />
                      <SortableHeader label="Unidades" sortKey="units" sort={estSort} onSort={estToggleSort} align="right" />
                      <SortableHeader label="Ventas" sortKey="revenue" sort={estSort} onSort={estToggleSort} align="right" />
                      <SortableHeader label="Ticket prom." sortKey="revenue" sort={estSort} onSort={estToggleSort} align="right" className="hidden sm:table-cell" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedEstacionalidad.map((m) => (
                      <tr key={m.month} className="hover:bg-gray-50/60">
                        <td className="px-5 py-2.5 font-medium text-gray-900">{m.month}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{m.orders}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{m.units}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmt(m.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                          {m.orders > 0 ? fmt(m.revenue / m.orders) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
