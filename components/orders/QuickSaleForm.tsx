"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Minus, Plus, Search } from "lucide-react";
import type { Database } from "@/lib/types/database";
import NewClientModal from "./NewClientModal";
import { pName } from "@/lib/utils/product";
import AutocompleteField, { ACOption } from "@/components/ui/AutocompleteField";

type Client = Database["public"]["Tables"]["clients"]["Row"];

interface ProductOption {
  id: string;
  name: string;
  price: number | null; // lista minorista
}

type BuyerMode = "libre" | "cliente";

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

export default function QuickSaleForm() {
  const router = useRouter();
  const supabase = createClient();

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Artículos: cantidades por producto
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");

  // Comprador
  const [buyerMode, setBuyerMode] = useState<BuyerMode>("libre");
  const [guestName, setGuestName] = useState("");
  const [clientId, setClientId] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  // Cobro
  const [method, setMethod] = useState<"efectivo" | "transferencia">("efectivo");
  const [cobrado, setCobrado] = useState(true);
  const [amountStr, setAmountStr] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
  const [discountValueStr, setDiscountValueStr] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const [{ data: cls }, { data: prods }, { data: costs }] = await Promise.all([
      supabase.from("clients").select("*").eq("status", "active").order("last_name").order("first_name"),
      supabase.from("products").select("id, name, presentation").eq("active", true).order("name"),
      supabase.from("product_costs").select("product_id, price_minorista"),
    ]);
    setClients(cls ?? []);
    const priceMap: Record<string, number | null> = {};
    (costs ?? []).forEach((c) => { priceMap[c.product_id] = c.price_minorista; });
    setProducts(
      (prods ?? []).map((p) => ({ id: p.id, name: pName(p), price: priceMap[p.id] ?? null }))
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  function addQty(id: string, delta: number) {
    setQtys((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  const items = products.filter((p) => (qtys[p.id] ?? 0) > 0);
  const itemCount = items.reduce((acc, p) => acc + (qtys[p.id] ?? 0), 0);
  const total = items.reduce((acc, p) => acc + (qtys[p.id] ?? 0) * (p.price ?? 0), 0);

  const discountValue = parseFloat(discountValueStr) || 0;
  const discountAmt =
    discountType === "percentage"
      ? Math.max(0, Math.min((total * discountValue) / 100, total))
      : discountType === "fixed"
      ? Math.max(0, Math.min(discountValue, total))
      : 0;

  // El monto a cobrar sigue al total menos el descuento hasta que el usuario lo edite a mano
  useEffect(() => {
    if (!amountTouched) {
      setAmountStr(total > 0 ? String(Math.round(Math.max(0, total - discountAmt))) : "");
    }
  }, [total, discountAmt, amountTouched]);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const clientOptions: ACOption[] = clients.map((c) => ({
    id: c.id,
    label: c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name,
    sublabel: c.price_type,
  }));

  function handleClientCreated(newClient: Client) {
    setClients((prev) =>
      [...prev, newClient].sort((a, b) => a.last_name.localeCompare(b.last_name))
    );
    setClientId(newClient.id);
    setShowNewClientModal(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { setError("Agregá al menos un artículo."); return; }
    if (buyerMode === "cliente" && !clientId) {
      setError("Seleccioná un cliente o volvé a “Campo libre”.");
      return;
    }
    const amt = cobrado ? parseFloat(amountStr) || 0 : 0;
    if (cobrado) {
      if (amt + discountAmt <= 0) { setError("Ingresá un monto válido."); return; }
      if (amt + discountAmt > total + 0.01) {
        setError(`El cobro más el descuento supera el total de la venta (${fmt(total)}).`);
        return;
      }
    }

    setSaving(true);
    setError("");

    const today = new Date().toISOString().slice(0, 10);
    const fullyPaid = cobrado && amt + discountAmt >= total - 0.01;

    try {
      const { data: newOrder, error: err } = await supabase
        .from("orders")
        .insert({
          client_id: buyerMode === "cliente" ? clientId : null,
          guest_name: buyerMode === "libre" ? guestName.trim() || null : null,
          order_date: today,
          desired_date: today,
          delivered_date: today,
          payment_method: method,
          delivery_method: "retiro",
          status: "confirmado",
          origin: "venta_rapida",
          notes: notes.trim() || null,
        })
        .select("id, order_number")
        .single();
      if (err) throw err;

      const { error: itemErr } = await supabase.from("order_items").insert(
        items.map((p) => ({
          order_id: newOrder!.id,
          product_id: p.id,
          quantity: qtys[p.id],
          unit_price: p.price ?? 0,
        }))
      );
      if (itemErr) throw itemErr;

      if (cobrado) {
        const dType = discountType !== "none" && discountAmt > 0 ? discountType : null;
        const { error: payErr } = await supabase.from("payments").insert({
          order_id: newOrder!.id,
          date: today,
          amount: amt,
          method,
          discount_type: dType,
          discount_value: dType ? discountValue : null,
          discount_amount: dType ? discountAmt : null,
        });
        if (payErr) throw payErr;

        // Registrar el descuento como gasto indirecto (misma lógica que el modal de cobros)
        if (dType && discountAmt > 0) {
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
            const orderNum = String(newOrder!.order_number ?? "—").padStart(4, "0");
            const buyerLabel =
              buyerMode === "cliente"
                ? clientOptions.find((o) => o.id === clientId)?.label ?? "—"
                : guestName.trim() || "Venta rápida";
            await supabase.from("indirect_expenses").insert({
              date: today,
              category_id: catId,
              description: `Descuento pedido #${orderNum} - ${buyerLabel}`,
              amount: discountAmt,
            });
          }
        }

        // Entregado + saldo cancelado → cumplido
        if (fullyPaid) {
          await supabase
            .from("orders")
            .update({ status: "cumplido", updated_at: new Date().toISOString() })
            .eq("id", newOrder!.id);
        }
      }

      router.push(`/orders/${newOrder!.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al registrar la venta.");
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
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* ── ARTÍCULOS ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Artículos</h2>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 size={14} className="animate-spin" /> Cargando artículos…
            </div>
          ) : (
            <>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar artículo…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {filteredProducts.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-6">Sin resultados</p>
                ) : (
                  filteredProducts.map((p) => {
                    const qty = qtys[p.id] ?? 0;
                    const noPrice = !p.price || p.price <= 0;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                          qty > 0 ? "bg-blue-50/50" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                          <p className="text-xs text-gray-500">
                            {noPrice ? "Sin precio minorista" : fmt(p.price!)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => addQty(p.id, -1)}
                            disabled={qty === 0}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                          >
                            <Minus size={15} />
                          </button>
                          <span className={`w-8 text-center text-sm font-semibold ${qty > 0 ? "text-gray-900" : "text-gray-300"}`}>
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => addQty(p.id, 1)}
                            disabled={noPrice}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-white disabled:opacity-30 transition-colors"
                            style={{ backgroundColor: "#a9760a" }}
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between mt-3 px-1 text-sm">
                <span className="text-gray-500">
                  {itemCount} artículo{itemCount !== 1 ? "s" : ""}
                </span>
                <span className="font-bold" style={{ color: "#a9760a" }}>{fmt(total)}</span>
              </div>
            </>
          )}
        </section>

        {/* ── COMPRADOR ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Comprador <span className="font-normal normal-case text-gray-400">(opcional)</span>
          </h2>

          <div className="flex gap-2 mb-4">
            {([
              ["libre", "Campo libre"],
              ["cliente", "Cliente"],
            ] as [BuyerMode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setBuyerMode(m)}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  buyerMode === m ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={buyerMode === m ? { backgroundColor: "#a9760a" } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          {buyerMode === "libre" ? (
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Ej: Compañeros del gimnasio"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
              <Loader2 size={14} className="animate-spin" /> Cargando clientes…
            </div>
          ) : (
            <AutocompleteField
              options={clientOptions}
              value={clientId}
              onChange={setClientId}
              placeholder="Buscar cliente…"
              onCreateNew={() => setShowNewClientModal(true)}
              createNewLabel="cliente"
            />
          )}
        </section>

        {/* ── COBRO ── */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Cobro</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
              <div className="flex gap-2">
                {(["efectivo", "transferencia"] as const).map((m) => (
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado del cobro</label>
              <div className="flex gap-2">
                {([
                  [true, "Cobrado"],
                  [false, "Queda pendiente"],
                ] as [boolean, string][]).map(([v, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setCobrado(v)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      cobrado === v ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                    style={cobrado === v ? { backgroundColor: v ? "#a9760a" : "#d97706" } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {cobrado ? (
            <div className="mt-4 space-y-3 border border-gray-100 rounded-lg p-4 bg-gray-50/60">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Descuento</label>
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
                  <span>Total de la venta</span>
                  <span className="font-medium text-gray-700">{fmt(total)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Descuento{discountType === "percentage" ? ` (${discountValue}%)` : ""}</span>
                    <span className="font-medium">− {fmt(discountAmt)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-semibold border-t border-gray-100 pt-2 text-gray-800">
                  <span>Monto cobrado</span>
                  <input
                    type="number"
                    value={amountStr}
                    onChange={(e) => { setAmountTouched(true); setAmountStr(e.target.value); }}
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    className="w-32 border border-gray-200 rounded-lg px-2 py-1.5 text-right text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-200"
                    style={{ color: "#a9760a" }}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Si cobrás un monto menor, la diferencia queda como saldo pendiente del pedido.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
              El total ({fmt(total)}) quedará como saldo pendiente. Lo podés cobrar después desde el detalle del pedido.
            </p>
          )}

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: venta en clase de gimnasia"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </section>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

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
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: "#a9760a" }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Registrar venta
          </button>
        </div>
      </form>
    </>
  );
}
