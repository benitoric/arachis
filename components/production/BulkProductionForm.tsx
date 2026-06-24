"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Info, Plus, Trash2 } from "lucide-react";
import type { Database } from "@/lib/types/database";
import AutocompleteField, { ACOption } from "@/components/ui/AutocompleteField";
import NewProductModal from "@/components/products/NewProductModal";
import { pName } from "@/lib/utils/product";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface Row {
  key: number;
  productId: string;
  quantity: string;
  batchCode: string;
}

let rowSeq = 0;
function newRow(): Row {
  return { key: rowSeq++, productId: "", quantity: "", batchCode: "" };
}

export default function BulkProductionForm() {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newProductForKey, setNewProductForKey] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const productOptions: ACOption[] = useMemo(
    () => products.map((p) => ({ id: p.id, label: pName(p) })),
    [products]
  );

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(key: number) {
    setRows((prev) =>
      prev.length === 1 ? [newRow()] : prev.filter((r) => r.key !== key)
    );
  }

  function handleProductCreated(product: Product) {
    setProducts((prev) =>
      [...prev, product].sort((a, b) => a.name.localeCompare(b.name))
    );
    if (newProductForKey !== null) {
      updateRow(newProductForKey, { productId: product.id });
    }
    setNewProductForKey(null);
  }

  const filledCount = useMemo(
    () =>
      rows.filter((r) => {
        const q = parseFloat(r.quantity);
        return r.productId && !isNaN(q) && q > 0;
      }).length,
    [rows]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!date) {
      setError("Seleccioná una fecha.");
      return;
    }

    const payload: {
      date: string;
      product_id: string;
      quantity: number;
      batch_code: string | null;
    }[] = [];

    for (const r of rows) {
      if (!r.productId && !r.quantity.trim()) continue; // fila vacía, se ignora
      if (!r.productId) {
        setError("Elegí el artículo en todas las filas cargadas.");
        return;
      }
      const qty = parseFloat(r.quantity);
      if (isNaN(qty) || qty <= 0) {
        setError("La cantidad debe ser mayor a 0 en todas las filas cargadas.");
        return;
      }
      payload.push({
        date,
        product_id: r.productId,
        quantity: qty,
        batch_code: r.batchCode.trim() || null,
      });
    }

    if (payload.length === 0) {
      setError("Agregá al menos una variedad con su cantidad.");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase
      .from("production_logs")
      .insert(payload);
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    router.push("/production");
    router.refresh();
  }

  return (
    <>
      {newProductForKey !== null && (
        <NewProductModal
          onClose={() => setNewProductForKey(null)}
          onCreated={handleProductCreated}
        />
      )}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
          {/* Info notice */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Cargá todas las variedades producidas en un mismo día: elegí la
              fecha y agregá una fila por cada artículo. Los insumos se
              descontarán automáticamente del stock según la receta de cada uno.
            </p>
          </div>

          <div className="max-w-xs">
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

          {/* Rows header (desktop) */}
          <div className="hidden sm:grid grid-cols-[1fr_8rem_11rem_2.5rem] gap-3 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Artículo</span>
            <span>Cantidad</span>
            <span>Código de lote</span>
            <span className="sr-only">Quitar</span>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_11rem_2.5rem] gap-3 items-start"
              >
                <div>
                  <span className="sm:hidden block text-xs font-medium text-gray-500 mb-1">
                    Artículo
                  </span>
                  <AutocompleteField
                    options={productOptions}
                    value={row.productId}
                    onChange={(id) => updateRow(row.key, { productId: id })}
                    placeholder="Buscar artículo…"
                    onCreateNew={() => setNewProductForKey(row.key)}
                    createNewLabel="artículo"
                  />
                </div>
                <div>
                  <span className="sm:hidden block text-xs font-medium text-gray-500 mb-1">
                    Cantidad
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(row.key, { quantity: e.target.value })
                    }
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <span className="sm:hidden block text-xs font-medium text-gray-500 mb-1">
                    Código de lote
                  </span>
                  <input
                    type="text"
                    value={row.batchCode}
                    onChange={(e) =>
                      updateRow(row.key, { batchCode: e.target.value })
                    }
                    placeholder="Opcional"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(row.key)}
                  title="Quitar fila"
                  className="h-[2.6rem] sm:h-auto sm:self-stretch flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-chocolate hover:text-dark-red transition-colors"
          >
            <Plus size={16} />
            Agregar variedad
          </button>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5">
          <p className="text-sm text-gray-500">
            {filledCount > 0
              ? `${filledCount} variedad${filledCount !== 1 ? "es" : ""} lista${filledCount !== 1 ? "s" : ""} para registrar`
              : "Sin variedades cargadas todavía"}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/production")}
              className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || filledCount === 0}
              className="px-5 py-2.5 rounded-lg bg-chocolate hover:bg-dark-red text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "Guardando..." : "Registrar producción"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
