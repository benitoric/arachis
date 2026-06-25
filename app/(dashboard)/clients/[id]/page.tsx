import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Edit2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  ShoppingBag,
} from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import OrderHistoryTable from "@/components/clients/OrderHistoryTable";
import type { ClientOrder } from "@/components/clients/OrderHistoryTable";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  // Fetch order history
  const { data: rawOrders } = await supabase
    .from("orders")
    .select("id, order_number, order_date, status, delivered_date")
    .eq("client_id", id)
    .order("order_date", { ascending: false });

  let clientOrders: ClientOrder[] = [];

  if (rawOrders && rawOrders.length > 0) {
    const orderIds = rawOrders.map((o) => o.id);
    const [{ data: allItems }, { data: allPayments }, { data: products }] = await Promise.all([
      supabase.from("order_items").select("order_id, product_id, quantity, unit_price").in("order_id", orderIds),
      supabase.from("payments").select("order_id, amount, discount_amount").in("order_id", orderIds),
      supabase.from("products").select("id, name, presentation"),
    ]);

    const productMap: Record<string, string> = {};
    (products ?? []).forEach((p) => {
      productMap[p.id] = p.presentation ? `${p.name} (${p.presentation})` : p.name;
    });

    clientOrders = rawOrders.map((o) => {
      const orderItems = (allItems ?? []).filter((it) => it.order_id === o.id);
      const orderPayments = (allPayments ?? []).filter((p) => p.order_id === o.id);

      const total = orderItems.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
      const paid = orderPayments.reduce((acc, p) => acc + p.amount + (p.discount_amount ?? 0), 0);

      const shown = orderItems.slice(0, 2).map((it) => `${it.quantity}× ${productMap[it.product_id] ?? "?"}`);
      const extra = orderItems.length - shown.length;
      const itemsSummary = shown.join(", ") + (extra > 0 ? ` y ${extra} más` : "");

      return {
        id: o.id,
        order_number: o.order_number,
        order_date: o.order_date,
        status: o.status as ClientOrder["status"],
        delivered_date: o.delivered_date,
        total,
        paid,
        balance: total - paid,
        itemsSummary,
      };
    });
  }

  const priceTypeLabels: Record<string, string> = {
    minorista: "Minorista",
    mayorista: "Mayorista",
    otra: "Otra",
  };

  const priceTypeColors: Record<string, string> = {
    minorista: "bg-blue-100 text-blue-700",
    mayorista: "bg-purple-100 text-purple-700",
    otra: "bg-amber-100 text-amber-700",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a clientes
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {client.first_name ? `${client.last_name}, ${client.first_name}` : client.last_name}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priceTypeColors[client.price_type]}`}>
                {priceTypeLabels[client.price_type]}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                client.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${client.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                {client.status === "active" ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
          <Link
            href={`/clients/${id}/edit`}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            <Edit2 size={15} />
            Editar cliente
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Contact info */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-chocolate/70 mb-4">
              Datos de contacto
            </h2>
            <dl className="space-y-3">
              {client.phone && (
                <div className="flex items-start gap-3">
                  <Phone size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <dt className="text-xs text-gray-400">Teléfono</dt>
                    <dd className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{client.phone}</span>
                      <a
                        href={buildWhatsAppUrl(client.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir WhatsApp"
                        className="text-gray-300 hover:text-green-500 transition-colors flex-shrink-0"
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </a>
                    </dd>
                  </div>
                </div>
              )}
              {client.email && (
                <div className="flex items-start gap-3">
                  <Mail size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-400">Email</dt>
                    <dd className="text-sm font-medium text-gray-800">{client.email}</dd>
                  </div>
                </div>
              )}
              {(client.address || client.city) && (
                <div className="flex items-start gap-3">
                  <MapPin size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-400">Dirección</dt>
                    <dd className="text-sm font-medium text-gray-800">
                      {[client.address, client.city].filter(Boolean).join(", ")}
                    </dd>
                  </div>
                </div>
              )}
              {client.last_contact_date && (
                <div className="flex items-start gap-3">
                  <Calendar size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <dt className="text-xs text-gray-400">Último contacto</dt>
                    <dd className="text-sm font-medium text-gray-800">
                      {new Date(client.last_contact_date).toLocaleDateString("es-AR")}
                    </dd>
                  </div>
                </div>
              )}
              {!client.phone && !client.email && !client.address && !client.city && (
                <p className="text-sm text-gray-400">Sin datos de contacto registrados.</p>
              )}
            </dl>
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={15} className="text-gray-400" />
                <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-chocolate/70">
                  Notas
                </h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{client.notes}</p>
            </div>
          )}
        </div>

        {/* Order history */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag size={16} className="text-chocolate/60" />
              <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-chocolate/70">
                Historial de pedidos
              </h2>
            </div>
            <OrderHistoryTable orders={clientOrders} />
          </div>
        </div>
      </div>
    </div>
  );
}
