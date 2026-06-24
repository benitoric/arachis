"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, RefreshCw, Package, Box, AlertTriangle, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Material = Database["public"]["Tables"]["materials"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

interface MaterialStock extends Material {
  physicalStock: number;
  pendingStock: number;
  projectedStock: number;
  status: "ok" | "warning" | "critical" | "unknown";
}

interface ProductStock extends Product {
  physicalStock: number;
  committed: number;
  available: number;
}

type Tab = "materials" | "products";

// Orden por defecto: primero stock positivo, luego negativo, y los de stock
// cero al fondo. Dentro de cada grupo se conserva el orden alfabético previo.
function stockGroupRank(stock: number): number {
  if (stock > 0) return 0;
  if (stock < 0) return 1;
  return 2; // stock cero
}

// ─── Movement types ───────────────────────────────────────────────────────────
interface Movement {
  date: string;
  type: "entrada" | "salida" | "ajuste";
  label: string;
  quantity: number;
  balance: number;
}

function StockBadge({ status }: { status: MaterialStock["status"] }) {
  if (status === "ok") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />OK
    </span>
  );
  if (status === "warning") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Bajo
    </span>
  );
  if (status === "critical") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <AlertTriangle size={11} />Crítico
    </span>
  );
  return <span className="text-gray-300 text-xs">—</span>;
}

// ─── Movements Modal ──────────────────────────────────────────────────────────
interface MovementsModalProps {
  itemId: string;
  itemName: string;
  itemType: "material" | "product";
  unit?: string;
  onClose: () => void;
}

const fmtDate = (d: string) =>
  new Date(d + (d.includes("T") ? "" : "T12:00:00")).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

