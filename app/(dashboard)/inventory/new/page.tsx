"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";

export default function NewInventoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [type, setType] = useState<"materials" | "products">("materials");
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      if (type === "materials") {
        // ── Calculate theoretical stock for all materials ──────────────
        const [
          { data: materials },
          { data: purchases },
          { data: prodLogs },
          { data: recipes },
          { data: matAdj },
        ] = await Promise.all([
          supabase.from("materials").select("id, name").order("name"),
          supabase.from("purchases").select("material_id, quantity"),
          supabase.from("production_logs").select("product_id, quantity"),
          supabase.from("recipes").select("product_id, material_id, quantity"),
          supabase.from("stock_adjustments").select("material_id, adjustment").not("material_id", "is", null),
        ]);

        const purchMap: Record<string, number> = {};
        (purchases ?? []).forEach((p) => { purchMap[p.material_id] = (purchMap[p.material_id] ?? 0) + p.quantity; });

        const consMap: Record<string, number> = {};
        (prodLogs ?? []).forEach((l) => {
          (recipes ?? []).filter((r) => r.product_id === l.product_id).forEach((r) => {
            consMap[r.material_id] = (consMap[r.material_id] ?? 0) + l.quantity * r.quantity;
          });
        });

        const adjMap: Record<string, number> = {};
        (matAdj ?? []).forEach((a) => {
          if (a.material_id) adjMap[a.material_id] = (adjMap[a.material_id] ?? 0) + a.adjustment;
        });

        // Create the count record
        const { data: newCount, error: countErr } = await supabase
          .from("inventory_counts")
          .insert({ count_date: countDate, type: "materials" })
          .select("id")
          .single();
        if (countErr) throw countErr;

        // Create items with theoretical = physical (user will adjust)
        const rows = (materials ?? []).map((m) => {
          const stock = (purchMap[m.id] ?? 0) - (consMap[m.id] ?? 0) + (adjMap[m.id] ?? 0);
          return {
            count_id: newCount!.id,
            material_id: m.id,
            theoretical_stock: stock,
            physical_stock: stock, // default to theoretical; user edits
          };
        });

        if (rows.length > 0) {
          const { error: itemErr } = await supabase.from("inventory_count_items").insert(rows);
          if (itemErr) throw itemErr;
        }

        router.push(`/inventory/${newCount!.id}`);
      } else {
        // ── Calculate theoretical stock for all active products ────────
        const [
          { data: products },
          { data: prodLogs },
          { data: deliveredOrders },
          { data: prodAdj },
        ] = await Promise.all([
          supabase.from("products").select("id, name, presentation").eq("active", true).order("name"),
          supabase.from("production_logs").select("product_id, quantity"),
          supabase.from("orders").select("id").eq("status", "cumplido"),
          supabase.from("stock_adjustments").select("product_id, adjustment").not("product_id", "is", null),
        ]);

        const producedMap: Record<string, number> = {};
        (prodLogs ?? []).forEach((l) => { producedMap[l.product_id] = (producedMap[l.product_id] ?? 0) + l.quantity; });

        const soldMap: Record<string, number> = {};
        if ((deliveredOrders ?? []).length > 0) {
          const { data: ois } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .in("order_id", (deliveredOrders ?? []).map((o) => o.id));
          (ois ?? []).forEach((oi) => { soldMap[oi.product_id] = (soldMap[oi.product_id] ?? 0) + oi.quantity; });
        }

        const adjMap: Record<string, number> = {};
        (prodAdj ?? []).forEach((a) => {
          if (a.product_id) adjMap[a.product_id] = (adjMap[a.product_id] ?? 0) + a.adjustment;
        });

        const { data: newCount, error: countErr } = await supabase
          .from("inventory_counts")
          .insert({ count_date: countDate, type: "products" })
          .select("id")
          .single();
        if (countErr) throw countErr;

        const rows = (products ?? []).map((p) => {
          const stock = (producedMap[p.id] ?? 0) - (soldMap[p.id] ?? 0) + (adjMap[p.id] ?? 0);
          return {
            count_id: newCount!.id,
            product_id: p.id,
            theoretical_stock: stock,
            physical_stock: stock,
          };
        });

        if (rows.length > 0) {
          const { error: itemErr } = await supabase.from("inventory_count_items").insert(rows);
          if (itemErr) throw itemErr;
        }

        router.push(`/inventory/${newCount!.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la toma de inventario.");
      setCreating(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/inventory")} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva toma de inventario</h1>
          <p className="text-gray-500 mt-0.5">Se generará la lista de ítems automáticamente</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de inventario</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: "materials", label: "Insumos" },
              { value: "products", label: "Productos terminados" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`py-3 px-4 rounded-xl border text-sm font-medium transition-colors ${
                  type === opt.value ? "text-white border-transparent" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
                style={type === opt.value ? { backgroundColor: "#a9760a" } : undefined}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del conteo</label>
          <input
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/inventory")}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={creating}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: "#a9760a" }}
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            {creating ? "Generando…" : "Crear toma de inventario"}
          </button>
        </div>
      </form>
    </div>
  );
}
