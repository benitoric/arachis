"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  ArrowLeft,
  Pencil,
  FileDown,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Search,
  X,
  UserPlus,
} from "lucide-react";
import type { Database } from "@/lib/types/database";
import type { QuoteWithItems } from "@/lib/utils/generateQuotePDF";

type Quote = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteItem = Database["public"]["Tables"]["quote_items"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];

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
    minimumFractionDigits: 2,
  }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

function clientDisplayName(c: Client) {
  return c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name;
}

// ─── Associate Client Modal ────────────────────────────────────────────────────
interface AssociateModalProps {
  quote: Quote;
  onClose: () => void;
  onDone: (clientId: string | null) => void;
}

function AssociateClientModal({ quote, onClose, onDone }: AssociateModalProps) {
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFirstName, setNewFirstName] = useState(quote.client_first_name ?? "");
  const [newLastName, setNewLastName] = useState(quote.client_last_name ?? quote.client_name ?? "");
  const [newPhone, setNewPhone] = useState(quote.client_phone ?? "");
  const [newEmail, setNewEmail] = useState(quote.client_email ?? "");
  const [tab, setTab] = useState<"search" | "create">("search");

  const searchClients = useCallback(async (q: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("*")
      .or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%`)
      .order("last_name")
      .order("first_name")
      .limit(10);
    setClients(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    searchClients(search);
  }, [search, searchClients]);

  async function handleCreate() {
    if (!newLastName.trim() || !newFirstName.trim() || !newPhone.trim()) return;
    setCreating(true);
    const { data } = await supabase
      .from("clients")
      .insert({
        last_name: newLastName.trim(),
        first_name: newFirstName.trim(),
        phone: newPhone.trim(),
        email: newEmail.trim() || null,
      })
      .select("id")
      .single();
    setCreating(false);
    if (data) onDone(data.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Asociar cliente</h2>
            <p className="text-xs text-gray-400 mt-0.5">Vincular este presupuesto a un cliente</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-gray-100">
          <button
            onClick={() => setTab("search")}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "search" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={tab === "search" ? { backgroundColor: "#49789d" } : undefined}
          >
            Buscar existente
          </button>
          <button
            onClick={() => setTab("create")}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "create" ? "text-white" : "text-gray-500 hover:bg-gray-50"}`}
            style={tab === "create" ? { backgroundColor: "#49789d" } : undefined}
          >
            Crear nuevo
          </button>
        </div>

        <div className="p-5 space-y-3">
          {tab === "search" ? (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por apellido o nombre…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-300" /></div>
              ) : clients.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">
                  {search ? "Sin resultados." : "Escribí para buscar."}
                </p>
              ) : (
                <ul className="divide-y divide-gray-50 max-h-52 overflow-y-auto rounded-lg border border-gray-100">
                  {clients.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => onDone(c.id)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors text-sm"
                      >
                        <span className="font-medium text-gray-900">{clientDisplayName(c)}</span>
                        {c.phone && <span className="text-gray-400 ml-2">{c.phone}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
                  <input type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Apellido"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                  <input type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Nombre"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono <span className="text-red-500">*</span></label>
                <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="381 XXX-XXXX"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          {tab === "create" ? (
            <button
              onClick={handleCreate}
              disabled={creating || !newLastName.trim() || !newFirstName.trim() || !newPhone.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: "#49789d" }}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Crear y asociar
            </button>
          ) : (
            <button
              onClick={() => onDone(null)}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Omitir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAssociate, setShowAssociate] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: q }, { data: its }] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", id).single(),
        supabase.from("quote_items").select("*").eq("quote_id", id).order("created_at"),
      ]);
      setQuote(q);
      setItems(its ?? []);
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  async function handleStatusChange(newStatus: Quote["status"], clientId?: string | null) {
    if (!quote) return;
    const updatePayload: Database["public"]["Tables"]["quotes"]["Update"] = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (clientId !== undefined) updatePayload.client_id = clientId;
    const { data } = await supabase
      .from("quotes")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();
    if (data) setQuote(data);
  }

  function handleAceptadoClick() {
    setShowAssociate(true);
  }

  async function handleAssociateDone(clientId: string | null) {
    setShowAssociate(false);
    await handleStatusChange("aceptado", clientId);
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    await supabase.from("quotes").delete().eq("id", id);
    router.push("/quotes");
  }

  async function handleDownloadPDF() {
    if (!quote) return;
    setGeneratingPDF(true);
    try {
      const { generateQuotePDF } = await import("@/lib/utils/generateQuotePDF");
      const quoteWithItems: QuoteWithItems = { ...quote, items };
      await generateQuotePDF(quoteWithItems);
    } finally {
      setGeneratingPDF(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!quote) {
    return <div className="text-center py-20 text-gray-400">Presupuesto no encontrado.</div>;
  }

  const totalItems = items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);

  // Display name: prefer first+last, fall back to client_name
  const clientDisplayStr = quote.client_last_name
    ? (quote.client_first_name ? `${quote.client_last_name}, ${quote.client_first_name}` : quote.client_last_name)
    : quote.client_name;

  return (
    <div className="max-w-4xl">
      {showAssociate && (
        <AssociateClientModal
          quote={quote}
          onClose={() => setShowAssociate(false)}
          onDone={handleAssociateDone}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/quotes")}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Presupuesto #{String(quote.quote_number).padStart(4, "0")}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[quote.status]}`}>
                {STATUS_LABELS[quote.status]}
              </span>
            </div>
            <p className="text-gray-500 mt-0.5">{fmtDate(quote.date)}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {quote.status === "borrador" && (
            <button
              onClick={() => handleStatusChange("enviado")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              <Send size={14} />
              Marcar enviado
            </button>
          )}
          {quote.status === "enviado" && (
            <>
              <button
                onClick={handleAceptadoClick}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-200 text-green-700 text-sm font-medium hover:bg-green-50 transition-colors"
              >
                <CheckCircle2 size={14} />
                Aceptado
              </button>
              <button
                onClick={() => handleStatusChange("rechazado")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                <XCircle size={14} />
                Rechazado
              </button>
            </>
          )}
          <button
            onClick={handleDownloadPDF}
            disabled={generatingPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {generatingPDF ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            Descargar PDF
          </button>
          <button
            onClick={() => router.push(`/quotes/${id}/edit`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "#49789d" }}
          >
            <Pencil size={14} />
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Client + Event */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cliente</p>
            <p className="font-semibold text-gray-900 text-lg">{clientDisplayStr}</p>
            {quote.client_phone && (
              <p className="text-sm text-gray-500 mt-1">Tel: {quote.client_phone}</p>
            )}
            {quote.client_email && (
              <p className="text-sm text-gray-500">{quote.client_email}</p>
            )}
            {quote.client_id && (
              <button
                onClick={() => router.push(`/clients/${quote.client_id}`)}
                className="mt-2 text-xs font-medium hover:underline"
                style={{ color: "#49789d" }}
              >
                Ver cliente →
              </button>
            )}
          </div>

          {(quote.event_type || quote.event_date || quote.estimated_guests) && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Evento</p>
              {quote.event_type && (
                <p className="font-semibold text-gray-900 text-lg">{quote.event_type}</p>
              )}
              {quote.event_date && (
                <p className="text-sm text-gray-500 mt-1">{fmtDate(quote.event_date)}</p>
              )}
              {quote.estimated_guests && (
                <p className="text-sm text-gray-500">{quote.estimated_guests} personas</p>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Artículos</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Artículo</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Precio unit.</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{it.product_name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {it.quantity % 1 === 0 ? it.quantity : it.quantity.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(it.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {fmt(it.unit_price * it.quantity)}
                  </td>
                </tr>
              ))}
              {quote.labor_cost > 0 && (
                <tr>
                  <td className="px-5 py-3 text-gray-500 italic">Mano de obra</td>
                  <td className="px-4 py-3 text-center text-gray-400">—</td>
                  <td className="px-4 py-3 text-right text-gray-400">—</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(quote.labor_cost)}</td>
                </tr>
              )}
              {quote.extra_charge_amount > 0 && (
                <tr>
                  <td className="px-5 py-3 text-gray-500 italic">
                    {quote.extra_charge_description || "Cargo adicional"}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">—</td>
                  <td className="px-4 py-3 text-right text-gray-400">—</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(quote.extra_charge_amount)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Summary */}
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/30 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal artículos</span>
              <span>{fmt(totalItems)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Margen aplicado</span>
              <span>{quote.margin_percentage}%</span>
            </div>
            <div className="flex justify-between font-bold text-base text-gray-900 pt-2 border-t border-gray-200">
              <span>Total final</span>
              <span style={{ color: "#E8475F" }}>{fmt(quote.final_price)}</span>
            </div>
          </div>
        </div>

        {/* Conditions */}
        {(quote.validity_days || quote.payment_terms || quote.notes) && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Condiciones</p>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-800">Vigencia:</span>{" "}
                {quote.validity_days} días desde la emisión
              </p>
              {quote.payment_terms && (
                <p>
                  <span className="font-medium text-gray-800">Pago:</span>{" "}
                  {quote.payment_terms}
                </p>
              )}
              {quote.notes && (
                <p>
                  <span className="font-medium text-gray-800">Notas:</span>{" "}
                  {quote.notes}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
