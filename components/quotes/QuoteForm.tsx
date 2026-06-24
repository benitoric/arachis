"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { Database } from "@/lib/types/database";
import AutocompleteField, { ACOption } from "@/components/ui/AutocompleteField";
import NewProductModal from "@/components/products/NewProductModal";

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];

interface ProductWithCost extends Product {
  direct_cost: number;
}

interface QuoteItemRow {
  tempId: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
}

interface QuoteFormProps {
  initialData?: {
    id: string;
    quote_number: number;
    date: string;
    status: "borrador" | "enviado" | "aceptado" | "rechazado";
    client_name: string;
    client_first_name: string | null;
    client_last_name: string | null;
    client_phone: string | null;
    client_email: string | null;
    event_date: string | null;
    event_type: string | null;
    estimated_guests: number | null;
    margin_percentage: number;
    labor_cost: number;
    extra_charge_amount: number;
    extra_charge_description: string | null;
    final_price: number;
    validity_days: number;
    payment_terms: string | null;
    notes: string | null;
    items: {
      id: string;
      product_id: string;
      product_name: string;
      quantity: number;
      unit_cost: number;
      unit_price: number;
    }[];
  };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

let tempIdCounter = 0;
function newTempId() {
  return `tmp-${++tempIdCounter}`;
}

export default function QuoteForm({ initialData }: QuoteFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const isEdit = !!initialData;

  // Products catalog
  const [products, setProducts] = useState<ProductWithCost[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  // Header fields
  const [date, setDate] = useState(initialData?.date ?? new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<QuoteInsert["status"]>(initialData?.status ?? "borrador");
  const [clientFirstName, setClientFirstName] = useState(initialData?.client_first_name ?? "");
  const [clientLastName, setClientLastName] = useState(
    initialData?.client_last_name ?? initialData?.client_name ?? ""
  );
  const [clientPhone, setClientPhone] = useState(initialData?.client_phone ?? "");
  const [clientEmail, setClientEmail] = useState(initialData?.client_email ?? "");

  // Event fields
  const [eventDate, setEventDate] = useState(initialData?.event_date ?? "");
  const [eventType, setEventType] = useState(initialData?.event_type ?? "");
  const [estimatedGuests, setEstimatedGuests] = useState<string>(
    initialData?.estimated_guests != null ? String(initialData.estimated_guests) : ""
  );

  // Items
  const [items, setItems] = useState<QuoteItemRow[]>(
    initialData?.items.map((it) => ({
      tempId: newTempId(),
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_cost: it.unit_cost,
      unit_price: it.unit_price,
    })) ?? []
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [newQty, setNewQty] = useState("1");

  // Pricing
  const [marginPct, setMarginPct] = useState<string>(
    String(initialData?.margin_percentage ?? 100)
  );
  const [laborCost, setLaborCost] = useState<string>(
    String(initialData?.labor_cost ?? 0)
  );
  const [extraAmount, setExtraAmount] = useState<string>(
    String(initialData?.extra_charge_amount ?? 0)
  );
  const [extraDesc, setExtraDesc] = useState(initialData?.extra_charge_description ?? "");
  const [finalPriceStr, setFinalPriceStr] = useState<string>(
    String(initialData?.final_price ?? 0)
  );

  // Conditions
  const [validityDays, setValidityDays] = useState<string>(
    String(initialData?.validity_days ?? 15)
  );
  const [paymentTerms, setPaymentTerms] = useState(initialData?.payment_terms ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCostDetail, setShowCostDetail] = useState(false);

  // ── Load products + direct costs ────────────────────────────────
  const loadProducts = useCallback(async () => {
    const [{ data: prods }, { data: costs }] = await Promise.all([
      supabase.from("products").select("*").eq("active", true).order("name"),
      supabase.from("product_costs").select("product_id, direct_cost"),
    ]);

    const costMap: Record<string, number> = {};
    (costs ?? []).forEach((c) => {
      if (c.direct_cost != null) costMap[c.product_id] = c.direct_cost;
    });

    setProducts(
      (prods ?? []).map((p) => ({ ...p, direct_cost: costMap[p.id] ?? 0 }))
    );
    setLoadingProducts(false);
  }, [supabase]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ── Derived totals ───────────────────────────────────────────────
  const totalDirectCost = items.reduce(
    (acc, it) => acc + it.unit_cost * it.quantity,
    0
  );

  const margin = parseFloat(marginPct) || 0;
  const labor = parseFloat(laborCost) || 0;
  const extra = parseFloat(extraAmount) || 0;

  const subtotalWithMargin = totalDirectCost * (1 + margin / 100);
  const calculatedTotal = subtotalWithMargin + labor + extra;

  const [finalPriceLocked, setFinalPriceLocked] = useState(isEdit);

  useEffect(() => {
    if (!finalPriceLocked) {
      setFinalPriceStr(calculatedTotal.toFixed(2));
    }
  }, [calculatedTotal, finalPriceLocked]);

  // ── Product options ──────────────────────────────────────────────
  const productOptions: ACOption[] = products.map((p) => ({
    id: p.id,
    label: p.name,
    sublabel: p.direct_cost > 0 ? `costo: ${fmt(p.direct_cost)}` : undefined,
  }));

  // ── Add item ────────────────────────────────────────────────────
  function handleAddItem() {
    if (!selectedProductId) return;
    const qty = parseFloat(newQty) || 1;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    const unitCost = prod.direct_cost;
    const unitPrice = unitCost * (1 + margin / 100);

    setItems((prev) => [
      ...prev,
      {
        tempId: newTempId(),
        product_id: prod.id,
        product_name: prod.name,
        quantity: qty,
        unit_cost: unitCost,
        unit_price: unitPrice,
      },
    ]);
    setSelectedProductId("");
    setNewQty("1");
    setFinalPriceLocked(false);
  }

  function handleRemoveItem(tempId: string) {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
    setFinalPriceLocked(false);
  }

  function handleQtyChange(tempId: string, value: string) {
    const qty = parseFloat(value) || 0;
    setItems((prev) =>
      prev.map((it) =>
        it.tempId === tempId ? { ...it, quantity: qty } : it
      )
    );
    setFinalPriceLocked(false);
  }

  function handleMarginChange(val: string) {
    setMarginPct(val);
    const m = parseFloat(val) || 0;
    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        unit_price: it.unit_cost * (1 + m / 100),
      }))
    );
    setFinalPriceLocked(false);
  }

  function handleProductCreated(product: ProductRow) {
    const newProd: ProductWithCost = { ...product, direct_cost: 0 };
    setProducts((prev) =>
      [...prev, newProd].sort((a, b) => a.name.localeCompare(b.name))
    );
    setSelectedProductId(product.id);
    setShowNewProductModal(false);
  }

  // ── Save ─────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientLastName.trim()) {
      setError("El apellido del cliente es obligatorio.");
      return;
    }
    if (items.length === 0) {
      setError("Agregá al menos un artículo al presupuesto.");
      return;
    }

