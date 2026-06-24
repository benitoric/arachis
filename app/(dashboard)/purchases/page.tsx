"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Edit2, Trash2, Loader2, ShoppingCart, Search, TrendingUp, Truck, Copy,
} from "lucide-react";
import type { Database } from "@/lib/types/database";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Material = Database["public"]["Tables"]["materials"]["Row"];

interface PurchaseRow {
  id: string;
  date: string;
  delivery_date: string | null;
  supplier: string | null;
  brand: string | null;
  material_id: string;
  quantity: number;
  total_cost: number;
  unit_cost: number | null;
  shipping_cost_share: number;
  material: Material | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function PurchasesContent() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState(
    searchParams.get("material") ?? ""
  );

  const [materialStats, setMaterialStats] = useState<{
    name: string;
    unit: string;
    avgUnitCost: number;
    lastUnitCost: number;
    totalPurchased: number;
    purchaseCount: number;
  } | null>(null);

  useEffect(() => {
    const matParam = searchParams.get("material");
    if (matParam) setMaterialFilter(matParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("purchases")
      .select("*, material:materials(id, name, unit)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);
    if (supplierFilter.trim())
      query = query.ilike("supplier", `%${supplierFilter.trim()}%`);
    if (materialFilter) query = query.eq("material_id", materialFilter);

    const { data } = await query;
    const rows = (data ?? []) as unknown as PurchaseRow[];
    setPurchases(rows);

    if (materialFilter && rows.length > 0) {
      const mat = rows[0].material;
      const withCost = rows.filter((r) => r.unit_cost != null);
      const avgUnitCost =
        withCost.length > 0
          ? withCost.reduce((s, r) => s + (r.unit_cost ?? 0), 0) / withCost.length
          : 0;
      const lastUnitCost = withCost[0]?.unit_cost ?? 0;
      const totalPurchased = rows.reduce((s, r) => s + r.quantity, 0);
      setMaterialStats({
        name: mat?.name ?? "—",
        unit: mat?.unit ?? "",
        avgUnitCost,
        lastUnitCost,
        totalPurchased,
        purchaseCount: rows.length,
      });
    } else {
      setMaterialStats(null);
    }

    setLoading(false);
  }, [supabase, dateFrom, dateTo, supplierFilter, materialFilter]);

  useEffect(() => {
    supabase
      .from("materials")
      .select("*")
      .order("name")
      .then(({ data }) => setMaterials(data ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchPurchases, 300);
    return () => clearTimeout(t);
  }, [fetchPurchases]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta compra?")) return;
    await supabase.from("purchases").delete().eq("id", id);
    fetchPurchases();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: purchasesSorted, sort, toggleSort } = useSortableData(purchases as any[]);
  const sortedPurchases = purchasesSorted as PurchaseRow[];

  // ── Group consecutive rows by (date, supplier) ─────────────────
  const grouped = useMemo(() => {
    return sortedPurchases.map((p, idx) => {
      const prev = sortedPurchases[idx - 1];
      const next = sortedPurchases[idx + 1];
      const isGroupStart =
        !prev ||
        prev.date !== p.date ||
        (prev.supplier ?? "") !== (p.supplier ?? "");
      const isGroupEnd =
        !next ||
        next.date !== p.date ||
        (next.supplier ?? "") !== (p.supplier ?? "");
      return { ...p, isGroupStart, isGroupEnd };
    });
  }, [sortedPurchases]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-500 mt-0.5">Registro de compras de insumos</p>
        </div>
        <Link
          href="/purchases/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white transition-colors shadow-sm"
          style={{ backgroundColor: "#49789d" }}
        >
          <Plus size={16} />
          Nueva compra
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Proveedor</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Insumo</label>
            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white cursor-pointer"
            >
              <option value="">Todos</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Material stats panel */}
      {materialStats && !loading && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} style={{ color: "#49789d" }} />
            <h3 className="text-sm font-semibold text-gray-900">
              Estadísticas: {materialStats.name}
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Último precio unitario</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">
                {materialStats.lastUnitCost > 0 ? fmt(materialStats.lastUnitCost) : "—"}
                {materialStats.unit && (
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    /{materialStats.unit}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Precio promedio unitario</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">
                {materialStats.avgUnitCost > 0 ? fmt(materialStats.avgUnitCost) : "—"}
                {materialStats.unit && (
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    /{materialStats.unit}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total comprado</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">
                {materialStats.totalPurchased % 1 === 0
                  ? materialStats.totalPurchased
                  : materialStats.totalPurchased.toFixed(2)}{" "}
                <span className="text-xs text-gray-400 font-normal">
                  {materialStats.unit}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Compras registradas</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">
                {materialStats.purchaseCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart size={28} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No hay compras registradas</p>
            <p className="text-sm text-gray-400 mt-1">
              {materialFilter
                ? "No se encontraron compras para este insumo."
                : "Registrá la primera compra con el botón de arriba."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortableHeader label="Fecha" sortKey="date" sort={sort} onSort={toggleSort} className="px-3" />
                  <SortableHeader label="Proveedor" sortKey="supplier" sort={sort} onSort={toggleSort} className="hidden sm:table-cell px-2" />
                  <SortableHeader label="Insumo" sortKey="material_id" sort={sort} onSort={toggleSort} className="px-2" />
                  <SortableHeader label="Marca" sortKey="brand" sort={sort} onSort={toggleSort} className="hidden md:table-cell px-2" />
                  <SortableHeader label="Cantidad" sortKey="quantity" sort={sort} onSort={toggleSort} align="right" className="hidden md:table-cell px-2" />
                  <SortableHeader label="Costo total" sortKey="total_cost" sort={sort} onSort={toggleSort} align="right" className="hidden sm:table-cell px-2" />
                  <SortableHeader label="Entrega" sortKey="delivery_date" sort={sort} onSort={toggleSort} align="center" className="hidden sm:table-cell px-2" />
                  <SortableHeader label="Costo unit." sortKey="unit_cost" sort={sort} onSort={toggleSort} align="right" className="hidden lg:table-cell px-2" />
                  <th className="px-2 py-3 w-16">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((p, idx) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50/50 transition-colors ${
                      p.isGroupStart && idx > 0 ? "border-t-2 border-gray-100" : "border-t border-gray-50"
                    } ${!p.isGroupStart ? "bg-blue-50/20" : ""}`}
                  >
                    {/* Date: show only on group start */}
                    <td className="px-3 py-3 text-sm whitespace-nowrap">
                      {p.isGroupStart ? (
                        <span className="text-gray-700">{fmtDate(p.date)}</span>
                      ) : (
                        <span className="text-gray-300 pl-2 text-base leading-none select-none">└</span>
                      )}
                    </td>
                    {/* Supplier: show only on group start */}
                    <td className="px-2 py-3 hidden sm:table-cell max-w-[140px]">
                      <p className="text-sm text-gray-600 truncate">
                        {p.isGroupStart ? (p.supplier ?? <span className="text-gray-300">—</span>) : ""}
                      </p>
                    </td>
                    {/* Material */}
                    <td className="px-2 py-3 max-w-[160px]">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {p.material?.name ?? "—"}
                      </p>
                    </td>
                    {/* Brand */}
                    <td className="px-2 py-3 hidden md:table-cell max-w-[120px]">
                      <p className="text-sm text-gray-500 truncate">
                        {p.brand ?? <span className="text-gray-300">—</span>}
                      </p>
                    </td>
                    {/* Quantity */}
                    <td className="px-2 py-3 text-sm text-right text-gray-700 hidden md:table-cell whitespace-nowrap">
                      {p.quantity} {p.material?.unit ?? ""}
                    </td>
                    {/* Total cost */}
                    <td className="px-2 py-3 text-sm text-right font-semibold text-gray-900 whitespace-nowrap hidden sm:table-cell">
                      <span>{fmt(p.total_cost)}</span>
                      {p.shipping_cost_share > 0 && (
                        <span
                          className="inline-block ml-1.5 -mt-0.5"
                          title={`Incluye ${fmt(p.shipping_cost_share)} de envío`}
                        >
                          <Truck size={11} className="text-blue-400" />
                        </span>
                      )}
                    </td>
                    {/* Delivery date */}
                    <td className="px-2 py-3 text-sm text-center hidden sm:table-cell whitespace-nowrap">
                      {p.delivery_date ? (
                        <span className="text-gray-600">{fmtDate(p.delivery_date)}</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Pendiente
                        </span>
                      )}
                    </td>
                    {/* Unit cost */}
                    <td className="px-2 py-3 text-sm text-right text-gray-500 hidden lg:table-cell whitespace-nowrap">
                      {p.unit_cost != null
                        ? `${fmt(p.unit_cost)}/${p.material?.unit ?? "u"}`
                        : "—"}
                    </td>
                    {/* Actions */}
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/purchases/new?duplicate=${p.id}`}
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Duplicar"
                        >
                          <Copy size={14} />
                        </Link>
                        <Link
                          href={`/purchases/${p.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && purchases.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 flex items-center gap-4">
            <p className="text-xs text-gray-400">
              {purchases.length} ítem{purchases.length !== 1 ? "s" : ""}
            </p>
            {purchases.some((p) => p.shipping_cost_share > 0) && (
              <p className="text-xs text-blue-500 flex items-center gap-1">
                <Truck size={11} />
                Con envío imputado
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      }
    >
      <PurchasesContent />
    </Suspense>
  );
}
