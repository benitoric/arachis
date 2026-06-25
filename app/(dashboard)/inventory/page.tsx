"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Loader2, Warehouse, CheckCircle, Clock } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type InventoryCount = Database["public"]["Tables"]["inventory_counts"]["Row"];

interface CountWithMeta extends InventoryCount {
  item_count: number;
}

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function InventoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [counts, setCounts] = useState<CountWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: countsSorted, sort, toggleSort } = useSortableData(counts as any[]);
  const sortedCounts = countsSorted as CountWithMeta[];

  const loadCounts = useCallback(async () => {
    setLoading(true);
    const [{ data: rawCounts }, { data: items }] = await Promise.all([
      supabase.from("inventory_counts").select("*").order("count_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("inventory_count_items").select("count_id"),
    ]);

    const itemCountMap: Record<string, number> = {};
    (items ?? []).forEach((it) => {
      itemCountMap[it.count_id] = (itemCountMap[it.count_id] ?? 0) + 1;
    });

    setCounts(
      (rawCounts ?? []).map((c) => ({
        ...c,
        item_count: itemCountMap[c.id] ?? 0,
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-0.5">Tomas de inventario físico</p>
        </div>
        <button
          onClick={() => router.push("/inventory/new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#a9760a" }}
        >
          <Plus size={15} /> Nueva toma de inventario
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : counts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Warehouse size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No hay tomas de inventario registradas</p>
            <button
              onClick={() => router.push("/inventory/new")}
              className="mt-3 text-sm font-medium hover:underline"
              style={{ color: "#a9760a" }}
            >
              Crear la primera
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <SortableHeader label="Fecha" sortKey="count_date" sort={sort} onSort={toggleSort} className="px-6" />
                <SortableHeader label="Tipo" sortKey="type" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Estado" sortKey="finalized_at" sort={sort} onSort={toggleSort} align="center" />
                <SortableHeader label="Ítems" sortKey="item_count" sort={sort} onSort={toggleSort} align="right" className="hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedCounts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/inventory/${c.id}`)}
                  className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-3.5 font-medium text-gray-900">{fmtDate(c.count_date)}</td>
                  <td className="px-4 py-3.5 text-sm text-gray-600">
                    {c.type === "materials" ? "Insumos" : "Productos terminados"}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {c.finalized_at ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle size={11} /> Finalizado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Clock size={11} /> En curso
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm text-gray-500 hidden sm:table-cell">
                    {c.item_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
