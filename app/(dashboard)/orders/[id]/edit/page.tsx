"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import OrderForm from "@/components/orders/OrderForm";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";

type Order = Database["public"]["Tables"]["orders"]["Row"];
type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];

interface OrderWithItems extends Order {
  items: (OrderItem & { product_name: string })[];
}

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [data, setData] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: o }, { data: its }, { data: prods }] = await Promise.all([
        supabase.from("orders").select("*").eq("id", id).single(),
        supabase.from("order_items").select("*").eq("order_id", id).order("created_at"),
        supabase.from("products").select("id, name, presentation"),
      ]);

      if (!o) { setLoading(false); return; }

      if (o.status === "anulado") {
        setRestricted(true);
        setLoading(false);
        return;
      }

      const nameMap: Record<string, string> = {};
      (prods ?? []).forEach((p) => { nameMap[p.id] = pName(p); });

      setData({
        ...o,
        items: (its ?? []).map((it) => ({ ...it, product_name: nameMap[it.product_id] ?? "" })),
      });
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-300" /></div>;
  }

  if (restricted) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-gray-500 mb-4">No se puede editar un pedido anulado.</p>
        <button
          onClick={() => router.push(`/orders/${id}`)}
          className="text-sm font-medium hover:underline"
          style={{ color: "#49789d" }}
        >
          Volver al pedido
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-gray-400">Pedido no encontrado.</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push(`/orders/${id}`)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Editar pedido #{String(data.order_number ?? "—").padStart(4, "0")}
          </h1>
          <p className="text-gray-500 mt-0.5">{data.guest_name ?? data.client_id}</p>
        </div>
      </div>
      <OrderForm initialData={data} />
    </div>
  );
}
