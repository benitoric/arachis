"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Loader2, Truck } from "lucide-react";
import type { Database } from "@/lib/types/database";
import AutocompleteField, { ACOption } from "@/components/ui/AutocompleteField";
import TextSuggestField from "@/components/ui/TextSuggestField";
import NewMaterialModal from "@/components/materials/NewMaterialModal";

type Material = Database["public"]["Tables"]["materials"]["Row"];

interface PurchaseItem {
  tempId: string;
  material_id: string;
  brand: string;
  quantity: string;
  item_cost: string;
}

interface InitialData {
  id: string;
  date: string;
  delivery_date?: string | null;
  supplier: string | null;
  brand?: string | null;
  material_id: string;
  quantity: number;
  total_cost: number;
  shipping_cost_share?: number | null;
}

interface Props {
  mode: "create" | "edit";
  initialData?: InitialData;
}

let tc = 0;
const nextTempId = () => `item-${++tc}`;

const fmtNum = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

export default function PurchaseForm({ mode, initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(initialData?.date ?? today);
  const [deliveryDate, setDeliveryDate] = useState(initialData?.delivery_date ?? "");
  const [supplier, setSupplier] = useState(initialData?.supplier ?? "");
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false);
  // For create mode: which row triggered the modal
  const [modalCallbackIdx, setModalCallbackIdx] = useState<number | null>(null);

  // Create mode (seed first item from initialData when duplicating).
  // Source `total_cost` already includes the `shipping_cost_share`, so we
  // back out the shipping portion to keep both fields accurate.
  const _seedShipping = mode === "create" && initialData?.shipping_cost_share != null
    ? Number(initialData.shipping_cost_share) || 0
    : 0;
  const _seedItemCost = mode === "create" && initialData
    ? Math.max(0, (Number(initialData.total_cost) || 0) - _seedShipping)
    : 0;

  const [items, setItems] = useState<PurchaseItem[]>(() => {
    if (mode === "create" && initialData) {
      return [{
        tempId: nextTempId(),
        material_id: initialData.material_id,
        brand: initialData.brand ?? "",
        quantity: initialData.quantity?.toString() ?? "",
        item_cost: String(_seedItemCost),
      }];
    }
    return [{ tempId: nextTempId(), material_id: "", brand: "", quantity: "", item_cost: "" }];
  });
  const [shippingCost, setShippingCost] = useState(
    mode === "create" && initialData ? String(_seedShipping) : "0"
  );

  // Edit mode
  const [materialId, setMaterialId] = useState(initialData?.material_id ?? "");
  const [editBrand, setEditBrand] = useState(initialData?.brand ?? "");
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() ?? "");
  const [totalCost, setTotalCost] = useState(initialData?.total_cost?.toString() ?? "");

  useEffect(() => {
    supabase
      .from("materials")
      .select("*")
      .order("name")
      .then(({ data }) => setMaterials(data ?? []));

    supabase
      .from("purchases")
      .select("supplier")
      .not("supplier", "is", null)
      .then(({ data }) => {
        const rows = (data ?? []) as { supplier: string | null }[];
        const seen = new Set<string>();
        const unique: string[] = [];
        rows.forEach((p) => {
          if (p.supplier && !seen.has(p.supplier)) {
            seen.add(p.supplier);
            unique.push(p.supplier);
          }
        });
        setSupplierSuggestions(unique.sort());
      });

    supabase
      .from("purchases")
      .select("brand")
      .not("brand", "is", null)
      .neq("brand", "")
      .then(({ data }) => {
        const rows = (data ?? []) as { brand: string | null }[];
        const seen = new Set<string>();
        const unique: string[] = [];
        rows.forEach((p) => {
          if (p.brand && !seen.has(p.brand)) {
            seen.add(p.brand);
            unique.push(p.brand);
          }
        });
        setBrandSuggestions(unique.sort());
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const materialOptions: ACOption[] = materials.map((m) => ({
    id: m.id,
    label: m.name,
    sublabel: m.unit,
  }));

  function handleMaterialCreated(material: Material) {
    setMaterials((prev) =>
      [...prev, material].sort((a, b) => a.name.localeCompare(b.name))
    );
    if (mode === "create" && modalCallbackIdx !== null) {
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === modalCallbackIdx ? { ...item, material_id: material.id } : item
        )
      );
    } else {
      setMaterialId(material.id);
    }
    setModalCallbackIdx(null);
    setShowNewMaterialModal(false);
  }

  // ── Create mode: item helpers ──────────────────────────────────

  function addItem() {
    setItems((prev) => [
      ...prev,
      { tempId: nextTempId(), material_id: "", brand: "", quantity: "", item_cost: "" },
    ]);
  }

  function removeItem(tempId: string) {
    setItems((prev) => prev.filter((it) => it.tempId !== tempId));
  }

  function updateItem<K extends keyof PurchaseItem>(
    tempId: string,
    key: K,
    value: PurchaseItem[K]
  ) {
    setItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, [key]: value } : it))
    );
  }

  // ── Shipping distribution ──────────────────────────────────────

  const shipping = parseFloat(shippingCost) || 0;
  const totalQty = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0), 0);

  function getCalcs(it: PurchaseItem) {
    const qty = parseFloat(it.quantity) || 0;
    const cost = parseFloat(it.item_cost) || 0;
    const shippingShare =
      shipping > 0 && totalQty > 0 ? shipping * (qty / totalQty) : 0;
    const adjustedCost = cost + shippingShare;
    const unitCost = qty > 0 ? adjustedCost / qty : 0;
    return { qty, cost, shippingShare, adjustedCost, unitCost };
  }

  const grandItemCost = items.reduce(
    (s, it) => s + (parseFloat(it.item_cost) || 0),
    0
  );
  const grandTotal = grandItemCost + shipping;

  // ── Submit ─────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "create") {
      if (items.length === 0) {
        setError("Agregá al menos un insumo.");
        return;
      }
      for (const it of items) {
        if (!it.material_id) {
          setError("Seleccioná el insumo para todas las filas.");
          return;
        }
        if (!(parseFloat(it.quantity) > 0)) {
          setError("Ingresá una cantidad mayor a 0 en todas las filas.");
          return;
        }
        if (isNaN(parseFloat(it.item_cost)) || parseFloat(it.item_cost) < 0) {
          setError("El costo de cada ítem no puede ser negativo.");
          return;
        }
      }
      setLoading(true);
      const rows = items.map((it) => {
        const { qty, shippingShare, adjustedCost } = getCalcs(it);
        return {
          date,
          delivery_date: deliveryDate || null,
          supplier: supplier.trim() || null,
          brand: it.brand.trim() || null,
          material_id: it.material_id,
          quantity: qty,
          total_cost: adjustedCost,
          unit_cost: qty > 0 ? adjustedCost / qty : 0,
          shipping_cost_share: shippingShare,
        };
      });
      const { error: err } = await supabase
        .from("purchases")
        .insert(rows as Database["public"]["Tables"]["purchases"]["Insert"][]);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    } else {
      const qty = parseFloat(quantity);
      const cost = parseFloat(totalCost);
      if (!materialId || !(qty > 0) || isNaN(cost) || cost < 0) {
        setError("Completá todos los campos obligatorios.");
        return;
      }
      setLoading(true);
      const { error: err } = await supabase
        .from("purchases")
        .update({
          date,
          delivery_date: deliveryDate || null,
          supplier: supplier.trim() || null,
          brand: editBrand.trim() || null,
          material_id: materialId,
          quantity: qty,
          total_cost: cost,
          unit_cost: cost / qty,
        } as Database["public"]["Tables"]["purchases"]["Update"])
        .eq("id", initialData!.id);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
    }

    router.push("/purchases");
    router.refresh();
  }

  // ── Render: EDIT ───────────────────────────────────────────────

  if (mode === "edit") {
    const qty = parseFloat(quantity) || 0;
    const cost = parseFloat(totalCost) || 0;
    const unitCost = qty > 0 ? cost / qty : null;
    const unit = materials.find((m) => m.id === materialId)?.unit;
    const shippingShare = initialData?.shipping_cost_share ?? 0;

    return (
      <>
        {showNewMaterialModal && (
          <NewMaterialModal
            onClose={() => setShowNewMaterialModal(false)}
            onCreated={handleMaterialCreated}
          />
        )}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Fecha de entrega
                </label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Proveedor
                </label>
                <TextSuggestField
                  suggestions={supplierSuggestions}
                  value={supplier}
                  onChange={setSupplier}
                  placeholder="Nombre del proveedor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Marca
                </label>
                <TextSuggestField
                  suggestions={brandSuggestions}
                  value={editBrand}
                  onChange={setEditBrand}
                  placeholder="Ej: Fenix, Callebaut…"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Insumo <span className="text-red-400">*</span>
              </label>
              <AutocompleteField
                options={materialOptions}
                value={materialId}
                onChange={setMaterialId}
                placeholder="Buscar insumo…"
                onCreateNew={() => {
                  setModalCallbackIdx(null);
                  setShowNewMaterialModal(true);
                }}
                createNewLabel="insumo"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cantidad <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.001"
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                  {unit && (
                    <span className="text-sm text-gray-500 whitespace-nowrap">{unit}</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Costo total <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
              </div>
            </div>

            {shippingShare > 0 && (
              <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
                <Truck size={14} className="flex-shrink-0" />
                <span>
                  Incluye <strong>{fmtNum(shippingShare)}</strong> de envío imputado.
                </span>
              </div>
            )}

            {unitCost !== null && qty > 0 && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-2">
                <span className="text-sm text-gray-500">Costo unitario:</span>
                <span className="text-sm font-semibold text-gray-800">
                  ${unitCost.toFixed(4)}
                  {unit ? ` / ${unit}` : ""}
                </span>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-chocolate hover:bg-dark-red text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </>
    );
  }

  // ── Render: CREATE (multi-item) ────────────────────────────────

  return (
    <>
      {showNewMaterialModal && (
        <NewMaterialModal
          onClose={() => setShowNewMaterialModal(false)}
          onCreated={handleMaterialCreated}
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Datos generales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Fecha <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Fecha de entrega
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor</label>
              <TextSuggestField
                suggestions={supplierSuggestions}
                value={supplier}
                onChange={setSupplier}
                placeholder="Nombre del proveedor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Truck size={13} className="text-gray-400" />
                  Costo de envío
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full pl-7 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                />
              </div>
              {shipping > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  Se distribuirá proporcionalmente entre los ítems.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Insumos comprados */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Insumos comprados
            </h2>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "#49789d" }}
            >
              <Plus size={14} />
              Agregar ítem
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 pr-3 min-w-[200px]">
                    Insumo
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 px-2 min-w-[130px]">
                    Marca
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 px-2 w-28">
                    Cantidad
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 px-1 w-10">
                    Un.
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 px-2 w-36">
                    Costo del ítem
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 px-2 w-32">
                    Envío imputado
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 px-2 w-32">
                    Total ajustado
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3 px-2 w-32">
                    Costo unit.
                  </th>
                  <th className="w-8 pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((it, idx) => {
                  const mat = materials.find((m) => m.id === it.material_id);
                  const { qty, cost, shippingShare, adjustedCost, unitCost } = getCalcs(it);
                  const hasData = qty > 0 && cost >= 0 && it.item_cost !== "";
                  return (
                    <tr key={it.tempId} className="hover:bg-gray-50/30">
                      {/* Insumo */}
                      <td className="py-2.5 pr-3">
                        <AutocompleteField
                          options={materialOptions}
                          value={it.material_id}
                          onChange={(id) => updateItem(it.tempId, "material_id", id)}
                          placeholder="Buscar insumo…"
                          onCreateNew={() => {
                            setModalCallbackIdx(idx);
                            setShowNewMaterialModal(true);
                          }}
                          createNewLabel="insumo"
                        />
                      </td>
                      {/* Marca */}
                      <td className="py-2.5 px-2">
                        <TextSuggestField
                          suggestions={brandSuggestions}
                          value={it.brand}
                          onChange={(v) => updateItem(it.tempId, "brand", v)}
                          placeholder="Opcional…"
                        />
                      </td>
                      {/* Cantidad */}
                      <td className="py-2.5 px-2">
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(it.tempId, "quantity", e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          step="0.001"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                        />
                      </td>
                      {/* Unidad */}
                      <td className="py-2.5 px-1 text-xs text-gray-500 whitespace-nowrap">
                        {mat?.unit ?? ""}
                      </td>
                      {/* Costo del ítem */}
                      <td className="py-2.5 px-2">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                            $
                          </span>
                          <input
                            type="number"
                            value={it.item_cost}
                            onChange={(e) =>
                              updateItem(it.tempId, "item_cost", e.target.value)
                            }
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full pl-6 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                          />
                        </div>
                      </td>
                      {/* Envío imputado (read-only) */}
                      <td className="py-2.5 px-2 text-right text-sm whitespace-nowrap">
                        {hasData && shipping > 0 ? (
                          <span className="text-blue-600 font-medium">
                            {fmtNum(shippingShare)}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {/* Total ajustado (read-only) */}
                      <td className="py-2.5 px-2 text-right text-sm font-medium text-gray-700 whitespace-nowrap">
                        {hasData ? (
                          fmtNum(adjustedCost)
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {/* Costo unitario (read-only) */}
                      <td className="py-2.5 px-2 text-right text-xs text-gray-500 whitespace-nowrap">
                        {hasData && qty > 0 ? (
                          `$${unitCost.toFixed(4)}${mat?.unit ? `/${mat.unit}` : ""}`
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {/* Eliminar */}
                      <td className="py-2.5 pl-2">
                        <button
                          type="button"
                          onClick={() => removeItem(it.tempId)}
                          disabled={items.length === 1}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Quitar fila"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-end gap-x-8 gap-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-gray-500">
              <span>Insumos:</span>
              <span className="font-medium text-gray-700">{fmtNum(grandItemCost)}</span>
            </div>
            {shipping > 0 && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <Truck size={12} className="text-blue-500" />
                <span>Envío:</span>
                <span className="font-medium text-blue-600">{fmtNum(shipping)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-700">Total compra:</span>
              <span
                className="font-bold text-lg"
                style={{ color: "#49789d" }}
              >
                {fmtNum(grandTotal)}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors shadow-sm"
            style={{ backgroundColor: "#49789d" }}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? "Guardando…" : "Registrar compra"}
          </button>
        </div>
      </form>
    </>
  );
}
