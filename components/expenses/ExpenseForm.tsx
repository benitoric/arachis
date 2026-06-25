"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import AutocompleteField, { ACOption } from "@/components/ui/AutocompleteField";
import NewCategoryModal from "@/components/expenses/NewCategoryModal";

type ExpenseCategory = Database["public"]["Tables"]["expense_categories"]["Row"];

interface InitialData {
  id: string;
  date: string;
  category_id: string;
  description: string | null;
  amount: number;
}

interface Props {
  mode: "create" | "edit";
  initialData?: InitialData;
}

export default function ExpenseForm({ mode, initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(initialData?.date ?? today);
  const [categoryId, setCategoryId] = useState(initialData?.category_id ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [amount, setAmount] = useState(initialData?.amount?.toString() ?? "");
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);

  useEffect(() => {
    supabase.from("expense_categories").select("*").order("name").then(({ data }) => {
      setCategories(data ?? []);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryOptions: ACOption[] = categories.map((c) => ({
    id: c.id,
    label: c.name,
  }));

  function handleCategoryCreated(category: ExpenseCategory) {
    setCategories((prev) =>
      [...prev, category].sort((a, b) => a.name.localeCompare(b.name))
    );
    setCategoryId(category.id);
    setShowNewCategoryModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !categoryId || !amount) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 0) {
      setError("El monto debe ser un número positivo.");
      return;
    }
    setLoading(true);
    setError("");

    const payload = {
      date,
      category_id: categoryId,
      description: description.trim() || null,
      amount: amt,
    };

    if (mode === "create") {
      const { error: err } = await supabase.from("indirect_expenses").insert(payload);
      if (err) { setError(err.message); setLoading(false); return; }
    } else {
      const { error: err } = await supabase.from("indirect_expenses").update(payload).eq("id", initialData!.id);
      if (err) { setError(err.message); setLoading(false); return; }
    }

    router.push("/expenses");
    router.refresh();
  }

  return (
    <>
      {showNewCategoryModal && (
        <NewCategoryModal
          onClose={() => setShowNewCategoryModal(false)}
          onCreated={handleCategoryCreated}
        />
      )}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
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
                Rubro <span className="text-red-400">*</span>
              </label>
              <AutocompleteField
                options={categoryOptions}
                value={categoryId}
                onChange={setCategoryId}
                placeholder="Buscar rubro…"
                onCreateNew={() => setShowNewCategoryModal(true)}
                createNewLabel="rubro"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalle del gasto (opcional)"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Monto <span className="text-red-400">*</span>
            </label>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
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
            className="px-5 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-ink text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? "Guardando..." : mode === "create" ? "Registrar gasto" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </>
  );
}