function MovementsModal({ itemId, itemName, itemType, unit, onClose }: MovementsModalProps) {
  const supabase = createClient();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const rawMovements: Movement[] = [];

      if (itemType === "material") {
        // Purchases (entradas)
        const { data: purchases } = await supabase
          .from("purchases")
          .select("quantity, date, supplier")
          .eq("material_id", itemId)
          .order("date");

        (purchases ?? []).forEach((p) => {
          rawMovements.push({
            date: p.date,
            type: "entrada",
            label: p.supplier ? `Compra — ${p.supplier}` : "Compra",
            quantity: p.quantity,
            balance: 0,
          });
        });

        // Production consumption (salidas via production_logs + recipes)
        const [{ data: prodLogs }, { data: recipes }] = await Promise.all([
          supabase.from("production_logs").select("id, product_id, quantity, date").order("date"),
          supabase.from("recipes").select("product_id, quantity").eq("material_id", itemId),
        ]);

        const recipeMap: Record<string, number> = {};
        (recipes ?? []).forEach((r) => { recipeMap[r.product_id] = r.quantity; });

        const productIds = [...new Set((prodLogs ?? []).map((l) => l.product_id))];
        let productNameMap: Record<string, string> = {};
        if (productIds.length > 0) {
          const { data: prods } = await supabase.from("products").select("id, name").in("id", productIds);
          (prods ?? []).forEach((p) => { productNameMap[p.id] = p.name; });
        }

        (prodLogs ?? []).forEach((log) => {
          const recipeQty = recipeMap[log.product_id];
          if (!recipeQty) return;
          const consumed = log.quantity * recipeQty;
          rawMovements.push({
            date: log.date,
            type: "salida",
            label: `Producción — ${productNameMap[log.product_id] ?? "—"} (${log.quantity} uds.)`,
            quantity: -consumed,
            balance: 0,
          });
        });

        // Stock adjustments
        const { data: adjustments } = await supabase
          .from("stock_adjustments")
          .select("adjustment, reason, created_at")
          .eq("material_id", itemId)
          .order("created_at");

        (adjustments ?? []).forEach((a) => {
          rawMovements.push({
            date: a.created_at,
            type: "ajuste",
            label: a.reason ?? "Ajuste de inventario",
            quantity: a.adjustment,
            balance: 0,
          });
        });
      } else {
        // Production logs (entradas)
        const { data: prodLogs } = await supabase
          .from("production_logs")
          .select("quantity, date, batch_code")
          .eq("product_id", itemId)
          .order("date");

        (prodLogs ?? []).forEach((l) => {
          rawMovements.push({
            date: l.date,
            type: "entrada",
            label: l.batch_code ? `Producción — lote ${l.batch_code}` : "Producción",
            quantity: l.quantity,
            balance: 0,
          });
        });

        // Sales from delivered orders (salidas)
        const { data: delivOrders } = await supabase
          .from("orders")
          .select("id, delivered_date, order_date")
          .not("delivered_date", "is", null)
          .neq("status", "anulado");

        if ((delivOrders ?? []).length > 0) {
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("order_id, quantity")
            .eq("product_id", itemId)
            .in("order_id", (delivOrders ?? []).map((o) => o.id));

          const orderDateMap: Record<string, string> = {};
          (delivOrders ?? []).forEach((o) => { orderDateMap[o.id] = o.delivered_date ?? o.order_date; });

          (orderItems ?? []).forEach((oi) => {
            const date = orderDateMap[oi.order_id] ?? "";
            rawMovements.push({
              date,
              type: "salida",
              label: "Venta (pedido entregado)",
              quantity: -oi.quantity,
              balance: 0,
            });
          });
        }

        // Stock adjustments
        const { data: adjustments } = await supabase
          .from("stock_adjustments")
          .select("adjustment, reason, created_at")
          .eq("product_id", itemId)
          .order("created_at");

        (adjustments ?? []).forEach((a) => {
          rawMovements.push({
            date: a.created_at,
            type: "ajuste",
            label: a.reason ?? "Ajuste de inventario",
            quantity: a.adjustment,
            balance: 0,
          });
        });
      }

      // Sort by date
      rawMovements.sort((a, b) => a.date.localeCompare(b.date));

      // Compute running balance
      let balance = 0;
      rawMovements.forEach((m) => {
        balance += m.quantity;
        m.balance = balance;
      });

      setMovements(rawMovements);
      setLoading(false);
    }
    load();
  }, [itemId, itemType, supabase]);

  const fmtQty = (n: number) => {
    const abs = Math.abs(n);
    const formatted = abs % 1 === 0 ? String(abs) : abs.toFixed(3);
    return unit ? `${formatted} ${unit}` : `${formatted} uds.`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{itemName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Historial de movimientos</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-gray-300" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No hay movimientos registrados.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-2.5">Fecha</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Concepto</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Cantidad</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {movements.map((m, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmtDate(m.date)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="flex items-center gap-2">
                        {m.type === "entrada" && <TrendingUp size={13} className="text-green-500 flex-shrink-0" />}
                        {m.type === "salida" && <TrendingDown size={13} className="text-red-500 flex-shrink-0" />}
                        {m.type === "ajuste" && <Minus size={13} className="text-blue-500 flex-shrink-0" />}
                        <span className="text-xs">{m.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={`font-semibold ${m.quantity > 0 ? "text-green-600" : m.quantity < 0 ? "text-red-600" : "text-gray-400"}`}>
                        {m.quantity > 0 ? "+" : ""}{fmtQty(m.quantity)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className={`text-sm ${m.balance < 0 ? "text-red-600 font-bold" : "text-gray-900"}`}>
                        {fmtQty(m.balance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/30 flex-shrink-0">
          <p className="text-xs text-gray-400">{movements.length} movimiento{movements.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function StockPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("materials");
  const [materialStock, setMaterialStock] = useState<MaterialStock[]>([]);
  const [productStock, setProductStock] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [movementsItem, setMovementsItem] = useState<{
    id: string; name: string; type: "material" | "product"; unit?: string;
  } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: materialsSorted, sort: matSort, toggleSort: matToggleSort } = useSortableData(materialStock as any[]);
  const sortedMaterialStock = materialsSorted as MaterialStock[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: productsSorted, sort: prodSort, toggleSort: prodToggleSort } = useSortableData(productStock as any[]);
  const sortedProductStock = productsSorted as ProductStock[];

  const loadStock = useCallback(async () => {
    setLoading(true);

    // ── INSUMOS ──────────────────────────────────────
    const [
      { data: materials },
      { data: purchases },
      { data: prodLogs },
      { data: recipes },
      { data: matAdjustments },
    ] = await Promise.all([
      supabase.from("materials").select("*").order("name"),
      supabase.from("purchases").select("material_id, quantity, delivery_date"),
      supabase.from("production_logs").select("product_id, quantity"),
      supabase.from("recipes").select("product_id, material_id, quantity"),
      supabase.from("stock_adjustments").select("material_id, adjustment").not("material_id", "is", null),
    ]);

    const physicalPurchaseMap: Record<string, number> = {};
    const pendingPurchaseMap: Record<string, number> = {};
    (purchases ?? []).forEach((p) => {
      if (p.delivery_date) {
        physicalPurchaseMap[p.material_id] = (physicalPurchaseMap[p.material_id] ?? 0) + p.quantity;
      } else {
        pendingPurchaseMap[p.material_id] = (pendingPurchaseMap[p.material_id] ?? 0) + p.quantity;
      }
    });

    const consumedMap: Record<string, number> = {};
    (prodLogs ?? []).forEach((log) => {
      const items = (recipes ?? []).filter((r) => r.product_id === log.product_id);
      items.forEach((r) => {
        consumedMap[r.material_id] = (consumedMap[r.material_id] ?? 0) + log.quantity * r.quantity;
      });
    });

    const matAdjMap: Record<string, number> = {};
    (matAdjustments ?? []).forEach((a) => {
      if (a.material_id) matAdjMap[a.material_id] = (matAdjMap[a.material_id] ?? 0) + a.adjustment;
    });

    const mStock: MaterialStock[] = (materials ?? []).map((m) => {
      const physicalStock =
        (physicalPurchaseMap[m.id] ?? 0) -
        (consumedMap[m.id] ?? 0) +
        (matAdjMap[m.id] ?? 0);
      const pendingStock = pendingPurchaseMap[m.id] ?? 0;
      const projectedStock = physicalStock + pendingStock;

      let status: MaterialStock["status"] = "unknown";
      if (m.critical_stock != null) {
        if (physicalStock <= m.critical_stock) status = "critical";
        else if (physicalStock <= m.critical_stock * 1.5) status = "warning";
        else status = "ok";
      }
      return { ...m, physicalStock, pendingStock, projectedStock, status };
    });

    // Stock cero al fondo (positivos → negativos → cero), alfabético dentro de cada grupo.
    mStock.sort((a, b) => stockGroupRank(a.physicalStock) - stockGroupRank(b.physicalStock));

    setMaterialStock(mStock);

    // ── PRODUCTOS TERMINADOS ─────────────────────────
    const [
      { data: products },
      { data: prodLogsAll },
      { data: deliveredOrders },
      { data: committedOrders },
      { data: prodAdjustments },
    ] = await Promise.all([
      supabase.from("products").select("*").eq("active", true).order("name"),
      supabase.from("production_logs").select("product_id, quantity"),
      // Stock físico: pedidos con entrega registrada (delivered_date IS NOT NULL), excluye anulados
      supabase.from("orders").select("id").not("delivered_date", "is", null).neq("status", "anulado"),
      // Comprometido: pedidos confirmados sin entregar aún
      supabase.from("orders").select("id").eq("status", "confirmado").is("delivered_date", null),
      supabase.from("stock_adjustments").select("product_id, adjustment").not("product_id", "is", null),
    ]);

    const producedMap: Record<string, number> = {};
    (prodLogsAll ?? []).forEach((p) => {
      producedMap[p.product_id] = (producedMap[p.product_id] ?? 0) + p.quantity;
    });

    // Unidades salidas por entrega real
    const soldMap: Record<string, number> = {};
    if ((deliveredOrders ?? []).length > 0) {
      const orderIds = (deliveredOrders ?? []).map((o) => o.id);
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .in("order_id", orderIds);
      (orderItems ?? []).forEach((oi) => {
        soldMap[oi.product_id] = (soldMap[oi.product_id] ?? 0) + oi.quantity;
      });
    }

    // Unidades comprometidas en pedidos confirmados sin entregar
    const committedMap: Record<string, number> = {};
    if ((committedOrders ?? []).length > 0) {
      const commitIds = (committedOrders ?? []).map((o) => o.id);
      const { data: commitItems } = await supabase
        .from("order_items")
        .select("product_id, quantity")
        .in("order_id", commitIds);
      (commitItems ?? []).forEach((oi) => {
        committedMap[oi.product_id] = (committedMap[oi.product_id] ?? 0) + oi.quantity;
      });
    }

    const prodAdjMap: Record<string, number> = {};
    (prodAdjustments ?? []).forEach((a) => {
      if (a.product_id) prodAdjMap[a.product_id] = (prodAdjMap[a.product_id] ?? 0) + a.adjustment;
    });

    const pStock: ProductStock[] = (products ?? []).map((p) => {
      const physicalStock = (producedMap[p.id] ?? 0) - (soldMap[p.id] ?? 0) + (prodAdjMap[p.id] ?? 0);
      const committed = committedMap[p.id] ?? 0;
      return { ...p, physicalStock, committed, available: physicalStock - committed };
    });

    // Orden por defecto basado en el stock físico: positivos → negativos → cero.
    pStock.sort((a, b) => stockGroupRank(a.physicalStock) - stockGroupRank(b.physicalStock));

    setProductStock(pStock);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  return (
    <div>
      {movementsItem && (
        <MovementsModal
          itemId={movementsItem.id}
          itemName={movementsItem.name}
          itemType={movementsItem.type}
          unit={movementsItem.unit}
          onClose={() => setMovementsItem(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
          <p className="text-gray-500 mt-0.5">Inventario teórico en tiempo real</p>
        </div>
        <button
          onClick={loadStock}
          disabled={loading}
          className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm mb-5 w-full sm:w-fit">
        <button
          onClick={() => setTab("materials")}
          className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            tab === "materials"
              ? "text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
          style={tab === "materials" ? { backgroundColor: "#49789d" } : undefined}
        >
          <Package size={15} />
          Insumos
        </button>
        <button
          onClick={() => setTab("products")}
          className={`flex flex-1 sm:flex-none items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            tab === "products"
              ? "text-white shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
          style={tab === "products" ? { backgroundColor: "#49789d" } : undefined}
        >
          <Box size={15} />
          <span className="sm:hidden">Productos</span>
          <span className="hidden sm:inline">Productos terminados</span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gold" />
          </div>
        ) : tab === "materials" ? (
          materialStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No hay insumos registrados</p>
              <p className="text-sm text-gray-400 mt-1">
                <a href="/materials/new" className="text-chocolate hover:underline">Creá un insumo primero</a>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <SortableHeader label="Insumo" sortKey="name" sort={matSort} onSort={matToggleSort} className="px-3" />
                    <SortableHeader label="Unidad" sortKey="unit" sort={matSort} onSort={matToggleSort} className="hidden sm:table-cell px-2" />
                    <SortableHeader label="Stock físico" sortKey="physicalStock" sort={matSort} onSort={matToggleSort} align="right" className="px-2" />
                    <SortableHeader label="En tránsito" sortKey="pendingStock" sort={matSort} onSort={matToggleSort} align="right" className="hidden md:table-cell px-2" />
                    <SortableHeader label="Proyectado" sortKey="projectedStock" sort={matSort} onSort={matToggleSort} align="right" className="hidden lg:table-cell px-2" />
                    <SortableHeader label="Stock crítico" sortKey="critical_stock" sort={matSort} onSort={matToggleSort} align="right" className="hidden xl:table-cell px-2" />
                    <SortableHeader label="Estado" sortKey="status" sort={matSort} onSort={matToggleSort} align="center" className="hidden sm:table-cell px-2" />
                    <th className="px-2 py-3 w-24"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedMaterialStock.map((m) => (
                    <tr key={m.id} className={`hover:bg-gray-50/50 transition-colors ${m.status === "critical" ? "bg-red-50/30" : m.pendingStock > 0 ? "bg-amber-50/20" : ""}`}>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900">{m.name}</p>
                      </td>
                      <td className="px-2 py-3 hidden sm:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 whitespace-nowrap">
                          {m.unit}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        <span className={`text-sm font-bold ${m.physicalStock < 0 ? "text-red-600" : "text-gray-900"}`}>
                          {m.physicalStock % 1 === 0 ? m.physicalStock : m.physicalStock.toFixed(3)} {m.unit}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right hidden md:table-cell whitespace-nowrap">
                        {m.pendingStock > 0 ? (
                          <span className="text-sm font-medium text-amber-600">
                            +{m.pendingStock % 1 === 0 ? m.pendingStock : m.pendingStock.toFixed(3)} {m.unit}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right hidden lg:table-cell whitespace-nowrap">
                        <span className="text-sm text-gray-600">
                          {m.projectedStock % 1 === 0 ? m.projectedStock : m.projectedStock.toFixed(3)} {m.unit}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right text-sm text-gray-500 hidden xl:table-cell whitespace-nowrap">
                        {m.critical_stock != null ? `${m.critical_stock} ${m.unit}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-2 py-3 text-center hidden sm:table-cell">
                        <StockBadge status={m.status} />
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => setMovementsItem({ id: m.id, name: m.name, type: "material", unit: m.unit })}
                          className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                          Ver mov.
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> OK: stock físico &gt; crítico × 1.5</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Bajo: entre crítico y crítico × 1.5</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Crítico: stock físico ≤ crítico</span>
                <span className="flex items-center gap-1 text-amber-600">En tránsito: compras sin fecha de entrega registrada</span>
              </div>
            </div>
          )
        ) : (
          productStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Box size={40} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No hay artículos activos</p>
              <p className="text-sm text-gray-400 mt-1">
                <a href="/products" className="text-chocolate hover:underline">Activá artículos primero</a>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <SortableHeader label="Artículo" sortKey="name" sort={prodSort} onSort={prodToggleSort} className="px-3" />
                    <SortableHeader label="Stock físico" sortKey="physicalStock" sort={prodSort} onSort={prodToggleSort} align="right" className="px-2" />
                    <SortableHeader label="Comprometido" sortKey="committed" sort={prodSort} onSort={prodToggleSort} align="right" className="hidden sm:table-cell px-2" />
                    <SortableHeader label="Disponible" sortKey="available" sort={prodSort} onSort={prodToggleSort} align="right" className="px-2" />
                    <th className="px-2 py-3 w-24"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedProductStock.map((p) => (
                    <tr key={p.id} className={`hover:bg-gray-50/50 transition-colors ${p.available < 0 ? "bg-red-50/30" : ""}`}>
                      <td className="px-3 py-3">
                        <p className="font-medium text-gray-900">{pName(p)}</p>
                        {/* Comprometido: en mobile no hay columna propia, se indica acá */}
                        {p.committed > 0 && (
                          <p className="text-xs text-amber-600 mt-0.5 sm:hidden">Comprometido: {p.committed} unid.</p>
                        )}
                      </td>
                      {/* Stock físico */}
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        <span className={`text-sm font-semibold ${p.physicalStock < 0 ? "text-red-600" : "text-gray-700"}`}>
                          {p.physicalStock} unid.
                        </span>
                      </td>
                      {/* Comprometido */}
                      <td className="px-2 py-3 text-right hidden sm:table-cell whitespace-nowrap">
                        {p.committed > 0 ? (
                          <span className="text-sm font-semibold text-amber-600">{p.committed} unid.</span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      {/* Disponible */}
                      <td className="px-2 py-3 text-right whitespace-nowrap">
                        <span className={`text-sm font-bold ${
                          p.available < 0 ? "text-red-600" :
                          p.available === 0 ? "text-amber-500" :
                          "text-green-600"
                        }`}>
                          {p.available} unid.
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <button
                          onClick={() => setMovementsItem({ id: p.id, name: pName(p), type: "product" })}
                          className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                          Ver mov.
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 space-y-0.5">
                <p className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500">Físico:</span> producción acumulada − entregas realizadas ± ajustes
                </p>
                <p className="text-xs text-gray-400">
                  <span className="font-medium text-gray-500">Disponible:</span> físico − comprometido en pedidos confirmados sin entregar
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
