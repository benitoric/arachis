"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit2, ToggleLeft, ToggleRight, Loader2, Box, Image as ImageIcon, Trash2 } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ProductWithCount extends Product {
  _ingredientCount: number;
}

type SortKey = "name" | "presentation";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: productsSorted, sort, toggleSort } = useSortableData(products as any[]);
  const sortedProducts = productsSorted as ProductWithCount[];

  const fetchProducts = useCallback(async () => { // eslint-disable-line react-hooks/exhaustive-deps
    setLoading(true);

    let query = supabase.from("products").select("*").order(sortKey).order("name");
    if (statusFilter !== "all") {
      query = query.eq("active", statusFilter === "active");
    }

    const [{ data: prods }, { data: allRecipes }] = await Promise.all([
      query,
      supabase.from("recipes").select("product_id"),
    ]);

    const countMap = new Map<string, number>();
    (allRecipes ?? []).forEach((r) => {
      countMap.set(r.product_id, (countMap.get(r.product_id) ?? 0) + 1);
    });

    setProducts(
      (prods ?? []).map((p) => ({
        ...p,
        _ingredientCount: countMap.get(p.id) ?? 0,
      }))
    );
    setLoading(false);
  }, [statusFilter, sortKey]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function toggleStatus(id: string, currentActive: boolean) {
    await supabase.from("products").update({ active: !currentActive }).eq("id", id);
    fetchProducts();
  }

  async function togglePortal(id: string, currentValue: boolean) {
    await supabase.from("products").update({ show_in_portal: !currentValue }).eq("id", id);
    fetchProducts();
  }

  async function handleDelete(id: string, name: string) {
    const headOpts = { count: "exact" as const, head: true };
    const [
      { count: productionCount },
      { count: orderItemsCount },
      { count: quoteItemsCount },
      { count: inventoryCount },
      { count: stockAdjCount },
      { count: priceHistoryCount },
    ] = await Promise.all([
      supabase.from("production_logs").select("*", headOpts).eq("product_id", id),
      supabase.from("order_items").select("*", headOpts).eq("product_id", id),
      supabase.from("quote_items").select("*", headOpts).eq("product_id", id),
      supabase.from("inventory_count_items").select("*", headOpts).eq("product_id", id),
      supabase.from("stock_adjustments").select("*", headOpts).eq("product_id", id),
      supabase.from("price_list_history_items").select("*", headOpts).eq("product_id", id),
    ]);

    const blockers: string[] = [];
    if ((productionCount ?? 0) > 0) blockers.push("registros de producción");
    if ((orderItemsCount ?? 0) > 0) blockers.push("pedidos");
    if ((quoteItemsCount ?? 0) > 0) blockers.push("cotizaciones");
    if ((inventoryCount ?? 0) > 0) blockers.push("recuentos de inventario");
    if ((stockAdjCount ?? 0) > 0) blockers.push("ajustes de stock");
    if ((priceHistoryCount ?? 0) > 0) blockers.push("listas de precios históricas");

    if (blockers.length > 0) {
      alert(
        `No se puede eliminar "${name}" porque tiene ${blockers.join(", ")}. ` +
          `Para preservar el historial, desactivá el artículo en lugar de eliminarlo.`
      );
      return;
    }

    if (!confirm(`¿Eliminar el artículo "${name}"? Esta acción no se puede deshacer.`)) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      alert(`No se pudo eliminar el artículo: ${error.message}`);
      return;
    }
    fetchProducts();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Artículos y Recetas</h1>
          <p className="text-gray-500 mt-0.5">Productos terminados con sus ingredientes</p>
        </div>
        <Link
          href="/products/new"
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nuevo artículo
        </Link>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 shadow-sm flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
        >
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
        >
          <option value="name">Ordenar por sabor</option>
          <option value="presentation">Ordenar por gramaje</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gold" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4">
              <Box size={24} className="text-gold" />
            </div>
            <p className="text-gray-500 font-medium">No hay artículos</p>
            <p className="text-sm text-gray-400 mt-1">
              Creá el primer artículo con el botón de arriba
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortableHeader label="Sabor / Artículo" sortKey="name" sort={sort} onSort={toggleSort} className="px-3" />
                  <SortableHeader label="Gramaje" sortKey="presentation" sort={sort} onSort={toggleSort} className="hidden sm:table-cell px-2" />
                  <SortableHeader label="Estado" sortKey="active" sort={sort} onSort={toggleSort} className="px-2" />
                  <th className="hidden md:table-cell px-2 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Portal</th>
                  <SortableHeader label="Ingredientes" sortKey="_ingredientCount" sort={sort} onSort={toggleSort} className="hidden lg:table-cell px-2" />
                  <th className="px-2 py-3 w-28">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-3 py-3 max-w-0 sm:max-w-[260px]">
                      <div className="flex items-center gap-2 min-w-0">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <ImageIcon size={14} className="text-gray-300" />
                          </div>
                        )}
                        <Link
                          href={`/products/${product.id}`}
                          className="block font-medium text-gray-900 hover:text-chocolate transition-colors truncate min-w-0"
                        >
                          {product.name}
                        </Link>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-2 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {product.presentation > 0 ? `${product.presentation}g` : "—"}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          product.active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            product.active ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />
                        {product.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-2 py-3">
                      <button
                        onClick={() => togglePortal(product.id, product.show_in_portal)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          product.show_in_portal
                            ? "border-blue-500 bg-blue-500 text-white"
                            : "border-gray-300 bg-white"
                        }`}
                        title={product.show_in_portal ? "Quitar del portal" : "Mostrar en portal"}
                      >
                        {product.show_in_portal && (
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="hidden lg:table-cell px-2 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {product._ingredientCount > 0 ? (
                        <span>
                          {product._ingredientCount}{" "}
                          {product._ingredientCount === 1 ? "ingrediente" : "ingredientes"}
                        </span>
                      ) : (
                        <span className="text-gray-400">Sin receta</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/products/${product.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </Link>
                        <button
                          onClick={() => toggleStatus(product.id, product.active)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            product.active
                              ? "text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                              : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                          }`}
                          title={product.active ? "Desactivar" : "Activar"}
                        >
                          {product.active ? (
                            <ToggleRight size={15} />
                          ) : (
                            <ToggleLeft size={15} />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
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

            <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30">
              <p className="text-xs text-gray-400">
                {products.length} artículo{products.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
