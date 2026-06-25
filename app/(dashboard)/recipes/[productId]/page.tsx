"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, Plus, Trash2, Loader2, AlertCircle } from "lucide-react";
import type { Database } from "@/lib/types/database";
import NewMaterialModal from "@/components/materials/NewMaterialModal";

type Material = Database["public"]["Tables"]["materials"]["Row"];

interface RecipeItem {
  id: string;
  product_id: string;
  material_id: string;
  quantity: number;
  material: Material;
}

const UNIT_LABELS: Record<string, string> = {
  gramos: "g",
  kg: "kg",
  litro: "litro",
  ml: "ml",
  unidad: "unidades",
  cm: "cm",
};

export default function RecipeDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const supabase = createClient();

  const [productName, setProductName] = useState("");
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Add form
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [showNewMaterial, setShowNewMaterial] = useState(false);

  const loadRecipe = useCallback(async () => {
    // Fetch product
    const { data: product } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .single();

    if (!product) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setProductName(product.name);

    // Fetch recipe items with material details
    const { data: items } = await supabase
      .from("recipes")
      .select("*, material:materials(*)")
      .eq("product_id", productId);

    const typedItems = (items ?? []) as unknown as RecipeItem[];
    setRecipeItems(typedItems);

    // Fetch all materials and filter out those already in recipe
    const { data: allMaterials } = await supabase
      .from("materials")
      .select("*")
      .order("name");

    const usedIds = new Set(typedItems.map((i) => i.material_id));
    setAvailableMaterials((allMaterials ?? []).filter((m) => !usedIds.has(m.id)));

    setLoading(false);
  }, [supabase, productId]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  async function handleAdd() {
    if (!selectedMaterial) {
      setAddError("Seleccioná un insumo.");
      return;
    }
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setAddError("Ingresá una cantidad válida mayor a 0.");
      return;
    }
    setAdding(true);
    setAddError("");

    const { error } = await supabase.from("recipes").insert({
      product_id: productId,
      material_id: selectedMaterial,
      quantity: qty,
    });

    if (error) {
      setAddError(error.message);
      setAdding(false);
      return;
    }

    setSelectedMaterial("");
    setQuantity("");
    setAdding(false);
    loadRecipe();
  }

  async function handleRemove(id: string) {
    await supabase.from("recipes").delete().eq("id", id);
    loadRecipe();
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Artículo no encontrado</p>
        <Link href="/products" className="text-sm text-chocolate hover:underline mt-2">
          Volver a artículos
        </Link>
      </div>
    );
  }

  return (
    <div>
      {showNewMaterial && (
        <NewMaterialModal
          onClose={() => setShowNewMaterial(false)}
          onCreated={(mat) => {
            setAvailableMaterials((prev) => [...prev, mat].sort((a, b) => a.name.localeCompare(b.name)));
            setSelectedMaterial(mat.id);
            setShowNewMaterial(false);
          }}
        />
      )}
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a artículos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {loading ? "Cargando..." : productName}
        </h1>
        <p className="text-gray-500 mt-0.5">Ingredientes de la receta</p>
      </div>

      <div className="max-w-2xl space-y-5">
        {/* Ingredient list */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-semibold text-chocolate/70 uppercase tracking-wider">
              Ingredientes
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-gold" />
            </div>
          ) : recipeItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-gray-400">
                Esta receta no tiene ingredientes. Agregá uno abajo.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-2.5">
                    Insumo
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-2.5">
                    Cantidad
                  </th>
                  <th className="px-4 py-2.5 w-16">
                    <span className="sr-only">Quitar</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recipeItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900">
                      {item.material.name}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600">
                      {item.quantity} {UNIT_LABELS[item.material.unit] ?? item.material.unit}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Quitar ingrediente"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add ingredient form */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-xs font-semibold text-chocolate/70 uppercase tracking-wider mb-4">
            Agregar ingrediente
          </h2>

          {availableMaterials.length === 0 && !loading ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-400">Todos los insumos ya están en la receta.</p>
              <button
                type="button"
                onClick={() => setShowNewMaterial(true)}
                className="text-sm text-chocolate hover:underline font-medium"
              >
                Crear insumo nuevo
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
              >
                <option value="">Seleccioná un insumo...</option>
                {availableMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({UNIT_LABELS[m.unit] ?? m.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Cantidad"
                min="0"
                step="0.001"
                className="w-full sm:w-32 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              />
              <button
                onClick={handleAdd}
                disabled={adding}
                className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
              >
                <Plus size={15} />
                Agregar
              </button>
              <button
                type="button"
                onClick={() => setShowNewMaterial(true)}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-chocolate transition-colors px-3 py-2.5 border border-gray-200 rounded-lg hover:border-gray-300"
                title="Crear nuevo insumo"
              >
                <Plus size={13} /> Insumo
              </button>
            </div>
          )}

          {addError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
              {addError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
