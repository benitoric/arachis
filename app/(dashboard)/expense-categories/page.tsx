"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit2, Trash2, Check, X, Loader2, Tag } from "lucide-react";
import type { Database } from "@/lib/types/database";

type ExpenseCategory = Database["public"]["Tables"]["expense_categories"]["Row"];

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const supabase = createClient();

  async function fetchCategories() {
    const { data } = await supabase
      .from("expense_categories")
      .select("*")
      .order("name");
    setCategories(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetchCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    await supabase.from("expense_categories").insert({ name: newName.trim() });
    setNewName("");
    setAdding(false);
    fetchCategories();
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    await supabase
      .from("expense_categories")
      .update({ name: editName.trim() })
      .eq("id", id);
    setEditingId(null);
    fetchCategories();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el rubro "${name}"?`)) return;
    await supabase.from("expense_categories").delete().eq("id", id);
    fetchCategories();
  }

  function startEdit(cat: ExpenseCategory) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Rubros de Gastos</h1>
        <p className="text-gray-500 mt-0.5">Categorías para clasificar los gastos indirectos</p>
      </div>

      <div className="max-w-lg space-y-4">
        {/* Add new */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-chocolate/70 uppercase tracking-wider mb-3">
            Nuevo rubro
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Nombre del rubro..."
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="inline-flex items-center gap-2 bg-chocolate hover:bg-dark-red text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
            >
              <Plus size={16} />
              Agregar
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gold" />
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Tag size={32} className="text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">No hay rubros creados</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {categories.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                >
                  {editingId === cat.id ? (
                    <>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(cat.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEdit(cat.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Guardar"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Cancelar"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium text-gray-800">
                        {cat.name}
                      </span>
                      <button
                        onClick={() => startEdit(cat)}
                        className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!loading && categories.length > 0 && (
            <div className="px-5 py-2.5 border-t border-gray-50 bg-gray-50/30">
              <p className="text-xs text-gray-400">
                {categories.length} rubro{categories.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
