"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePortalCount } from "@/contexts/PortalCountContext";
import {
  Loader2, ArrowLeft, Pencil, Trash2,
  ChevronRight, Globe, User, CheckCircle,
  Phone, DollarSign, Plus, X, Ban,
  UserPlus, Search, Zap,
} from "lucide-react";
import type { Database } from "@/lib/types/database";
import { buildWhatsAppUrl, buildWhatsAppTextUrl } from "@/lib/utils/whatsapp";
import { pName } from "@/lib/utils/product";
import { fmtPayment, fmtDelivery } from "@/lib/utils/order-labels";
import NewClientModal from "@/components/orders/NewClientModal";
import NewCategoryModal from "@/components/expenses/NewCategoryModal";

type ExpenseCategoryRow = Database["public"]["Tables"]["expense_categories"]["Row"];

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Client = Database["public"]["Tables"]["clients"]["Row"];
type StatusType = Order["status"];

const STATUS_LABEL: Record<StatusType, string> = {
  pendiente:  "Pendiente",
  confirmado: "Confirmado",
  cumplido:   "Cumplido",
  anulado:    "Anulado",
};
const STATUS_STYLE: Record<StatusType, string> = {
  pendiente:  "bg-amber-100 text-amber-700",
  confirmado: "bg-blue-100 text-blue-700",
  cumplido:   "bg-teal-100 text-teal-700",
  anulado:    "bg-red-100 text-red-600",
};
const STATUS_FLOW: StatusType[] = ["pendiente", "confirmado", "cumplido"];

const WA_ICON = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n);
const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface ItemWithName extends OrderItem {
  product_name: string;
}

// ─── WhatsApp confirmation helpers ───────────────────────────────────────────

const fmtArs = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtDateShort = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

function extractFirstName(guestName: string | null, clientName: string | null): string {
  if (guestName) return guestName.split(" ")[0] ?? guestName;
  if (clientName) {
    const parts = clientName.split(", ");
    return parts[1] ?? parts[0];
  }
  return "";
}

function buildConfirmationMessage(
  firstName: string,
  orderNumber: number | null,
  items: ItemWithName[],
  total: number,
  desiredDate: string | null,
  deliveryMethod: string | null,
): string {
  const itemLines = items
    .map((it) => `- ${it.quantity}x ${it.product_name} - ${fmtArs(it.unit_price)}`)
    .join("\n");
  const deliveryLabel =
    deliveryMethod === "retiro" ? "Retiro en local" :
    deliveryMethod === "cadeteria" ? "Cadetería" : "—";
  return [
    `¡Hola ${firstName}!`,
    `Te confirmamos tu pedido #${String(orderNumber ?? "—").padStart(4, "0")} de Arachis.`,
    ``,
    `Detalle:`,
    itemLines,
    ``,
    `Total: ${fmtArs(total)}`,
    `Entrega: ${desiredDate ? fmtDateShort(desiredDate) : "A coordinar"}`,
    `Modalidad: ${deliveryLabel}`,
    ``,
    `¡Gracias por elegirnos! Te avisamos cuando esté listo. 😊`,
  ].join("\n");
}

function openWhatsAppConfirmation(phone: string | null, message: string): boolean {
  if (!phone) return false;
  window.open(buildWhatsAppTextUrl(phone, message), "_blank", "noopener,noreferrer");
  return true;
}

