"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const UNIT_OPTIONS = [
  { value: "gramos", label: "gramos" },
  { value: "kg",     label: "kg" },
  { value: "litro",  label: "litro" },
  { value: "ml",     label: "ml" },
  { value: "unidad", label: "unidades" },
  { value: "cm",     label: "cm" },
];

interface Props {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    name: string;
    unit: string;
    critical_stock: number | null;
  };
}

export default function MaterialForm({ mode, initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialData?.name ?? "");
  const [unit, setUnit] = useState(initialData?.unit ?? "kg");
  const [criticalStock, setCriticalStock] = useState(
    initialData?.critical_stock?.toString() ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es requerido.");
      return;
    }
    setLoading(true);
    setError("");

    const payload = {
      name: name.trim(),
      unit,
      critical_stock: criticalStock ? parseFloat(criticalStock) : null,
    };

    if (mode === "create") {
      const { error: err } = await supabase.from("materials").insert(payload);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase
        .from("materials")
        .update(payload)
        .eq("id", initialData!.id);
      if (err) { setError(err.message); setLoading(false); return; }
    }

    router.push("/materials");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Harina 000"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Unidad de medida
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
            >
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Stock crítico
            </label>
            <input
              type="number"
              value={criticalStock}
              onChange={(e) => setCriticalStock(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
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
          {loading ? "Guardando..." : mode === "create" ? "Crear insumo" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
