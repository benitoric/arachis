"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Loader2, FileText, Search } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Quote = Database["public"]["Tables"]["quotes"]["Row"];

const STATUS_LABELS: Record<Quote["status"], string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};

const STATUS_STYLES: Record<Quote["status"], string> = {
  borrador: "bg-gray-100 text-gray-600",
  enviado: "bg-blue-100 text-blue-700",
  aceptado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-600",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function QuotesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Quote["status"] | "">("");

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .order("quote_number", { ascending: false });
    setQuotes(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const filteredRaw = quotes.filter((q) => {
    const matchSearch =
      !search ||
      q.client_name.toLowerCase().includes(search.toLowerCase()) ||
      String(q.quote_number).includes(search);
    const matchStatus = !statusFilter || q.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: filteredSorted, sort, toggleSort } = useSortableData(filteredRaw as any[]);
  const filtered = filteredSorted as Quote[];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
          <p className="text-gray-500 mt-0.5">Mesas dulces y eventos</p>
        </div>
        <button
          onClick={() => router.push("/quotes/new")}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#49789d" }}
        >
          <Plus size={15} />
          Nuevo presupuesto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cliente o N°…"
            className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-44"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Quote["status"] | "")}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="enviado">Enviado</option>
          <option value="aceptado">Aceptado</option>
          <option value="rechazado">Rechazado</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">
              {quotes.length === 0 ? "Todavía no hay presupuestos" : "Sin resultados"}
            </p>
            {quotes.length === 0 && (
              <button
                onClick={() => router.push("/quotes/new")}
                className="mt-3 text-sm font-medium hover:underline"
                style={{ color: "#49789d" }}
              >
                Crear el primero
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortableHeader label="N°" sortKey="quote_number" sort={sort} onSort={toggleSort} className="px-6" />
                  <SortableHeader label="Cliente" sortKey="client_name" sort={sort} onSort={toggleSort} />
                  <SortableHeader label="Fecha" sortKey="date" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                  <SortableHeader label="Evento" sortKey="event_type" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
                  <SortableHeader label="Total" sortKey="final_price" sort={sort} onSort={toggleSort} align="right" />
                  <SortableHeader label="Estado" sortKey="status" sort={sort} onSort={toggleSort} align="center" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((q) => (
                  <tr
                    key={q.id}
                    onClick={() => router.push(`/quotes/${q.id}`)}
                    className="hover:bg-gray-50/60 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3.5 font-mono text-sm font-medium text-gray-700">
                      #{String(q.quote_number).padStart(4, "0")}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-gray-900">{q.client_name}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-500 hidden sm:table-cell">
                      {fmtDate(q.date)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500 hidden md:table-cell">
                      {q.event_type ?? <span className="text-gray-300">—</span>}
                      {q.event_date ? ` · ${fmtDate(q.event_date)}` : ""}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-gray-900">
                      {fmt(q.final_price)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[q.status]}`}>
                        {STATUS_LABELS[q.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