// ─── Client association modal ───────────────────────────────────────────────
function AssociateClientModal({
  order,
  onClose,
  onAssociated,
}: {
  order: Order;
  onClose: () => void;
  onAssociated: (clientId: string) => void;
}) {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    supabase.from("clients").select("*").eq("status", "active").order("last_name").order("first_name")
      .then(({ data }) => { setClients(data ?? []); setLoading(false); });
  }, [supabase]);

  const filtered = clients.filter((c) => {
    const name = c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Parse guest name to pre-fill new client modal (stored as "firstName lastName")
  const guestParts = (order.guest_name ?? "").trim().split(" ");
  const guestLastName = guestParts[guestParts.length - 1] ?? "";
  const guestFirstName = guestParts.slice(0, -1).join(" ");

  async function handleConfirm(clientId: string) {
    setSaving(true);
    await supabase
      .from("orders")
      .update({ status: "confirmado", client_id: clientId, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    onAssociated(clientId);
  }

  if (showNewClient) {
    return (
      <NewClientModal
        onClose={() => setShowNewClient(false)}
        onCreated={(c) => handleConfirm(c.id)}
        initialLastName={guestLastName}
        initialFirstName={guestFirstName}
        initialPhone={order.guest_phone ?? ""}
        initialEmail={order.guest_email ?? ""}
        initialCity={order.guest_city ?? ""}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <UserPlus size={18} style={{ color: "#a9760a" }} />
            <h2 className="font-semibold text-gray-900">Asociar cliente</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {order.guest_name && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-800">
              Pedido de portal: <span className="font-medium">{order.guest_name}</span>
              {order.guest_phone && ` · ${order.guest_phone}`}
              {order.guest_city && ` · ${order.guest_city}`}
            </div>
          )}

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente existente…"
              className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : (
            <div className="border border-gray-100 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Sin resultados</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-gray-50 last:border-0 ${
                      selectedId === c.id ? "bg-blue-50 text-blue-800" : "hover:bg-gray-50 text-gray-800"
                    }`}
                  >
                    <span className="font-medium">{c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name}</span>
                    {c.phone && <span className="text-gray-400 ml-2 text-xs">{c.phone}</span>}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => selectedId && handleConfirm(selectedId)}
              disabled={!selectedId || saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
              style={{ backgroundColor: "#a9760a" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin inline" /> : "Confirmar con este cliente"}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100" /></div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-2">o crear nuevo</div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewClient(true)}
            className="w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={14} /> Crear nuevo cliente
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Payment modal (inline in order detail) ──────────────────────────────
function AddPaymentModal({
  orderId,
  orderNumber,
  clientDisplay,
  balance,
  onClose,
  onSaved,
}: {
  orderId: string;
  orderNumber: number | null;
  clientDisplay: string;
  balance: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"efectivo" | "transferencia" | "canje" | "">("");
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
  const [discountValueStr, setDiscountValueStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Canje
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [canjeCategoryId, setCanjeCategoryId] = useState("");
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);

  const isCanje = method === "canje";

  const discountValue = parseFloat(discountValueStr) || 0;
  const discountAmt = isCanje
    ? 0
    : discountType === "percentage"
      ? Math.max(0, Math.min((balance * discountValue) / 100, balance))
      : discountType === "fixed"
      ? Math.max(0, Math.min(discountValue, balance))
      : 0;

  const [amount, setAmount] = useState(balance > 0 ? String(Math.round(balance)) : "");

  // Auto-update amount when discount changes (no aplica a canje)
  useEffect(() => {
    if (!isCanje) setAmount(String(Math.round(Math.max(0, balance - discountAmt))));
  }, [discountAmt, balance, isCanje]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Cargar rubros cuando se elige canje
  useEffect(() => {
    if (!isCanje || categories.length > 0) return;
    supabase.from("expense_categories").select("*").order("name").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, [isCanje, categories.length, supabase]);

  function handleCategoryCreated(category: ExpenseCategoryRow) {
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    setCanjeCategoryId(category.id);
    setShowNewCategoryModal(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!method) { setError("Seleccioná el método de pago."); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Ingresá un monto válido."); return; }
    if (isCanje) {
      if (!canjeCategoryId) { setError("Seleccioná el rubro de gasto para el canje."); return; }
      if (amt > balance + 0.01) {
        setError(`El importe del canje supera el saldo pendiente (${fmt(balance)}).`);
        return;
      }
    } else if (amt + discountAmt > balance + 0.01) {
      setError(`El total (cobro + descuento) supera el saldo pendiente (${fmt(balance)}).`);
      return;
    }

    setSaving(true);
    setError("");

    const dType = !isCanje && discountType !== "none" && discountAmt > 0 ? discountType : null;
    const { error: err } = await supabase.from("payments").insert({
      order_id: orderId,
      date,
      amount: amt,
      method: method as "efectivo" | "transferencia" | "canje",
      discount_type: dType,
      discount_value: dType ? discountValue : null,
      discount_amount: dType ? discountAmt : null,
    });
    if (err) { setError("Error al registrar el cobro."); setSaving(false); return; }

    const orderNumLabel = String(orderNumber ?? "—").padStart(4, "0");

    if (isCanje) {
      // Canje: imputar al rubro de gasto seleccionado
      const { error: expErr } = await supabase.from("indirect_expenses").insert({
        date,
        category_id: canjeCategoryId,
        description: `Canje pedido #${orderNumLabel} - ${clientDisplay}`,
        amount: amt,
      });
      if (expErr) { setError("Cobro registrado pero falló la imputación al rubro de gasto."); setSaving(false); return; }
    } else if (dType && discountAmt > 0) {
      // Registrar descuento como gasto indirecto
      const { data: cat } = await supabase
        .from("expense_categories")
        .select("id")
        .ilike("name", "Descuentos otorgados")
        .maybeSingle();
      let catId = cat?.id;
      if (!catId) {
        const { data: newCat } = await supabase
          .from("expense_categories")
          .insert({ name: "Descuentos otorgados" })
          .select("id")
          .single();
        catId = newCat?.id;
      }
      if (catId) {
        await supabase.from("indirect_expenses").insert({
          date,
          category_id: catId,
          description: `Descuento pedido #${orderNumLabel} - ${clientDisplay}`,
          amount: discountAmt,
        });
      }
    }

    onSaved();
  }

  return (
    <>
    {showNewCategoryModal && (
      <NewCategoryModal
        onClose={() => setShowNewCategoryModal(false)}
        onCreated={handleCategoryCreated}
      />
    )}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <DollarSign size={18} style={{ color: "#a9760a" }} />
            <h2 className="font-semibold text-gray-900">Registrar cobro</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isCanje ? "Importe del canje" : "Monto a cobrar"} <span className="text-red-500">*</span>
            </label>
            <input
              autoFocus
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0.01}
              step={0.01}
              placeholder="0.00"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Canje: rubro de gasto */}
          {isCanje && (
            <div className="space-y-2 border border-amber-100 rounded-lg p-3 bg-amber-50/50">
              <label className="block text-sm font-medium text-gray-700">
                Rubro de gasto <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={canjeCategoryId}
                  onChange={(e) => setCanjeCategoryId(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                >
                  <option value="">— Seleccionar —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCategoryModal(true)}
                  title="Nuevo rubro"
                  className="inline-flex items-center justify-center px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="text-xs text-amber-800">
                El importe se imputará a este rubro como gasto indirecto.
              </p>
            </div>
          )}

          {/* Descuento (no aplica a canje) */}
          {!isCanje && (
          <div className="space-y-3 border border-gray-100 rounded-lg p-3 bg-gray-50/60">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descuento (opcional)</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tipo</label>
                <select
                  value={discountType}
                  onChange={(e) => {
                    setDiscountType(e.target.value as "none" | "fixed" | "percentage");
                    setDiscountValueStr("");
                  }}
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                >
                  <option value="none">Sin descuento</option>
                  <option value="fixed">Monto fijo ($)</option>
                  <option value="percentage">Porcentaje (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  {discountType === "percentage" ? "%" : "Valor"}
                </label>
                <input
                  type="number"
                  value={discountValueStr}
                  onChange={(e) => setDiscountValueStr(e.target.value)}
                  disabled={discountType === "none"}
                  min={0}
                  max={discountType === "percentage" ? 100 : undefined}
                  step={discountType === "percentage" ? 0.1 : 1}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
            <div className="bg-white rounded-lg px-3 py-2 border border-gray-100 text-xs space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>Saldo pendiente</span>
                <span className="font-medium text-gray-700">{fmt(balance)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-orange-600">
                  <span>Descuento{discountType === "percentage" ? ` (${discountValue}%)` : ""}</span>
                  <span className="font-medium">− {fmt(discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t border-gray-100 pt-1 text-gray-800">
                <span>A cobrar</span>
                <span style={{ color: "#a9760a" }}>{fmt(Math.max(0, balance - discountAmt))}</span>
              </div>
            </div>
          </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              {(["efectivo", "transferencia", "canje"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium capitalize transition-colors ${
                    method === m ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                  style={method === m ? { backgroundColor: "#a9760a" } : undefined}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: "#a9760a" }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}

// ─── Anular modal ─────────────────────────────────────────────────────────────
function AnularModal({
  onClose,
  onConfirm,
  saving,
  error,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
  saving: boolean;
  error: string;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Ban size={18} className="text-orange-500" />
            <h2 className="font-semibold text-gray-900">Anular pedido</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            El pedido pasará a estado <strong>Anulado</strong> y no se podrá modificar.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo de anulación <span className="text-red-500">*</span>
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ej: Cliente canceló, error en el pedido…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => reason.trim() && onConfirm(reason.trim())}
              disabled={!reason.trim() || saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Anulando…" : "Confirmar anulación"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { refreshPortalCount } = usePortalCount();

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<ItemWithName[]>([]);
  const [clientName, setClientName] = useState<string | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAssocModal, setShowAssocModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [anularSaving, setAnularSaving] = useState(false);
  const [anularError, setAnularError] = useState("");
  const [noPhoneWarning, setNoPhoneWarning] = useState(false);
  const [deliveryDateError, setDeliveryDateError] = useState("");
  const [deliveryDateLocal, setDeliveryDateLocal] = useState("");

  const load = useCallback(async () => {
    const [{ data: o }, { data: its }, { data: prods }, { data: pays }] = await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
      supabase.from("products").select("id, name, presentation"),
      supabase.from("payments").select("*").eq("order_id", id).order("date"),
    ]);
    setOrder(o);
    setPayments(pays ?? []);

    const nameMap: Record<string, string> = {};
    (prods ?? []).forEach((p) => { nameMap[p.id] = pName(p); });
    setItems((its ?? []).map((it) => ({ ...it, product_name: nameMap[it.product_id] ?? it.product_id })));

    if (o?.client_id) {
      const { data: c } = await supabase.from("clients").select("last_name, first_name, phone").eq("id", o.client_id).single();
      if (c) {
        setClientName(c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name);
        setClientPhone(c.phone ?? null);
      }
    }
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { load(); }, [load]);

  // Sync local delivery date when the order loads (by id change, not on every DB update)
  useEffect(() => {
    if (order?.id) setDeliveryDateLocal(order.delivered_date ?? "");
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-cumplido check: called after any payment or delivered_date change.
  // Sin cargo: alcanza con la entrega (no se cobra). Otras modalidades: además, saldo cancelado.
  async function checkAutoCumplido(currentOrder: Order, totalPaid: number, orderTotal: number) {
    if (currentOrder.status !== "confirmado" || currentOrder.delivered_date == null) return;
    const isCourtesy = currentOrder.payment_method === "sin_cargo";
    const paid = totalPaid >= orderTotal - 0.01;
    if (!isCourtesy && !paid) return;
    const { data } = await supabase
      .from("orders")
      .update({ status: "cumplido", updated_at: new Date().toISOString() })
      .eq("id", currentOrder.id)
      .select("*")
      .single();
    if (data) setOrder(data);
  }

  async function handleConfirm() {
    if (!order) return;
    if (order.origin === "portal" && !order.client_id) {
      setShowAssocModal(true);
      return;
    }
    setActionLoading(true);
    const { data } = await supabase
      .from("orders")
      .update({ status: "confirmado", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (data) {
      setOrder(data);
      if (order.origin === "portal") {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("order_id", id)
          .eq("type", "nuevo_pedido_portal");
        await refreshPortalCount();
      }
      // Abrir WhatsApp con mensaje de confirmación
      setNoPhoneWarning(false);
      const phone = clientPhone ?? order.guest_phone ?? null;
      const firstName = extractFirstName(order.guest_name ?? null, clientName);
      const orderTotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
      const msg = buildConfirmationMessage(firstName, order.order_number, items, orderTotal, data.desired_date, data.delivery_method);
      if (!openWhatsAppConfirmation(phone, msg)) setNoPhoneWarning(true);
    }
    setActionLoading(false);
  }

  async function handleAnular(reason: string) {
    if (!order) return;
    setAnularSaving(true);
    setAnularError("");
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "anulado", anulation_reason: reason, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Error anulando pedido:", error);
      setAnularError((error as { message?: string }).message ?? "Error al anular. Verificá que la migración SQL 013 fue aplicada en Supabase.");
      setAnularSaving(false);
      return;
    }
    if (data) {
      setOrder(data);
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("order_id", id)
        .eq("read", false);
      if (data.origin === "portal") {
        await refreshPortalCount();
      }
    }
    setAnularSaving(false);
    setShowAnularModal(false);
  }

  async function commitDeliveryDate() {
    if (!order || deliveryDateLocal === (order.delivered_date ?? "")) return;
    await handleDeliveredDateChange(deliveryDateLocal);
  }

  async function handleDeliveredDateChange(dateStr: string) {
    if (!order) return;
    setDeliveryDateError("");
    const newDate = dateStr || null;

    // Clearing the date on a cumplido order → revert to confirmado
    const newStatus = !newDate && order.status === "cumplido" ? "confirmado" : order.status;

    const { data, error } = await supabase
      .from("orders")
      .update({ delivered_date: newDate, status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("Error actualizando fecha de entrega:", error);
      setDeliveryDateError((error as { message?: string }).message ?? "Error al actualizar la fecha de entrega.");
      return;
    }
    if (data) {
      setOrder(data);
      // Only try auto-cumplido when a date is being set (not when clearing)
      if (newDate) {
        const orderTotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
        const totalPaid = payments.reduce((acc, p) => acc + p.amount + (p.discount_amount ?? 0), 0);
        await checkAutoCumplido(data, totalPaid, orderTotal);
      }
    }
  }

  async function handlePaymentSaved() {
    setShowPaymentModal(false);
    // Reload payments
    const { data: pays } = await supabase.from("payments").select("*").eq("order_id", id).order("date");
    setPayments(pays ?? []);
    // Check auto-listo
    if (order && order.status === "confirmado") {
      const orderTotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
      const totalPaid = (pays ?? []).reduce((acc, p) => acc + p.amount + (p.discount_amount ?? 0), 0);
      await checkAutoCumplido(order, totalPaid, orderTotal);
      // Reload order in case status changed
      const { data: updatedOrder } = await supabase.from("orders").select("*").eq("id", id).single();
      if (updatedOrder) setOrder(updatedOrder);
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm("¿Eliminar este cobro?")) return;
    await supabase.from("payments").delete().eq("id", paymentId);
    const { data: pays } = await supabase.from("payments").select("*").eq("order_id", id).order("date");
    setPayments(pays ?? []);
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    await supabase.from("notifications").delete().eq("order_id", id);
    await supabase.from("orders").delete().eq("id", id);
    router.push("/orders");
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>;
  }
  if (!order) {
    return <div className="text-center py-20 text-gray-400">Pedido no encontrado.</div>;
  }

  const total = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  const totalCash = payments.reduce((acc, p) => acc + p.amount, 0);
  const totalDiscounts = payments.reduce((acc, p) => acc + (p.discount_amount ?? 0), 0);
  const totalPaid = totalCash + totalDiscounts;
  const balance = total - totalPaid;
  const canEdit = order.status !== "anulado";
  const canAnular = order.status !== "cumplido" && order.status !== "anulado";
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const displayName = clientName ?? order.guest_name ?? "—";

  return (
    <div className="max-w-4xl">
      {showAssocModal && (
        <AssociateClientModal
          order={order}
          onClose={() => setShowAssocModal(false)}
          onAssociated={async (clientId) => {
            setShowAssocModal(false);
            const { data: c } = await supabase.from("clients").select("last_name, first_name, phone").eq("id", clientId).single();
            if (c) {
              setClientName(c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name);
              setClientPhone(c.phone ?? null);
            }
            const { data: updatedOrder } = await supabase.from("orders").select("*").eq("id", id).single();
            if (updatedOrder) setOrder(updatedOrder);
            await refreshPortalCount();
            // Abrir WhatsApp con mensaje de confirmación
            setNoPhoneWarning(false);
            const phone = c?.phone ?? order.guest_phone ?? null;
            const firstName = c?.first_name ?? (order.guest_name?.split(" ")[0] ?? "");
            const orderTotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
            const msg = buildConfirmationMessage(firstName, order.order_number, items, orderTotal, updatedOrder?.desired_date ?? order.desired_date, updatedOrder?.delivery_method ?? order.delivery_method);
            if (!openWhatsAppConfirmation(phone, msg)) setNoPhoneWarning(true);
          }}
        />
      )}
      {showPaymentModal && (
        <AddPaymentModal
          orderId={id}
          orderNumber={order.order_number}
          clientDisplay={displayName}
          balance={balance}
          onClose={() => setShowPaymentModal(false)}
          onSaved={handlePaymentSaved}
        />
      )}
      {showAnularModal && (
        <AnularModal
          onClose={() => { setShowAnularModal(false); setAnularError(""); }}
          onConfirm={handleAnular}
          saving={anularSaving}
          error={anularError}
        />
      )}

      {noPhoneWarning && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700 flex items-center justify-between gap-3">
          <span>No se puede enviar confirmación: el cliente no tiene teléfono cargado.</span>
          <button onClick={() => setNoPhoneWarning(false)} className="text-amber-400 hover:text-amber-600 flex-shrink-0"><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/orders")} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                Pedido #{String(order.order_number ?? "—").padStart(4, "0")}
              </h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[order.status]}`}>
                {STATUS_LABEL[order.status]}
              </span>
              {order.origin === "portal" ? (
                <span className="inline-flex items-center gap-1 text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Globe size={11} /> Portal
                </span>
              ) : order.origin === "venta_rapida" ? (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Zap size={11} /> Venta rápida
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                  <User size={11} /> Manual
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-0.5">{fmtDate(order.order_date)} · {displayName}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {order.status === "pendiente" && (
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#a9760a" }}
            >
              {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              Confirmar pedido
            </button>
          )}
          {order.status === "confirmado" && (
            <button
              onClick={() => {
                setNoPhoneWarning(false);
                const phone = clientPhone ?? order.guest_phone ?? null;
                const firstName = extractFirstName(order.guest_name ?? null, clientName);
                const orderTotal = items.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
                const msg = buildConfirmationMessage(firstName, order.order_number, items, orderTotal, order.desired_date, order.delivery_method);
                if (!openWhatsAppConfirmation(phone, msg)) setNoPhoneWarning(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "#25D366" }}
            >
              {WA_ICON} Enviar confirmación
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => router.push(`/orders/${id}/edit`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} /> Editar
            </button>
          )}
          {canAnular && (
            <button
              onClick={() => setShowAnularModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-orange-200 text-orange-600 text-sm font-medium hover:bg-orange-50 transition-colors"
            >
              <Ban size={14} /> Anular
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* Status stepper */}
      {order.status !== "anulado" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STATUS_FLOW.map((s, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <div key={s} className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                      active ? "text-white" : done ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
                    }`}
                    style={active ? { backgroundColor: "#a9760a" } : undefined}
                  >
                    {done && <CheckCircle size={11} />}
                    {STATUS_LABEL[s]}
                  </div>
                  {idx < STATUS_FLOW.length - 1 && (
                    <ChevronRight size={12} className="text-gray-200 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Última actualización: {fmtDateTime(order.updated_at)}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {/* Client + Logistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cliente</p>
            <p className="font-semibold text-gray-900 text-lg">{displayName}</p>
            {/* Phone + WhatsApp: client_id orders use clientPhone, portal orders use guest_phone */}
            {(clientPhone || order.guest_phone) && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <Phone size={12} className="text-gray-400" />
                {clientPhone ?? order.guest_phone}
                <a
                  href={buildWhatsAppUrl((clientPhone ?? order.guest_phone)!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-500 hover:text-green-600 transition-colors"
                  title="Abrir WhatsApp"
                >
                  {WA_ICON}
                </a>
              </p>
            )}
            {order.guest_email && <p className="text-sm text-gray-500">{order.guest_email}</p>}
            {order.guest_city && <p className="text-sm text-gray-500">{order.guest_city}</p>}

            {/* Delivery date — always visible; editable except when anulado */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Fecha de entrega
              </p>
              {order.status !== "anulado" ? (
                <input
                  type="date"
                  value={deliveryDateLocal}
                  onChange={(e) => setDeliveryDateLocal(e.target.value)}
                  onBlur={commitDeliveryDate}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              ) : (
                <p className="text-sm text-gray-600">
                  {order.delivered_date ? fmtDate(order.delivered_date) : <span className="text-gray-400">—</span>}
                </p>
              )}
              {!deliveryDateLocal && order.status !== "anulado" && (
                <p className="text-xs text-gray-400 mt-1">Sin fecha — pendiente de entrega</p>
              )}
              {deliveryDateError && (
                <p className="text-xs text-red-600 mt-1">{deliveryDateError}</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Logística</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Fecha de pedido</span>
                <span className="font-medium text-gray-900">{fmtDate(order.order_date)}</span>
              </div>
              {order.desired_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Entrega deseada</span>
                  <span className="font-medium text-gray-900">{fmtDate(order.desired_date)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Modalidad de pago</span>
                <span className="font-medium text-gray-900">{fmtPayment(order.payment_method)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Modalidad de entrega</span>
                <span className="font-medium text-gray-900">{fmtDelivery(order.delivery_method)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Detalle</p>
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
                  <td className="px-4 py-3 text-center text-gray-600">{it.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(it.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(it.quantity * it.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30">
            <div className="flex justify-end gap-8 text-sm font-bold text-gray-900">
              <span>Total</span>
              <span style={{ color: "#a9760a" }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Payments section */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cobros</p>
            {order.status !== "anulado" && balance > 0.01 && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
                style={{ backgroundColor: "#a9760a" }}
              >
                <Plus size={12} /> Registrar cobro
              </button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-gray-400">Sin cobros registrados</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Método</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Monto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Descuento</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-gray-700">{fmtDate(p.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtPayment(p.method)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      {p.discount_amount && p.discount_amount > 0
                        ? <span className="text-orange-500 text-xs font-medium">− {fmt(p.discount_amount)}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {order.status !== "cumplido" && order.status !== "anulado" && (
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Eliminar cobro"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total cobrado</span>
              <span className="font-medium text-gray-900">{fmt(totalCash)}</span>
            </div>
            {totalDiscounts > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total descuentos</span>
                <span className="font-medium text-orange-600">− {fmt(totalDiscounts)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Saldo pendiente</span>
              <span className={`font-semibold ${balance > 0.01 ? "text-amber-600" : "text-green-600"}`}>
                {balance > 0.01 ? fmt(balance) : "Cobrado ✓"}
              </span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notas</p>
            <p className="text-sm text-gray-700">{order.notes}</p>
          </div>
        )}

        {order.status === "anulado" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Pedido anulado</p>
            {order.anulation_reason ? (
              <p className="text-sm text-red-700">{order.anulation_reason}</p>
            ) : (
              <p className="text-sm text-red-400 italic">Sin motivo registrado</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
