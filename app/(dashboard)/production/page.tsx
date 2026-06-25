"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit2, Trash2, Loader2, FlaskConical } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ProductionRow {
  id: string;
  date: string;
  product_id: string;
  quantity: number;
  batch_code: string | null;
  products: Product | null;
}

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function ProductionPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<ProductionRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productFilter, setProductFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: logsSorted, sort, toggleSort } = useSortableData(logs as any[]);
  const sortedLogs = logsSorted as ProductionRow[];

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("production_logs")
      .select("*, products(id, name, presentation)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);
    if (productFilter) query = query.eq("product_id", productFilter);

    const { data } = await query;
    setLogs((data ?? []) as unknown as ProductionRow[]);
    setLoading(false);
  }, [supabase, dateFrom, dateTo, productFilter]);

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).order("name").then(({ data }) =>
      setProducts(data ?? [])
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este registro de producción? Los insumos descontados se restaurarán automáticamente en el stock.")) return;
    await supabase.from("production_logs").delete().eq("id", id);
    fetchLogs();
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Producción</h1>
          <p className="text-gray-500 mt-0.5">Registro de lotes producidos</p>
        </div>
        <Link
          href="/production/bulk"
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Registrar producción
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Artículo</label>
            <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer">
              <option value="">Todos</option>
              {products.map((p) => <option key={p.id} value={p.id}>{pName(p)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gold" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4">
              <FlaskConical size={24} className="text-gold" />
            </div>
            <p className="text-gray-500 font-medium">No hay producción registrada</p>
            <p className="text-sm text-gray-400 mt-1">Registrá el primer lote con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortableHeader label="Fecha" sortKey="date" sort={sort} onSort={toggleSort} className="px-3" />
                  <SortableHeader label="Artículo" sortKey="product_id" sort={sort} onSort={toggleSort} className="px-2" />
                  <SortableHeader label="Cantidad" sortKey="quantity" sort={sort} onSort={toggleSort} align="right" className="hidden sm:table-cell px-2" />
                  <SortableHeader label="Lote" sortKey="batch_code" sort={sort} onSort={toggleSort} className="hidden md:table-cell px-2" />
                  <th className="px-2 py-3 w-16"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{fmtDate(log.date)}</td>
                    <td className="px-2 py-3 max-w-[180px]">
                      <p className="text-sm font-medium text-gray-900 truncate">{log.products ? pName(log.products) : "—"}</p>
                    </td>
                    <td className="px-2 py-3 text-sm text-right font-semibold text-gray-900 whitespace-nowrap hidden sm:table-cell">{log.quantity}</td>
                    <td className="px-2 py-3 hidden md:table-cell max-w-[140px]">
                      <p className="text-sm text-gray-500 truncate">{log.batch_code ?? <span className="text-gray-300">—</span>}</p>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/production/${log.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors" title="Editar">
                          <Edit2 size={14} />
                        </Link>
                        <button onClick={() => handleDelete(log.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
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
        {!loading && logs.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30">
            <p className="text-xs text-gray-400">{logs.length} registro{logs.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}
