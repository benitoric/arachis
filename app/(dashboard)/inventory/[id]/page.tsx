"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft, CheckCircle, Save, AlertTriangle } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";

type InventoryCount = Database["public"]["Tables"]["inventory_counts"]["Row"];
type CountItem = Database["public"]["Tables"]["inventory_count_items"]["Row"];

interface ItemWithName extends CountItem {
  name: string;
  unit?: string; // only for materials
}

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

const fmtNum = (n: number) =>
  n % 1 === 0 ? String(n) : n.toFixed(3);

export default function InventoryCountPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [count, setCount] = useState<InventoryCount | null>(null);
  const [items, setItems] = useState<ItemWithName[]>([]);
  const [physicalValues, setPhysicalValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: c }, { data: its }] = await Promise.all([
      supabase.from("inventory_counts").select("*").eq("id", id).single(),
      supabase.from("inventory_count_items").select("*").eq("count_id", id),
    ]);

    if (!c) { setLoading(false); return; }
    setCount(c);

    let enriched: ItemWithName[] = [];

    if (c.type === "materials") {
      const matIds = (its ?? []).map((it) => it.material_id).filter(Boolean) as string[];
      const { data: mats } = matIds.length > 0
        ? await supabase.from("materials").select("id, name, unit").in("id", matIds)
        : { data: [] };

      const matMap: Record<string, { name: string; unit: string }> = {};
      (mats ?? []).forEach((m) => { matMap[m.id] = m; });

      enriched = (its ?? []).map((it) => ({
        ...it,
        name: matMap[it.material_id ?? ""]?.name ?? "—",
        unit: matMap[it.material_id ?? ""]?.unit ?? "",
      }));
    } else {
      const prodIds = (its ?? []).map((it) => it.product_id).filter(Boolean) as string[];
      const { data: prods } = prodIds.length > 0
        ? await supabase.from("products").select("id, name, presentation").in("id", prodIds)
        : { data: [] };

      const prodMap: Record<string, string> = {};
      (prods ?? []).forEach((p) => { prodMap[p.id] = pName(p); });

      enriched = (its ?? []).map((it) => ({
        ...it,
        name: prodMap[it.product_id ?? ""] ?? "—",
      }));
    }

    enriched.sort((a, b) => a.name.localeCompare(b.name));
    setItems(enriched);

    // Initialize local physical values from DB
    const vals: Record<string, string> = {};
    enriched.forEach((it) => { vals[it.id] = fmtNum(it.physical_stock); });
    setPhysicalValues(vals);

    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  function handlePhysicalChange(itemId: string, value: string) {
    setPhysicalValues((prev) => ({ ...prev, [itemId]: value }));
  }

  function getDiff(itemId: string, theoretical: number): number | null {
    const val = parseFloat(physicalValues[itemId] ?? "");
    if (isNaN(val)) return null;
    return val - theoretical;
  }

  // Stock físico efectivo: usa el valor ingresado, cayendo al teórico sólo si
  // el campo está vacío. Nota: un 0 explícito es válido (insumo agotado) y no
  // debe confundirse con "sin cambio".
  function physicalOf(it: ItemWithName): number {
    const val = parseFloat(physicalValues[it.id] ?? "");
    return isNaN(val) ? it.theoretical_stock : val;
  }

  const totalDiffs = items.filter((it) => {
    const d = getDiff(it.id, it.theoretical_stock);
    return d !== null && d !== 0;
  }).length;

  async function handleSaveProgress() {
    setSaving(true);
    setError("");
    try {
      const updates = items.map((it) => ({
        id: it.id,
        count_id: it.count_id,
        material_id: it.material_id,
        product_id: it.product_id,
        theoretical_stock: it.theoretical_stock,
        physical_stock: physicalOf(it),
      }));
      const { error: err } = await supabase.from("inventory_count_items").upsert(updates);
      if (err) throw err;
      setSavedAt(new Date());
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : (err as { message?: string }).message ?? "Error al guardar."
      );
    } finally {
      setSaving(false);
    }
  }

  // Categoría de gasto indirecto donde se imputa el costo del ajuste de stock
  // de insumos. Se mantiene separada del CMV (que sale de order_items.unit_cost).
  const ADJUSTMENT_COST_CATEGORY = "Aj. Inventario consumo y marketing";

  // Valoriza el faltante (teórico − físico) de una toma de insumos al costo de
  // reposición y lo registra como un único gasto indirecto del período.
  async function createMaterialAdjustmentCost() {
    const matIds = items.map((it) => it.material_id).filter(Boolean) as string[];
    if (matIds.length === 0) return;

    const countDate = count!.count_date;

    const [{ data: mats }, { data: purchs }] = await Promise.all([
      supabase.from("materials").select("id, manual_unit_cost").in("id", matIds),
      supabase
        .from("purchases")
        .select("material_id, unit_cost, date, created_at")
        .in("material_id", matIds)
        .not("unit_cost", "is", null)
        .lte("date", countDate),
    ]);

    // Última compra (<= fecha del conteo) por insumo = costo de reposición.
    const lastCost: Record<string, number> = {};
    [...(purchs ?? [])]
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.created_at ?? "").localeCompare(a.created_at ?? "")
      )
      .forEach((p) => {
        if (lastCost[p.material_id] === undefined && p.unit_cost != null) {
          lastCost[p.material_id] = p.unit_cost;
        }
      });

    const manualCost: Record<string, number> = {};
    (mats ?? []).forEach((m) => {
      if (m.manual_unit_cost != null) manualCost[m.id] = m.manual_unit_cost;
    });

    const unitCostOf = (id: string) => lastCost[id] ?? manualCost[id] ?? 0;

    // Costo = Σ de faltantes valorizados (teórico − físico) × costo unitario,
    // contando SÓLO los ítems donde el físico es menor al teórico. Los sobrantes
    // corrigen el stock pero no reducen el costo ni generan un ingreso.
    let totalCost = 0;
    let adjustedItems = 0;
    items.forEach((it) => {
      if (!it.material_id) return;
      const diff = physicalOf(it) - it.theoretical_stock;
      if (diff === 0) return;
      adjustedItems += 1;
      if (diff < 0) totalCost += -diff * unitCostOf(it.material_id);
    });
    totalCost = Math.round(totalCost * 100) / 100;

    // Si no hubo faltantes valorizados, no hay costo que registrar.
    if (totalCost <= 0) return;

    // Buscar / crear la categoría destino.
    const { data: cat } = await supabase
      .from("expense_categories")
      .select("id")
      .ilike("name", ADJUSTMENT_COST_CATEGORY)
      .maybeSingle();
    let catId = cat?.id;
    if (!catId) {
      const { data: newCat, error: catErr } = await supabase
        .from("expense_categories")
        .insert({ name: ADJUSTMENT_COST_CATEGORY })
        .select("id")
        .single();
      if (catErr) throw catErr;
      catId = newCat?.id;
    }
    if (!catId) return;

    const { error: expErr } = await supabase.from("indirect_expenses").insert({
      date: countDate,
      category_id: catId,
      description: `Ajuste de stock de insumos del ${fmtDate(countDate)} · ${adjustedItems} ítem${adjustedItems !== 1 ? "s" : ""}`,
      amount: totalCost,
    });
    if (expErr) throw expErr;
  }

  async function handleFinalize() {
    const costNote =
      count?.type === "materials"
        ? " El faltante valorizado se imputará como costo en «Aj. Inventario consumo y marketing» (separado del CMV)."
        : "";
    if (!confirm(`Vas a finalizar este conteo. Se crearán ${totalDiffs} ajuste(s) de stock.${costNote} ¿Continuás?`)) return;

    setFinalizing(true);
    setError("");
    try {
      // 1. Save current physical values
      const updates = items.map((it) => ({
        id: it.id,
        count_id: it.count_id,
        material_id: it.material_id,
        product_id: it.product_id,
        theoretical_stock: it.theoretical_stock,
        physical_stock: physicalOf(it),
      }));
      const { error: updateErr } = await supabase.from("inventory_count_items").upsert(updates);
      if (updateErr) throw updateErr;

      // 2. Create stock adjustments for items with differences
      const adjustments = items
        .map((it) => {
          const diff = physicalOf(it) - it.theoretical_stock;
          if (diff === 0) return null;
          return {
            count_item_id: it.id,
            material_id: it.material_id ?? null,
            product_id: it.product_id ?? null,
            adjustment: diff,
            reason: "Corrección por toma de inventario",
          };
        })
        .filter(Boolean);

      if (adjustments.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: adjErr } = await supabase.from("stock_adjustments").insert(adjustments as any[]);
        if (adjErr) throw adjErr;
      }

      // 3. Para insumos: valorizar la diferencia y mandarla a costo como gasto
      //    indirecto, en una categoría propia separada del CMV. El CMV del EERR
      //    sale exclusivamente de order_items.unit_cost (costo congelado al
      //    vender), por lo que este costo nunca se mezcla con la mercadería
      //    vendida. Valuación = costo de reposición (última compra <= fecha del
      //    conteo; fallback materials.manual_unit_cost), mismo criterio del CMV.
      if (count!.type === "materials") {
        await createMaterialAdjustmentCost();
      }

      // 4. Mark count as finalized
      const { error: finalErr } = await supabase
        .from("inventory_counts")
        .update({ finalized_at: new Date().toISOString() })
        .eq("id", id);
      if (finalErr) throw finalErr;

      // Reload
      await loadData();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : (err as { message?: string }).message ?? "Error al finalizar el conteo."
      );
    } finally {
      setFinalizing(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>;
  }
  if (!count) {
    return <div className="text-center py-20 text-gray-400">Toma de inventario no encontrada.</div>;
  }

  const isFinalized = !!count.finalized_at;
  const typeName = count.type === "materials" ? "Insumos" : "Productos terminados";

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/inventory")} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                Inventario · {typeName}
              </h1>
              {isFinalized ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle size={11} /> Finalizado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  En curso
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-0.5">{fmtDate(count.count_date)}</p>
          </div>
        </div>

        {!isFinalized && (
          <div className="flex gap-2">
            <button
              onClick={handleSaveProgress}
              disabled={saving || finalizing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar progreso
            </button>
            <button
              onClick={handleFinalize}
              disabled={finalizing || saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#49789d" }}
            >
              {finalizing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Finalizar conteo
            </button>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {!isFinalized && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 mb-5 flex flex-wrap items-center gap-6 text-sm">
          <span className="text-gray-500">
            <span className="font-semibold text-gray-900">{items.length}</span> ítems en total
          </span>
          <span className="text-gray-500">
            <span className={`font-semibold ${totalDiffs > 0 ? "text-red-600" : "text-green-600"}`}>{totalDiffs}</span> con diferencia
          </span>
          {savedAt && (
            <span className="text-gray-400 text-xs">
              Guardado {savedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {isFinalized && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-3 mb-5 flex items-center gap-3 text-sm text-green-700">
          <CheckCircle size={16} />
          <span>
            Conteo finalizado el{" "}
            {new Date(count.finalized_at!).toLocaleString("es-AR", {
              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            {" — "}
            {items.filter((it) => it.physical_stock !== it.theoretical_stock).length} ajuste(s) de stock aplicados.
          </span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-4">{error}</p>
      )}

      {/* Items table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">
                {count.type === "materials" ? "Insumo" : "Artículo"}
              </th>
              {count.type === "materials" && (
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">
                  Unidad
                </th>
              )}
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                Stock teórico
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                Stock físico
              </th>
              <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {items.map((it) => {
              const diff = isFinalized
                ? it.physical_stock - it.theoretical_stock
                : getDiff(it.id, it.theoretical_stock);
              const hasDiff = diff !== null && diff !== 0;

              return (
                <tr key={it.id} className={`${hasDiff ? "bg-red-50/20" : ""}`}>
                  <td className="px-5 py-3 font-medium text-gray-900">{it.name}</td>
                  {count.type === "materials" && (
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {it.unit}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-gray-600 font-mono">
                    {fmtNum(it.theoretical_stock)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isFinalized ? (
                      <span className="font-mono text-gray-900">{fmtNum(it.physical_stock)}</span>
                    ) : (
                      <input
                        type="number"
                        value={physicalValues[it.id] ?? ""}
                        onChange={(e) => handlePhysicalChange(it.id, e.target.value)}
                        step="any"
                        className={`w-24 border rounded px-2 py-1 text-right text-sm font-mono focus:outline-none focus:ring-1 transition-colors ${
                          hasDiff ? "border-red-300 focus:ring-red-200 bg-red-50" : "border-gray-200 focus:ring-blue-200"
                        }`}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {diff === null ? (
                      <span className="text-gray-300">—</span>
                    ) : diff === 0 ? (
                      <span className="text-green-600 text-xs">✓ OK</span>
                    ) : (
                      <span className={`flex items-center justify-end gap-1 ${diff > 0 ? "text-blue-600" : "text-red-600"}`}>
                        {diff > 0 ? "+" : ""}{fmtNum(diff)}
                        {hasDiff && <AlertTriangle size={12} />}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {items.length === 0 && (
          <div className="text-center py-12 text-gray-400">No hay ítems en esta toma de inventario.</div>
        )}
      </div>
    </div>
  );
}
