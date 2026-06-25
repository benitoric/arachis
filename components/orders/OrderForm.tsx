"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Loader2 } from "lucide-react";
import type { Database } from "@/lib/types/database";
import NewClientModal from "./NewClientModal";
import NewProductModal from "@/components/products/NewProductModal";
import NewCategoryModal from "@/components/expenses/NewCategoryModal";
import { pName } from "@/lib/utils/product";
import AutocompleteField, { ACOption } from "@/components/ui/AutocompleteField";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ExpenseCategory = Database["public"]["Tables"]["expense_categories"]["Row"];
type PriceType = "minorista" | "mayorista" | "otra";
type PaymentMethod = "efectivo" | "transferencia" | "sin_cargo" | "canje";

interface ProductWithPrices {
  id: string;
  name: string;
  price_minorista: number | null;
  price_mayorista: number | null;
}

interface ItemRow {
  tempId: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number | null;
}

interface OrderFormProps {
  initialData?: {
    id: string;
    order_number: number;
    order_date: string;
    client_id: string | null;
    desired_date: string | null;
    payment_method: PaymentMethod | null;
    delivery_method: "retiro" | "cadeteria" | "envio_gratis" | null;
    notes: string | null;
    status: string;
    items: {
      id: string;
      product_id: string;
      product_name: string;
      quantity: number;
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

let tempCounter = 0;
const nextId = () => `t-${++tempCounter}`;

export default function OrderForm({ initialData }: OrderFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEdit = !!initialData;

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<ProductWithPrices[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Header
  const [clientId, setClientId] = useState(initialData?.client_id ?? "");
  const [priceType, setPriceType] = useState<PriceType>("minorista");
  const [orderDate, setOrderDate] = useState(
    initialData?.order_date ?? new Date().toISOString().slice(0, 10)
  );
  const [desiredDate, setDesiredDate] = useState(initialData?.desired_date ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    initialData?.payment_method ?? ""
  );
  const [deliveryMethod, setDeliveryMethod] = useState<"retiro" | "cadeteria" | "envio_gratis" | "">(
    initialData?.delivery_method ?? ""
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  // Canje (sólo en modo creación)
  const [canjeCategoryId, setCanjeCategoryId] = useState("");
  const [canjeAmountStr, setCanjeAmountStr] = useState("");
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);

  // Items
  const [items, setItems] = useState<ItemRow[]>(
    initialData?.items.map((it) => ({
      tempId: nextId(),
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
    })) ?? []
  );
  const [selProductId, setSelProductId] = useState("");
  const [newQty, setNewQty] = useState("1");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showNewProductModal, setShowNewProductModal] = useState(false);

  const loadData = useCallback(async () => {
    const [{ data: cls }, { data: prods }, { data: costs }, { data: cats }] = await Promise.all([
      supabase.from("clients").select("*").eq("status", "active").order("last_name").order("first_name"),
      supabase.from("products").select("id, name, presentation").eq("active", true).order("name"),
      supabase.from("product_costs").select("product_id, price_minorista, price_mayorista"),
      supabase.from("expense_categories").select("*").order("name"),
    ]);

    setClients(cls ?? []);
    setCategories(cats ?? []);

    const costMap: Record<string, { price_minorista: number | null; price_mayorista: number | null }> = {};
    (costs ?? []).forEach((c) => { costMap[c.product_id] = c; });

    setProducts(
      (prods ?? []).map((p) => ({
        id: p.id,
        name: pName(p),
        price_minorista: costMap[p.id]?.price_minorista ?? null,
        price_mayorista: costMap[p.id]?.price_mayorista ?? null,
      }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  // Restore priceType from initial client
  useEffect(() => {
    if (initialData?.client_id && clients.length > 0) {
      const c = clients.find((cl) => cl.id === initialData.client_id);
      if (c) setPriceType(c.price_type as PriceType);
    }
  }, [clients, initialData?.client_id]);

  function handleClientChange(id: string) {
    setClientId(id);
    if (!id) return;
    const c = clients.find((cl) => cl.id === id);
    if (c) setPriceType(c.price_type as PriceType);
  }

  function handleClientCreated(newClient: Client) {
    setClients((prev) => [...prev, newClient].sort((a, b) => a.last_name.localeCompare(b.last_name)));
    setClientId(newClient.id);
    setPriceType(newClient.price_type as PriceType);
    setShowNewClientModal(false);
  }

  function handleProductCreated(product: ProductRow) {
    setProducts((prev) =>
      [...prev, { id: product.id, name: pName(product), price_minorista: null, price_mayorista: null }]
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setSelProductId(product.id);
    setShowNewProductModal(false);
  }

  function handleCategoryCreated(category: ExpenseCategory) {
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    setCanjeCategoryId(category.id);
    setShowNewCategoryModal(false);
  }

  function getPriceForType(p: ProductWithPrices, type: PriceType): number | null {
    if (type === "minorista") return p.price_minorista;
    if (type === "mayorista") return p.price_mayorista;
    return null; // "otra" — price must be defined manually per order
  }

  // Build product options dynamically based on current priceType
  const productOptions: ACOption[] = products.map((p) => {
    const price = getPriceForType(p, priceType);
    const sublabel =
      priceType === "otra"
        ? "precio a definir"
        : price && price > 0
        ? fmt(price)
        : "(sin precio)";
    return { id: p.id, label: p.name, sublabel };
  });

  const clientOptions: ACOption[] = clients.map((c) => ({
    id: c.id,
    label: c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name,
    sublabel: c.price_type,
  }));

  function handleAddItem() {
    if (!selProductId) return;
    const qty = parseFloat(newQty) || 1;
    const prod = products.find((p) => p.id === selProductId);
    if (!prod) return;

    setItems((prev) => [
      ...prev,
      {
        tempId: nextId(),
        product_id: prod.id,
        product_name: prod.name,
        quantity: qty,
        unit_price: getPriceForType(prod, priceType),
      },
    ]);
    setSelProductId("");
    setNewQty("1");
  }

  function handleRemoveItem(tempId: string) {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }

  function handleQtyChange(tempId: string, val: string) {
    const qty = parseFloat(val) || 0;
    setItems((prev) => prev.map((it) => it.tempId === tempId ? { ...it, quantity: qty } : it));
  }

  function handlePriceChange(tempId: string, val: string) {
    const price = val === "" ? null : parseFloat(val) ?? null;
    setItems((prev) => prev.map((it) => it.tempId === tempId ? { ...it, unit_price: price } : it));
  }

  const total = items.reduce((acc, it) => acc + it.quantity * (it.unit_price ?? 0), 0);

  const canjeAmount = parseFloat(canjeAmountStr) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError("Seleccioná un cliente."); return; }
    if (items.length === 0) { setError("Agregá al menos un artículo."); return; }
    if (!paymentMethod) { setError("Seleccioná la modalidad de pago."); return; }
    if (!deliveryMethod) { setError("Seleccioná la modalidad de entrega."); return; }
    if (!isEdit && paymentMethod === "canje") {
      if (!canjeCategoryId) { setError("Seleccioná el rubro de gasto para el canje."); return; }
      if (canjeAmount <= 0) { setError("Ingresá un importe de canje válido."); return; }
      if (canjeAmount > total + 0.01) { setError("El importe del canje no puede superar el total del pedido."); return; }
    }

    setSaving(true);
    setError("");

    const payload = {
      client_id: clientId || null,
      order_date: orderDate,
      desired_date: desiredDate || null,
      payment_method: paymentMethod as PaymentMethod,
      delivery_method: deliveryMethod as "retiro" | "cadeteria" | "envio_gratis",
      notes: notes.trim() || null,
    };

    try {
      if (isEdit && initialData) {
        const { error: err } = await supabase
          .from("orders")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", initialData.id);
        if (err) throw err;

        await supabase.from("order_items").delete().eq("order_id", initialData.id);
        const { error: itemErr } = await supabase.from("order_items").insert(
          items.map((it) => ({
            order_id: initialData.id,
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: it.unit_price ?? 0,
          }))
        );
        if (itemErr) throw itemErr;

        router.push(`/orders/${initialData.id}`);
      } else {
        const { data: newOrder, error: err } = await supabase
          .from("orders")
          .insert({ ...payload, origin: "manual" as const, status: "confirmado" })
          .select("id, order_number")
          .single();
        if (err) throw err;

        const { error: itemErr } = await supabase.from("order_items").insert(
          items.map((it) => ({
            order_id: newOrder!.id,
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: it.unit_price ?? 0,
          }))
        );
        if (itemErr) throw itemErr;

        // Canje: registrar pago + imputación al rubro de gasto seleccionado
        if (paymentMethod === "canje") {
          const clientLabel = (() => {
            const c = clients.find((cl) => cl.id === clientId);
            return c ? (c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name) : "—";
          })();
          const orderNum = String(newOrder!.order_number ?? "—").padStart(4, "0");

          const { error: payErr } = await supabase.from("payments").insert({
            order_id: newOrder!.id,
            date: orderDate,
            amount: canjeAmount,
            method: "canje",
          });
          if (payErr) throw payErr;

          const { error: expErr } = await supabase.from("indirect_expenses").insert({
            date: orderDate,
            category_id: canjeCategoryId,
            description: `Canje pedido #${orderNum} - ${clientLabel}`,
            amount: canjeAmount,
          });
          if (expErr) throw expErr;
        }

        router.push(`/orders/${newOrder!.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar el pedido.");
      setSaving(false);
    }
  }

  return (
    <>
      {showNewClientModal && (
        <NewClientModal
          onClose={() => setShowNewClientModal(false)}
          onCreated={handleClientCreated}
        />
      )}
      {showNewProductModal && (
        <NewProductModal
          onClose={() => setShowNewProductModal(false)}
          onCreated={handleProductCreated}
        />
      )}
      {showNewCategoryModal && (
        <NewCategoryModal
          onClose={() => setShowNewCategoryModal(false)}
          onCreated={handleCategoryCreated}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* ── ENCABEZADO ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Datos del pedido</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Cargando clientes…
                </div>
              ) : (
                <AutocompleteField
                  options={clientOptions}
                  value={clientId}
                  onChange={handleClientChange}
                  placeholder="Buscar cliente…"
                  onCreateNew={() => setShowNewClientModal(true)}
                  createNewLabel="cliente"
                />
              )}
            </div>
            {clientId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lista de precios</label>
                <div className="flex gap-2">
                  {(["minorista", "mayorista", "otra"] as PriceType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setPriceType(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                        priceType === t ? "text-white border-transparent" : "text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                      style={priceType === t ? { backgroundColor: "#a9760a" } : undefined}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del pedido</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha deseada de entrega</label>
              <input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modalidad de pago <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">— Seleccionar —</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="sin_cargo">Sin cargo</option>
                <option value="canje">Canje</option>
              </select>
            </div>

            {/* Canje: rubro de gasto + importe (sólo en creación) */}
            {!isEdit && paymentMethod === "canje" && (
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                <div className="sm:col-span-2">
                  <p className="text-xs text-amber-800 mb-3">
                    Imputá el canje a un rubro de gasto. Si el importe iguala al total del pedido,
                    el pedido quedará cumplido al cargar la fecha de entrega.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Importe del canje <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={canjeAmountStr}
                      onChange={(e) => setCanjeAmountStr(e.target.value)}
                      min={0.01}
                      step={0.01}
                      placeholder="0.00"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                    <button
                      type="button"
                      onClick={() => setCanjeAmountStr(String(Math.round(total * 100) / 100))}
                      disabled={total <= 0}
                      className="px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      title="Usar total del pedido"
                    >
                      = total
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Modalidad de entrega <span className="text-red-500">*</span>
              </label>
              <select
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value as "retiro" | "cadeteria" | "envio_gratis")}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="">— Seleccionar —</option>
                <option value="retiro">Retiro en local</option>
                <option value="cadeteria">Cadetería</option>
                <option value="envio_gratis">Envío gratis</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas / pedidos especiales</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Indicaciones adicionales…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
              />
            </div>
          </div>
        </section>

        {/* ── ARTÍCULOS ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Detalle del pedido</h2>

          <div className="flex gap-3 mb-4 flex-wrap">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" /> Cargando artículos…
              </div>
            ) : (
              <>
                <AutocompleteField
                  options={productOptions}
                  value={selProductId}
                  onChange={setSelProductId}
                  placeholder="Buscar artículo…"
                  onCreateNew={() => setShowNewProductModal(true)}
                  createNewLabel="artículo"
                  className="flex-1 min-w-[200px]"
                />
                <input
                  type="number"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  min={1}
                  step={1}
                  placeholder="Cant."
                  className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selProductId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "#a9760a" }}
                >
                  <Plus size={15} /> Agregar
                </button>
              </>
            )}
          </div>

          {items.length > 0 ? (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="text-left px-4 py-2.5">Artículo</th>
                    <th className="text-center px-3 py-2.5 w-24">Cantidad</th>
                    <th className="text-right px-3 py-2.5 w-36">Precio unit.</th>
                    <th className="text-right px-3 py-2.5 w-36">Subtotal</th>
                    <th className="w-10" />
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
                          min={1}
                          className="w-16 border border-gray-200 rounded px-2 py-1 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          value={it.unit_price ?? ""}
                          onChange={(e) => handlePriceChange(it.tempId, e.target.value)}
                          min={0}
                          step={1}
                          placeholder={priceType === "otra" ? "0,00" : undefined}
                          className="w-28 border border-gray-200 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-200"
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900">
                        {fmt(it.quantity * (it.unit_price ?? 0))}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.tempId)}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/50 border-t border-gray-100">
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-700 text-sm">
                      Total del pedido
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-gray-900" style={{ color: "#a9760a" }}>
                      {fmt(total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
              Todavía no agregaste artículos al pedido
            </div>
          )}
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
            style={{ backgroundColor: "#a9760a" }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? "Guardar cambios" : "Crear pedido"}
          </button>
        </div>
      </form>
    </>
  );
}
