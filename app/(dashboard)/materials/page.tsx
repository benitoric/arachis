"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit2, Trash2, Loader2, Package, ShoppingCart } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Material = Database["public"]["Tables"]["materials"]["Row"];

const UNIT_LABELS: Record<string, string> = {
  gramos: "gramos",
  kg: "kg",
  litro: "litro",
  ml: "ml",
  unidad: "unidades",
  cm: "cm",
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: materialsSorted, sort, toggleSort } = useSortableData(materials as any[]);
  const sortedMaterials = materialsSorted as Material[];

  const fetchMaterials = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("materials")
      .select("*")
      .order("name");
    setMaterials(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el insumo "${name}"? Esta acción no se puede deshacer.`)) return;
    await supabase.from("materials").delete().eq("id", id);
    fetchMaterials();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insumos</h1>
          <p className="text-gray-500 mt-0.5">Maestro de materias primas</p>
        </div>
        <Link
          href="/materials/new"
          className="inline-flex items-center gap-2 bg-chocolate hover:bg-dark-red text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nuevo insumo
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gold" />
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4">
              <Package size={24} className="text-gold" />
            </div>
            <p className="text-gray-500 font-medium">No hay insumos registrados</p>
            <p className="text-sm text-gray-400 mt-1">
              Creá el primer insumo con el botón de arriba
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortableHeader label="Nombre" sortKey="name" sort={sort} onSort={toggleSort} className="px-6" />
                  <SortableHeader label="Unidad" sortKey="unit" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Stock crítico" sortKey="critical_stock" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                  <th className="px-4 py-3 w-24">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedMaterials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{material.name}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {UNIT_LABELS[material.unit] ?? material.unit}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 hidden sm:table-cell">
                      {material.critical_stock != null
                        ? `${material.critical_stock} ${UNIT_LABELS[material.unit] ?? material.unit}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => router.push(`/purchases?material=${material.id}`)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver historial de compras"
                        >
                          <ShoppingCart size={15} />
                        </button>
                        <Link
                          href={`/materials/${material.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </Link>
                        <button
                          onClick={() => handleDelete(material.id, material.name)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && materials.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/30">
            <p className="text-xs text-gray-400">
              {materials.length} insumo{materials.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
