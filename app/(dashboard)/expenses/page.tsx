"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit2, Trash2, Check, X, Loader2, Receipt, Tag, Copy } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type ExpenseCategory = Database["public"]["Tables"]["expense_categories"]["Row"];

interface ExpenseRow {
  id: string;
  date: string;
  category_id: string;
  description: string | null;
  amount: number;
  expense_categories: ExpenseCategory | null;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

type Tab = "gastos" | "rubros";

// ─── Rubros tab ────────────────────────────────────────────────────────────────
function RubrosTab() {
  const supabase = createClient();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function fetchCategories() {
    const { data } = await supabase.from("expense_categories").select("*").order("name");
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
    await supabase.from("expense_categories").update({ name: editName.trim() }).eq("id", id);
    setEditingId(null);
    fetchCategories();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar el rubro "${name}"?`)) return;
    await supabase.from("expense_categories").delete().eq("id", id);
    fetchCategories();
  }

  return (
    <div className="max-w-lg space-y-4">
      {/* Add new */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <p className="text-xs font-semibold text-chocolate/70 uppercase tracking-wider mb-3">Nuevo rubro</p>
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
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-4 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 shadow-sm"
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
              <li key={cat.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
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
                    <button onClick={() => handleSaveEdit(cat.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Guardar">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Cancelar">
                      <X size={15} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-gray-800">{cat.name}</span>
                    <button onClick={() => { setEditingId(cat.id); setEditName(cat.name); }} className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors" title="Editar">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
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
            <p className="text-xs text-gray-400">{categories.length} rubro{categories.length !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("gastos");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: expensesSorted, sort, toggleSort } = useSortableData(expenses as any[]);
  const sortedExpenses = expensesSorted as ExpenseRow[];

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("indirect_expenses")
      .select("*, expense_categories(id, name)")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);
    if (categoryFilter) query = query.eq("category_id", categoryFilter);

    const { data } = await query;
    setExpenses((data ?? []) as unknown as ExpenseRow[]);
    setLoading(false);
  }, [supabase, dateFrom, dateTo, categoryFilter]);

  useEffect(() => {
    supabase.from("expense_categories").select("*").order("name").then(({ data }) =>
      setCategories(data ?? [])
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "gastos") fetchExpenses();
  }, [fetchExpenses, tab]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    await supabase.from("indirect_expenses").delete().eq("id", id);
    fetchExpenses();
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
          <p className="text-gray-500 mt-0.5">Gastos indirectos y rubros</p>
        </div>
        {tab === "gastos" && (
          <Link
            href="/expenses/new"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nuevo gasto
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm mb-5 w-fit">
        <button
          onClick={() => setTab("gastos")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "gastos" ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
          style={tab === "gastos" ? { backgroundColor: "#a9760a" } : undefined}
        >
          <Receipt size={15} />
          Gastos
        </button>
        <button
          onClick={() => setTab("rubros")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "rubros" ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
          style={tab === "rubros" ? { backgroundColor: "#a9760a" } : undefined}
        >
          <Tag size={15} />
          Rubros
        </button>
      </div>

      {tab === "rubros" ? (
        <RubrosTab />
      ) : (
        <>
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
                <label className="block text-xs text-gray-500 mb-1">Rubro</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer">
                  <option value="">Todos</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-gold" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4">
                  <Receipt size={24} className="text-gold" />
                </div>
                <p className="text-gray-500 font-medium">No hay gastos registrados</p>
                <p className="text-sm text-gray-400 mt-1">Registrá el primer gasto con el botón de arriba</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <SortableHeader label="Fecha" sortKey="date" sort={sort} onSort={toggleSort} className="px-3" />
                      <SortableHeader label="Rubro" sortKey="category_id" sort={sort} onSort={toggleSort} className="px-2" />
                      <SortableHeader label="Descripción" sortKey="description" sort={sort} onSort={toggleSort} className="hidden md:table-cell px-2" />
                      <SortableHeader label="Monto" sortKey="amount" sort={sort} onSort={toggleSort} align="right" className="px-2" />
                      <th className="px-2 py-3 w-16"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedExpenses.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-3 text-sm text-gray-700 whitespace-nowrap">{fmtDate(e.date)}</td>
                        <td className="px-2 py-3 max-w-[140px]">
                          <span className="text-sm font-medium text-gray-900 truncate block">{e.expense_categories?.name ?? "—"}</span>
                        </td>
                        <td className="px-2 py-3 text-sm text-gray-500 hidden md:table-cell max-w-[260px]">
                          <span className="truncate block">{e.description ?? <span className="text-gray-300">—</span>}</span>
                        </td>
                        <td className="px-2 py-3 text-sm text-right font-semibold text-gray-900 whitespace-nowrap">
                          {fmt(e.amount)}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Link href={`/expenses/new?duplicate=${e.id}`}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Duplicar">
                              <Copy size={14} />
                            </Link>
                            <Link href={`/expenses/${e.id}/edit`}
                              className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors" title="Editar">
                              <Edit2 size={14} />
                            </Link>
                            <button onClick={() => handleDelete(e.id)}
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
            {!loading && expenses.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 flex justify-between items-center">
                <p className="text-xs text-gray-400">{expenses.length} gasto{expenses.length !== 1 ? "s" : ""}</p>
                <p className="text-sm font-semibold text-gray-700">Total: {fmt(total)}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
