"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Loader2, ShoppingBag, Search, Globe, User, Zap } from "lucide-react";
import { fmtPayment, fmtDelivery, ORIGIN_LABEL } from "@/lib/utils/order-labels";
import type { Database } from "@/lib/types/database";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type StatusType = Order["status"];

const STATUS_LABEL: Record<StatusType, string> = {
  pendiente:  "Pendiente",
  confirmado: "Confirmado",
  cumplido:   "Cumplido",
  anulado:    "Anulado",
};

const STATUS_STYLE: Record<StatusType, string> = {
  pendiente:  "bg-amber-100 text-amber-700",
  confirmado: "bg-blue-100 text-blue-700",
  cumplido:   "bg-teal-100 text-teal-700",
  anulado:    "bg-red-100 text-red-600",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

interface OrderWithTotal extends Order {
  total: number;
  client_display: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const supabase = createClient();

  const [orders, setOrders] = useState<OrderWithTotal[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusType | "">("");
  const [originFilter, setOriginFilter] = useState<Order["origin"] | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);

    const [{ data: rawOrders }, { data: clients }, { data: orderItems }] = await Promise.all([
      supabase.from("orders").select("*").order("order_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, last_name, first_name"),
      supabase.from("order_items").select("order_id, quantity, unit_price"),
    ]);

    const clientMap: Record<string, string> = {};
    (clients ?? []).forEach((c) => { clientMap[c.id] = c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name; });

    const totalsMap: Record<string, number> = {};
    (orderItems ?? []).forEach((oi) => {
      totalsMap[oi.order_id] = (totalsMap[oi.order_id] ?? 0) + oi.quantity * oi.unit_price;
    });

    const enriched: OrderWithTotal[] = (rawOrders ?? []).map((o) => ({
      ...o,
      total: totalsMap[o.id] ?? 0,
      client_display:
        o.client_id && clientMap[o.client_id]
          ? clientMap[o.client_id]
          : o.guest_name ?? "—",
    }));

    setOrders(enriched);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  const filteredRaw = orders.filter((o) => {
    if (search && !o.client_display.toLowerCase().includes(search.toLowerCase()) && !String(o.order_number).includes(search)) return false;
    if (statusFilter && o.status !== statusFilter) return false;
    if (originFilter && o.origin !== originFilter) return false;
    if (dateFrom && o.order_date < dateFrom) return false;
    if (dateTo && o.order_date > dateTo) return false;
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: filteredSorted, sort, toggleSort } = useSortableData(filteredRaw as any[]);
  const filtered = filteredSorted as OrderWithTotal[];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 mt-0.5">Gestión de pedidos internos y del portal</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/orders/quick")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#d97706" }}
          >
            <Zap size={15} /> Venta rápida
          </button>
          <button
            onClick={() => router.push("/orders/new")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#a9760a" }}
          >
            <Plus size={15} /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cliente o N°…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusType | "")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(STATUS_LABEL) as StatusType[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value as Order["origin"] | "")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Todos los orígenes</option>
          {Object.entries(ORIGIN_LABEL).map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Desde"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingBag size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">
              {orders.length === 0 ? "No hay pedidos aún" : "Sin resultados"}
            </p>
            {orders.length === 0 && (
              <button
                onClick={() => router.push("/orders/new")}
                className="mt-3 text-sm font-medium hover:underline"
                style={{ color: "#a9760a" }}
              >
                Crear el primero
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortableHeader label="N°" sortKey="order_number" sort={sort} onSort={toggleSort} className="px-3" />
                  <SortableHeader label="Cliente" sortKey="client_display" sort={sort} onSort={toggleSort} className="px-2" />
                  <SortableHeader label="Pedido" sortKey="order_date" sort={sort} onSort={toggleSort} className="hidden sm:table-cell px-2" />
                  <SortableHeader label="Entrega" sortKey="desired_date" sort={sort} onSort={toggleSort} className="hidden md:table-cell px-2" />
                  <SortableHeader label="Entregado" sortKey="delivered_date" sort={sort} onSort={toggleSort} className="hidden xl:table-cell px-2" />
                  <SortableHeader label="Pago" sortKey="payment_method" sort={sort} onSort={toggleSort} className="hidden lg:table-cell px-2" />
                  <SortableHeader label="Modalidad" sortKey="delivery_method" sort={sort} onSort={toggleSort} className="hidden lg:table-cell px-2" />
                  <SortableHeader label="" sortKey="origin" sort={sort} onSort={toggleSort} align="center" className="hidden sm:table-cell px-1 w-8" />
                  <SortableHeader label="Total" sortKey="total" sort={sort} onSort={toggleSort} align="right" className="px-2" />
                  <SortableHeader label="Estado" sortKey="status" sort={sort} onSort={toggleSort} align="center" className="px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/orders/${o.id}`)}
                    className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 font-mono text-sm font-medium text-gray-700 whitespace-nowrap">
                      #{String(o.order_number ?? "—").padStart(4, "0")}
                    </td>
                    <td className="px-2 py-3 font-medium text-gray-900 max-w-[140px] truncate">
                      {o.client_display}
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-500 hidden sm:table-cell whitespace-nowrap">
                      {fmtDate(o.order_date)}
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-500 hidden md:table-cell whitespace-nowrap">
                      {o.desired_date ? fmtDate(o.desired_date) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-3 text-sm hidden xl:table-cell whitespace-nowrap">
                      {o.delivered_date
                        ? <span className="text-teal-600 font-medium">{fmtDate(o.delivered_date)}</span>
                        : <span className="text-xs text-gray-300">Pendiente</span>}
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-500 hidden lg:table-cell whitespace-nowrap">
                      {o.payment_method ? fmtPayment(o.payment_method) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-3 text-sm text-gray-500 hidden lg:table-cell whitespace-nowrap">
                      {o.delivery_method ? fmtDelivery(o.delivery_method) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-1 py-3 text-center hidden sm:table-cell w-8">
                      {o.origin === "portal" ? (
                        <span title="Portal"><Globe size={14} className="inline text-blue-400" /></span>
                      ) : o.origin === "venta_rapida" ? (
                        <span title="Venta rápida"><Zap size={14} className="inline text-amber-500" /></span>
                      ) : (
                        <span title="Manual"><User size={14} className="inline text-gray-400" /></span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {fmt(o.total)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_STYLE[o.status]}`}>
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between text-xs text-gray-400">
              <span>{filtered.length} pedido{filtered.length !== 1 ? "s" : ""}</span>
              <span className="font-medium text-gray-600">
                Total: {fmt(filtered.reduce((acc, o) => acc + o.total, 0))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