    setSaving(true);
    setError("");

    const finalPrice = parseFloat(finalPriceStr) || 0;

    try {
      if (isEdit && initialData) {
        const displayName = clientFirstName.trim()
          ? `${clientLastName.trim()}, ${clientFirstName.trim()}`
          : clientLastName.trim();

        const { error: updErr } = await supabase
          .from("quotes")
          .update({
            date,
            status: status!,
            client_name: displayName,
            client_first_name: clientFirstName.trim() || null,
            client_last_name: clientLastName.trim(),
            client_phone: clientPhone.trim() || null,
            client_email: clientEmail.trim() || null,
            event_date: eventDate || null,
            event_type: eventType.trim() || null,
            estimated_guests: estimatedGuests ? parseInt(estimatedGuests) : null,
            margin_percentage: parseFloat(marginPct) || 0,
            labor_cost: labor,
            extra_charge_amount: extra,
            extra_charge_description: extraDesc.trim() || null,
            final_price: finalPrice,
            validity_days: parseInt(validityDays) || 15,
            payment_terms: paymentTerms.trim() || null,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialData.id);

        if (updErr) throw updErr;

        await supabase.from("quote_items").delete().eq("quote_id", initialData.id);

        const itemRows = items.map((it) => ({
          quote_id: initialData.id,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          unit_price: it.unit_price,
        }));
        const { error: itemErr } = await supabase.from("quote_items").insert(itemRows);
        if (itemErr) throw itemErr;

        router.push(`/quotes/${initialData.id}`);
      } else {
        const { data: maxRow } = await supabase
          .from("quotes")
          .select("quote_number")
          .order("quote_number", { ascending: false })
          .limit(1)
          .single();

        const nextNumber = (maxRow?.quote_number ?? 0) + 1;

        const displayName = clientFirstName.trim()
          ? `${clientLastName.trim()}, ${clientFirstName.trim()}`
          : clientLastName.trim();

        const { data: newQuote, error: insErr } = await supabase
          .from("quotes")
          .insert({
            quote_number: nextNumber,
            date,
            status: status ?? "borrador",
            client_name: displayName,
            client_first_name: clientFirstName.trim() || null,
            client_last_name: clientLastName.trim(),
            client_phone: clientPhone.trim() || null,
            client_email: clientEmail.trim() || null,
            event_date: eventDate || null,
            event_type: eventType.trim() || null,
            estimated_guests: estimatedGuests ? parseInt(estimatedGuests) : null,
            margin_percentage: parseFloat(marginPct) || 0,
            labor_cost: labor,
            extra_charge_amount: extra,
            extra_charge_description: extraDesc.trim() || null,
            final_price: finalPrice,
            validity_days: parseInt(validityDays) || 15,
            payment_terms: paymentTerms.trim() || null,
            notes: notes.trim() || null,
          })
          .select("id")
          .single();

        if (insErr) throw insErr;

        const itemRows = items.map((it) => ({
          quote_id: newQuote!.id,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_cost: it.unit_cost,
          unit_price: it.unit_price,
        }));
        const { error: itemErr } = await supabase.from("quote_items").insert(itemRows);
        if (itemErr) throw itemErr;

        router.push(`/quotes/${newQuote!.id}`);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : (err as { message?: string }).message ?? "Error al guardar el presupuesto."
      );
      setSaving(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      {showNewProductModal && (
        <NewProductModal
          onClose={() => setShowNewProductModal(false)}
          onCreated={handleProductCreated}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* ── ENCABEZADO ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Encabezado
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                value={status ?? "borrador"}
                onChange={(e) => setStatus(e.target.value as QuoteInsert["status"])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="borrador">Borrador</option>
                <option value="enviado">Enviado</option>
                <option value="aceptado">Aceptado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vigencia (días)</label>
              <input
                type="number"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                min={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </section>

        {/* ── DATOS DEL CLIENTE ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Datos del cliente
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Apellido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={clientLastName}
                onChange={(e) => setClientLastName(e.target.value)}
                placeholder="Apellido"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                value={clientFirstName}
                onChange={(e) => setClientFirstName(e.target.value)}
                placeholder="Nombre"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="381 XXX-XXXX"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </section>

        {/* ── DATOS DEL EVENTO ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Datos del evento (opcional)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
              <input
                type="text"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                placeholder="Casamiento, cumpleaños…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del evento</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Personas estimadas</label>
              <input
                type="number"
                value={estimatedGuests}
                onChange={(e) => setEstimatedGuests(e.target.value)}
                min={1}
                placeholder="100"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </section>

        {/* ── ARTÍCULOS ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Artículos de la mesa dulce
          </h2>

          <div className="flex gap-3 mb-4 flex-wrap">
            {loadingProducts ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                Cargando artículos…
              </div>
            ) : (
              <>
                <AutocompleteField
                  options={productOptions}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  placeholder="Buscar artículo…"
                  onCreateNew={() => setShowNewProductModal(true)}
                  createNewLabel="artículo"
                  className="flex-1 min-w-[200px]"
                />
                <input
                  type="number"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  min={0.01}
                  step={0.01}
                  placeholder="Cant."
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProductId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "#49789d" }}
                >
                  <Plus size={15} />
                  Agregar
                </button>
              </>
            )}
          </div>

          {items.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5">Artículo</th>
                    <th className="text-center px-3 py-2.5">Cantidad</th>
                    <th className="text-right px-3 py-2.5">Costo unit.</th>
                    <th className="text-right px-3 py-2.5">Precio unit.</th>
                    <th className="text-right px-3 py-2.5">Subtotal</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((it) => (
                    <tr key={it.tempId} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900">{it.product_name}</td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) => handleQtyChange(it.tempId, e.target.value)}
                          min={0.01}
                          step={0.01}
                          className="w-20 border border-gray-200 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                      </td>
                      <td className="px-3 py-3 text-right text-gray-500">{fmt(it.unit_cost)}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{fmt(it.unit_price)}</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">
                        {fmt(it.unit_price * it.quantity)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.tempId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
              Todavía no agregaste artículos
            </div>
          )}
        </section>

        {/* ── COSTOS Y PRECIO ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Costos y precio
            </h2>
            <button
              type="button"
              onClick={() => setShowCostDetail(!showCostDetail)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showCostDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showCostDetail ? "Ocultar detalle" : "Ver detalle"}
            </button>
          </div>

          {showCostDetail && (
            <div className="bg-blue-50/40 rounded-lg p-4 mb-4 text-sm space-y-1.5">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal costo directo</span>
                <span className="font-medium">{fmt(totalDirectCost)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Margen ({marginPct}%)</span>
                <span className="font-medium">{fmt(subtotalWithMargin)}</span>
              </div>
              {labor > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Mano de obra</span>
                  <span className="font-medium">{fmt(labor)}</span>
                </div>
              )}
              {extra > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>{extraDesc || "Cargos adicionales"}</span>
                  <span className="font-medium">{fmt(extra)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-blue-100">
                <span>Total calculado</span>
                <span>{fmt(calculatedTotal)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Margen sobre costo (%)
              </label>
              <input
                type="number"
                value={marginPct}
                onChange={(e) => handleMarginChange(e.target.value)}
                min={0}
                step={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mano de obra (ARS)
              </label>
              <input
                type="number"
                value={laborCost}
                onChange={(e) => { setLaborCost(e.target.value); setFinalPriceLocked(false); }}
                min={0}
                step={100}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo adicional (ARS)
              </label>
              <input
                type="number"
                value={extraAmount}
                onChange={(e) => { setExtraAmount(e.target.value); setFinalPriceLocked(false); }}
                min={0}
                step={100}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción del cargo adicional
              </label>
              <input
                type="text"
                value={extraDesc}
                onChange={(e) => setExtraDesc(e.target.value)}
                placeholder="Ej: Entrega a domicilio"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div className="mt-4 flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio final (editable)
              </label>
              <input
                type="number"
                value={finalPriceStr}
                onChange={(e) => { setFinalPriceStr(e.target.value); setFinalPriceLocked(true); }}
                min={0}
                step={100}
                className="w-full border-2 border-blue-200 rounded-lg px-3 py-2.5 text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            {finalPriceLocked && (
              <button
                type="button"
                onClick={() => { setFinalPriceStr(calculatedTotal.toFixed(2)); setFinalPriceLocked(false); }}
                className="text-xs text-blue-500 hover:text-blue-700 mb-2.5 whitespace-nowrap"
              >
                Restaurar calculado
              </button>
            )}
          </div>
          {finalPriceLocked && (
            <p className="text-xs text-amber-600 mt-1">
              El precio fue modificado manualmente. El total calculado es {fmt(calculatedTotal)}.
            </p>
          )}
        </section>

        {/* ── CONDICIONES ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Condiciones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modalidad de pago
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="Ej: 50% al confirmar, resto el día del evento"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas internas / para el cliente
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Observaciones adicionales…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              />
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="flex gap-3 justify-end pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: "#49789d" }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear presupuesto"}
          </button>
        </div>
      </form>
    </>
  );
}
