"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, Trash2, Pencil, X, Calendar } from "lucide-react";
import type { Database } from "@/lib/types/database";

type EventRow = Database["public"]["Tables"]["event_results"]["Row"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

// ─── Modal ──────────────────────────────────────────────────────────────────

function EventModal({
  event,
  onClose,
  onSaved,
}: {
  event?: EventRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(event?.date ?? today);
  const [description, setDescription] = useState(event?.description ?? "");
  const [income, setIncome] = useState(event ? String(event.income) : "0");
  const [expenses, setExpenses] = useState(event ? String(event.expenses) : "0");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) { setError("Ingresá una descripción."); return; }
    const inc = parseFloat(income) || 0;
    const exp = parseFloat(expenses) || 0;
    setSaving(true);
    setError("");
    const payload = {
      date,
      description: description.trim(),
      income: inc,
      expenses: exp,
      notes: notes.trim() || null,
    };
    const { error: err } = event
      ? await supabase.from("event_results").update(payload).eq("id", event.id)
      : await supabase.from("event_results").insert(payload);
    if (err) { setError(err.message); setSaving(false); return; }
    // Auto-save exchange rate for the event date in the background
    fetch(`/api/exchange-rate?date=${date}`).catch(() => undefined);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar size={17} style={{ color: "#a9760a" }} />
            <h2 className="font-semibold text-gray-900">{event ? "Editar evento" : "Nuevo evento"}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha <span className="text-red-400">*</span></label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción <span className="text-red-400">*</span></label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Feria gastronómica"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingresos</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={income} onChange={(e) => setIncome(e.target.value)}
                  min={0} step={1} placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gastos</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={expenses} onChange={(e) => setExpenses(e.target.value)}
                  min={0} step={1} placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Observaciones opcionales…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none" />
          </div>
          {/* Preview */}
          {(parseFloat(income) > 0 || parseFloat(expenses) > 0) && (
            <div className="bg-gray-50 rounded-lg px-4 py-2.5 flex items-center justify-between text-sm">
              <span className="text-gray-500">Resultado del evento</span>
              <span className={`font-bold ${(parseFloat(income) || 0) - (parseFloat(expenses) || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                {fmt((parseFloat(income) || 0) - (parseFloat(expenses) || 0))}
              </span>
            </div>
          )}
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: "#a9760a" }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando…" : event ? "Guardar cambios" : "Registrar evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export default function EventosTab() {
  const supabase = createClient();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventRow | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("event_results").select("*").order("date", { ascending: false });
    setEvents(data ?? []);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    await supabase.from("event_results").delete().eq("id", id);
    load();
  }

  const totalIncome = events.reduce((s, e) => s + e.income, 0);
  const totalExpenses = events.reduce((s, e) => s + e.expenses, 0);
  const totalResult = totalIncome - totalExpenses;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{events.length} evento{events.length !== 1 ? "s" : ""} registrados</p>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: "#a9760a" }}
        >
          <Plus size={14} /> Nuevo evento
        </button>
      </div>

      {/* Summary cards */}
      {!loading && events.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-xs font-medium text-green-700">Ingresos totales</p>
            <p className="text-lg font-bold text-green-700 mt-1">{fmt(totalIncome)}</p>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="text-xs font-medium text-red-700">Gastos totales</p>
            <p className="text-lg font-bold text-red-700 mt-1">{fmt(totalExpenses)}</p>
          </div>
          <div className={`rounded-xl p-4 ${totalResult >= 0 ? "bg-blue-50" : "bg-orange-50"}`}>
            <p className={`text-xs font-medium ${totalResult >= 0 ? "text-blue-700" : "text-orange-700"}`}>Resultado neto</p>
            <p className={`text-lg font-bold mt-1 ${totalResult >= 0 ? "text-blue-700" : "text-orange-700"}`}>{fmt(totalResult)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Calendar size={36} className="mx-auto mb-2 text-gray-200" />
            <p>No hay eventos registrados todavía.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-5 py-3">Fecha</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Descripción</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Ingresos</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Gastos</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Resultado</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {events.map((e) => {
                const result = e.income - e.expenses;
                return (
                  <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{e.description}</p>
                      {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium hidden sm:table-cell">
                      {e.income > 0 ? fmt(e.income) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500 font-medium hidden sm:table-cell">
                      {e.expenses > 0 ? fmt(e.expenses) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${result >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmt(result)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditing(e); setShowModal(true); }}
                          className="text-gray-300 hover:text-blue-500 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(e.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <EventModal
          event={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}
