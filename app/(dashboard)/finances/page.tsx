"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2, Plus, Trash2, Pencil, X, ChevronDown, ChevronRight,
  DollarSign, TrendingUp, Users, Calendar,
} from "lucide-react";
import type { Database } from "@/lib/types/database";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";
import ResultadoTab from "@/components/finances/ResultadoTab";
import EventosTab from "@/components/finances/EventosTab";

type Payment = Database["public"]["Tables"]["payments"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

type Tab = "cobros" | "estado" | "resultado" | "eventos";

interface OrderWithMeta extends Order {
  total: number;
  total_paid: number;
  balance: number;
  client_display: string;
}

interface PaymentWithMeta extends Payment {
  order_number: number | null;
  client_display: string;
}

// ─────────────────────────────────────────────
// PAYMENT MODAL
// ─────────────────────────────────────────────
function PaymentModal({
  orders,
  editPayment,
  onClose,
  onSaved,
}: {
  orders: OrderWithMeta[];
  editPayment?: PaymentWithMeta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [orderId, setOrderId] = useState(editPayment?.order_id ?? "");
  const [date, setDate] = useState(editPayment?.date ?? new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState(editPayment ? String(editPayment.amount) : "");
  const [method, setMethod] = useState<"efectivo" | "transferencia" | "canje" | "">(editPayment?.method ?? "");
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
  const [discountValueStr, setDiscountValueStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedOrder = orders.find((o) => o.id === orderId);
  const availableBalance = selectedOrder
    ? (editPayment
        ? selectedOrder.balance + editPayment.amount + (editPayment.discount_amount ?? 0)
        : selectedOrder.balance)
    : 0;

  const discountValue = parseFloat(discountValueStr) || 0;
  const discountAmt =
    !editPayment && discountType === "percentage"
      ? Math.max(0, Math.min((availableBalance * discountValue) / 100, availableBalance))
      : !editPayment && discountType === "fixed"
      ? Math.max(0, Math.min(discountValue, availableBalance))
      : 0;

  // Auto-fill amount when order or discount changes (create mode only)
  useEffect(() => {
    if (!editPayment && availableBalance > 0) {
      setAmount(String(Math.round(Math.max(0, availableBalance - discountAmt))));
    }
  }, [availableBalance, discountAmt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) { setError("Seleccioná un pedido."); return; }
    if (!method) { setError("Seleccioná el método de pago."); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Ingresá un monto válido."); return; }
    if (amt + discountAmt > availableBalance + 0.01) {
      setError(`El total (cobro + descuento) no puede superar el saldo (${fmtFull(availableBalance)}).`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editPayment) {
        const { error: err } = await supabase
          .from("payments")
          .update({ order_id: orderId, date, amount: amt, method: method as "efectivo" | "transferencia" | "canje" })
          .eq("id", editPayment.id);
        if (err) throw err;
      } else {
        const dType = discountType !== "none" && discountAmt > 0 ? discountType : null;
        const { error: err } = await supabase.from("payments").insert({
          order_id: orderId,
          date,
          amount: amt,
          method: method as "efectivo" | "transferencia" | "canje",
          discount_type: dType,
          discount_value: dType ? discountValue : null,
          discount_amount: dType ? discountAmt : null,
        });
        if (err) throw err;

        // Registrar descuento como gasto indirecto
        if (dType && discountAmt > 0 && selectedOrder) {
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
              description: `Descuento pedido #${String(selectedOrder.order_number ?? "—").padStart(4, "0")} - ${selectedOrder.client_display}`,
              amount: discountAmt,
            });
          }
        }
      }

      // Recalculate order total and total_paid to decide auto-cumplido
      const [{ data: orderItemsData }, { data: allPayments }, { data: orderData }] = await Promise.all([
        supabase.from("order_items").select("quantity, unit_price").eq("order_id", orderId),
        supabase.from("payments").select("amount, discount_amount").eq("order_id", orderId),
        supabase.from("orders").select("status, delivered_date").eq("id", orderId).single(),
      ]);

      const orderTotal = (orderItemsData ?? []).reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
      const totalPaid = (allPayments ?? []).reduce(
        (acc, p) => acc + p.amount + (p.discount_amount ?? 0),
        0
      );

      if (orderData?.status === "confirmado" && totalPaid >= orderTotal - 0.01 && orderData?.delivered_date != null) {
        await supabase
          .from("orders")
          .update({ status: "cumplido", updated_at: new Date().toISOString() })
          .eq("id", orderId);
      } else if (orderData?.status === "cumplido" && totalPaid < orderTotal - 0.01) {
        await supabase
          .from("orders")
          .update({ status: "confirmado", updated_at: new Date().toISOString() })
          .eq("id", orderId);
      }

      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar el cobro.");
      setSaving(false);
    }
  }

  const eligibleOrders = orders.filter(
    (o) => o.balance > 0.01 || (editPayment && o.id === editPayment.order_id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <DollarSign size={18} style={{ color: "#49789d" }} />
            <h2 className="font-semibold text-gray-900">{editPayment ? "Editar cobro" : "Registrar cobro"}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pedido <span className="text-red-500">*</span>
            </label>
            <select
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setAmount("");
                setDiscountType("none");
                setDiscountValueStr("");
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">— Seleccionar pedido —</option>
              {eligibleOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{String(o.order_number ?? "—").padStart(4, "0")} · {o.client_display} · Saldo: {fmt(o.balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto a cobrar</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step={1}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          {/* Descuento — solo al crear */}
          {!editPayment && selectedOrder && (
            <div className="space-y-3 border border-gray-100 rounded-lg p-4 bg-gray-50/60">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Descuento (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Tipo</label>
                  <select
                    value={discountType}
                    onChange={(e) => {
                      setDiscountType(e.target.value as "none" | "fixed" | "percentage");
                      setDiscountValueStr("");
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  >
                    <option value="none">Sin descuento</option>
                    <option value="fixed">Monto fijo ($)</option>
                    <option value="percentage">Porcentaje (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {discountType === "percentage" ? "Porcentaje" : "Valor"}
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
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
              </div>
              <div className="bg-white rounded-lg px-3 py-2.5 border border-gray-100 text-xs space-y-1">
                <div className="flex justify-between text-gray-500">
                  <span>Saldo pendiente</span>
                  <span className="font-medium text-gray-700">{fmtFull(availableBalance)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Descuento{discountType === "percentage" ? ` (${discountValue}%)` : ""}</span>
                    <span className="font-medium">− {fmtFull(discountAmt)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t border-gray-100 pt-1 text-gray-800">
                  <span>A cobrar</span>
                  <span style={{ color: "#49789d" }}>{fmtFull(Math.max(0, availableBalance - discountAmt))}</span>
                </div>
              </div>
            </div>
          )}

          {/* Info de descuento en modo edición */}
          {editPayment && editPayment.discount_amount && editPayment.discount_amount > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg px-4 py-2.5 text-xs text-orange-700">
              Este cobro incluye un descuento de <strong>{fmtFull(editPayment.discount_amount)}</strong>.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método</label>
            <div className="grid grid-cols-2 gap-2">
              {(["efectivo", "transferencia"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    method === m ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                  style={method === m ? { backgroundColor: "#49789d" } : undefined}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: "#49789d" }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando…" : editPayment ? "Guardar cambios" : "Registrar cobro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COBROS TAB
// ─────────────────────────────────────────────
function CobrosTab({
  payments, orders, loading, onRefresh,
}: {
  payments: PaymentWithMeta[];
  orders: OrderWithMeta[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const supabase = createClient();
  const [showModal, setShowModal] = useState(false);
  const [editPayment, setEditPayment] = useState<PaymentWithMeta | undefined>();
  const [deleting, setDeleting] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: paymentsSorted, sort, toggleSort } = useSortableData(payments as any[]);
  const sortedPayments = paymentsSorted as PaymentWithMeta[];

  async function handleDelete(payment: PaymentWithMeta) {
    if (!confirm("¿Eliminar este cobro?")) return;
    setDeleting(payment.id);
    await supabase.from("payments").delete().eq("id", payment.id);

    // Recalculate order status after deletion
    const [{ data: items }, { data: remaining }] = await Promise.all([
      supabase.from("order_items").select("quantity, unit_price").eq("order_id", payment.order_id),
      supabase.from("payments").select("amount, discount_amount").eq("order_id", payment.order_id),
    ]);
    const orderTotal = (items ?? []).reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
    const totalPaid = (remaining ?? []).reduce((acc, p) => acc + p.amount + (p.discount_amount ?? 0), 0);
    if (totalPaid < orderTotal - 0.01) {
      const { data: ord } = await supabase.from("orders").select("status").eq("id", payment.order_id).single();
      if (ord?.status === "cumplido") {
        await supabase.from("orders").update({ status: "confirmado", updated_at: new Date().toISOString() }).eq("id", payment.order_id);
      }
    }

    setDeleting(null);
    onRefresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{payments.length} cobro{payments.length !== 1 ? "s" : ""} registrados</p>
        <button
          onClick={() => { setEditPayment(undefined); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#49789d" }}
        >
          <Plus size={14} /> Registrar cobro
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <DollarSign size={36} className="mx-auto mb-2 text-gray-200" />
            <p>No hay cobros registrados todavía.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <SortableHeader label="Fecha" sortKey="date" sort={sort} onSort={toggleSort} className="px-5" />
                <SortableHeader label="Cliente" sortKey="client_display" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Pedido" sortKey="order_number" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                <SortableHeader label="Monto" sortKey="amount" sort={sort} onSort={toggleSort} align="right" />
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Descuento</th>
                <SortableHeader label="Método" sortKey="method" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedPayments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-gray-700">{fmtDate(p.date)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[160px] truncate">{p.client_display}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell font-mono">
                    #{String(p.order_number ?? "—").padStart(4, "0")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    {p.discount_amount && p.discount_amount > 0
                      ? <span className="text-orange-500 text-xs font-medium">− {fmt(p.discount_amount)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize hidden md:table-cell">{p.method}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => { setEditPayment(p); setShowModal(true); }}
                        className="text-gray-300 hover:text-blue-500 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        disabled={deleting === p.id}
                        className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      >
                        {deleting === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <PaymentModal
          orders={orders}
          editPayment={editPayment}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// ESTADO DE CUENTA TAB
// ─────────────────────────────────────────────
interface ClientBalance {
  client_id: string;
  client_display: string;
  total_billed: number;
  total_paid: number;
  balance: number;
  orders: OrderWithMeta[];
}

function EstadoCuentaTab({ orders, loading }: { orders: OrderWithMeta[]; loading: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Group by client
  const clientMap: Record<string, ClientBalance> = {};
  orders
    .filter((o) => o.client_id && o.balance > 0.01)
    .forEach((o) => {
      const key = o.client_id!;
      if (!clientMap[key]) {
        clientMap[key] = {
          client_id: key,
          client_display: o.client_display,
          total_billed: 0,
          total_paid: 0,
          balance: 0,
          orders: [],
        };
      }
      clientMap[key].total_billed += o.total;
      clientMap[key].total_paid += o.total_paid;
      clientMap[key].balance += o.balance;
      clientMap[key].orders.push(o);
    });

  const clients = Object.values(clientMap).sort((a, b) => b.balance - a.balance);

  return (
    <div>
      <div className="mb-5">
        <p className="text-sm text-gray-500">{clients.length} cliente{clients.length !== 1 ? "s" : ""} con saldo pendiente</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users size={36} className="mx-auto mb-2 text-gray-200" />
            <p>Todos los clientes están al día.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="w-8" />
                <th className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">Cliente</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Facturado</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">Cobrado</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Saldo pendiente</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <>
                  <tr
                    key={c.client_id}
                    onClick={() => setExpanded(expanded === c.client_id ? null : c.client_id)}
                    className="hover:bg-gray-50/60 cursor-pointer transition-colors border-b border-gray-50"
                  >
                    <td className="pl-4 py-3 text-gray-400">
                      {expanded === c.client_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{c.client_display}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{fmt(c.total_billed)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{fmt(c.total_paid)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{fmt(c.balance)}</td>
                  </tr>
                  {expanded === c.client_id && (
                    <tr key={`${c.client_id}-expand`} className="bg-gray-50/40">
                      <td colSpan={5} className="px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 uppercase">
                              <th className="text-left py-1">Pedido</th>
                              <th className="text-left py-1 hidden sm:table-cell">Fecha</th>
                              <th className="text-right py-1">Total</th>
                              <th className="text-right py-1">Cobrado</th>
                              <th className="text-right py-1">Saldo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {c.orders.map((o) => (
                              <tr
                                key={o.id}
                                onClick={(e) => { e.stopPropagation(); router.push(`/orders/${o.id}`); }}
                                className="hover:bg-gray-100 cursor-pointer transition-colors"
                              >
                                <td className="py-1.5 font-mono text-gray-700">#{String(o.order_number ?? "—").padStart(4, "0")}</td>
                                <td className="py-1.5 text-gray-500 hidden sm:table-cell">{fmtDate(o.order_date)}</td>
                                <td className="py-1.5 text-right text-gray-600">{fmt(o.total)}</td>
                                <td className="py-1.5 text-right text-gray-600">{fmt(o.total_paid)}</td>
                                <td className="py-1.5 text-right font-semibold text-red-600">{fmt(o.balance)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
function FinancesPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab | null) ?? "cobros";
  const [tab, setTab] = useState<Tab>(
    (["cobros", "estado", "resultado", "eventos"] as Tab[]).includes(initialTab as Tab)
      ? (initialTab as Tab)
      : "cobros"
  );
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderWithMeta[]>([]);
  const [payments, setPayments] = useState<PaymentWithMeta[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      { data: rawOrders },
      { data: rawPayments },
      { data: orderItems },
      { data: clients },
    ] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .in("status", ["confirmado", "cumplido"])
        .order("order_date", { ascending: false }),
      supabase.from("payments").select("*").order("date", { ascending: false }),
      supabase.from("order_items").select("order_id, quantity, unit_price"),
      supabase.from("clients").select("id, last_name, first_name"),
    ]);

    const clientMap: Record<string, string> = {};
    (clients ?? []).forEach((c) => { clientMap[c.id] = c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name; });

    // Totals per order
    const totalsMap: Record<string, number> = {};
    (orderItems ?? []).forEach((oi) => {
      totalsMap[oi.order_id] = (totalsMap[oi.order_id] ?? 0) + oi.quantity * oi.unit_price;
    });

    // Paid per order (amount + discounts)
    const paidMap: Record<string, number> = {};
    (rawPayments ?? []).forEach((p) => {
      paidMap[p.order_id] = (paidMap[p.order_id] ?? 0) + p.amount + (p.discount_amount ?? 0);
    });

    const ordersWithMeta: OrderWithMeta[] = (rawOrders ?? []).map((o) => {
      const total = totalsMap[o.id] ?? 0;
      const total_paid = paidMap[o.id] ?? 0;
      // Las ventas sin cargo (cortesía) nunca se cobran: no generan saldo pendiente.
      // El precio de venta sólo se usa para valorizar el EERR (venta + cortesía se netean).
      const balance =
        o.payment_method === "sin_cargo" ? 0 : Math.max(0, total - total_paid);
      return {
        ...o,
        total,
        total_paid,
        balance,
        client_display:
          o.client_id && clientMap[o.client_id]
            ? clientMap[o.client_id]
            : o.guest_name ?? "—",
      };
    });

    // Build order map for payment metadata
    const orderMap: Record<string, OrderWithMeta> = {};
    ordersWithMeta.forEach((o) => { orderMap[o.id] = o; });

    const paymentsWithMeta: PaymentWithMeta[] = (rawPayments ?? []).map((p) => ({
      ...p,
      order_number: orderMap[p.order_id]?.order_number ?? null,
      client_display: orderMap[p.order_id]?.client_display ?? "—",
    }));

    setOrders(ordersWithMeta);
    setPayments(paymentsWithMeta);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "cobros", label: "Cobros", icon: DollarSign },
    { id: "estado", label: "Estado de cuenta", icon: Users },
    { id: "resultado", label: "Resultado", icon: TrendingUp },
    { id: "eventos", label: "Eventos", icon: Calendar },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
        <p className="text-gray-500 mt-0.5">Cobros, deudas y resultado del emprendimiento</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm mb-6 w-fit">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
            style={tab === id ? { backgroundColor: "#49789d" } : undefined}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "cobros" && (
        <CobrosTab payments={payments} orders={orders} loading={loading} onRefresh={loadData} />
      )}
      {tab === "estado" && (
        <EstadoCuentaTab orders={orders} loading={loading} />
      )}
      {tab === "resultado" && (
        <ResultadoTab />
      )}
      {tab === "eventos" && (
        <EventosTab />
      )}
    </div>
  );
}

export default function FinancesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>}>
      <FinancesPageInner />
    </Suspense>
  );
}
