"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Info } from "lucide-react";
import type { Database } from "@/lib/types/database";
import AutocompleteField, { ACOption } from "@/components/ui/AutocompleteField";
import NewProductModal from "@/components/products/NewProductModal";
import { pName } from "@/lib/utils/product";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface InitialData {
  id: string;
  date: string;
  product_id: string;
  quantity: number;
  batch_code: string | null;
}

interface Props {
  mode: "create" | "edit";
  initialData?: InitialData;
}

export default function ProductionForm({ mode, initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(initialData?.date ?? today);
  const [productId, setProductId] = useState(initialData?.product_id ?? "");
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() ?? "");
  const [batchCode, setBatchCode] = useState(initialData?.batch_code ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  useEffect(() => {
    supabase.from("products").select("*").eq("active", true).order("name").then(({ data }) => {
      setProducts(data ?? []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productOptions: ACOption[] = products.map((p) => ({
    id: p.id,
    label: pName(p),
  }));

  function handleProductCreated(product: Product) {
    setProducts((prev) =>
      [...prev, product].sort((a, b) => a.name.localeCompare(b.name))
    );
    setProductId(product.id);
    setShowNewProductModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !productId || !quantity) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }
    setLoading(true);
    setError("");

    const payload = {
      date,
      product_id: productId,
      quantity: qty,
      batch_code: batchCode.trim() || null,
    };

    if (mode === "create") {
      const { error: err } = await supabase.from("production_logs").insert(payload);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("production_logs").update(payload).eq("id", initialData!.id);
      if (err) { setError(err.message); setLoading(false); return; }
    }

    router.push("/production");
    router.refresh();
  }

  return (
    <>
      {showNewProductModal && (
        <NewProductModal
          onClose={() => setShowNewProductModal(false)}
          onCreated={handleProductCreated}
        />
      )}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
          {/* Info notice */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Al registrar producción, los insumos se descontarán automáticamente del stock
              según la receta del artículo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Fecha <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Artículo <span className="text-red-400">*</span>
              </label>
              <AutocompleteField
                options={productOptions}
                value={productId}
                onChange={setProductId}
                placeholder="Buscar artículo…"
                onCreateNew={() => setShowNewProductModal(true)}
                createNewLabel="artículo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cantidad producida <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                min="0.001"
                step="0.001"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Código de lote
              </label>
              <input
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="Ej: LOTE-001 (opcional)"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-chocolate hover:bg-dark-red text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading
              ? "Guardando..."
              : mode === "create"
              ? "Registrar producción"
              : "Guardar cambios"}
          </button>
        </div>
      </form>
    </>
  );
}
