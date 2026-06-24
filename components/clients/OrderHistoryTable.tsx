"use client";

import { useRouter } from "next/navigation";
import { ShoppingBag, CheckCircle } from "lucide-react";

export interface ClientOrder {
  id: string;
  order_number: number | null;
  order_date: string;
  status: "pendiente" | "confirmado" | "cumplido" | "anulado";
  delivered_date: string | null;
  total: number;
  paid: number;
  balance: number;
  itemsSummary: string;
}

interface Props {
  orders: ClientOrder[];
}

const STATUS_LABEL: Record<ClientOrder["status"], string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  cumplido: "Cumplido",
  anulado: "Anulado",
};
const STATUS_STYLE: Record<ClientOrder["status"], string> = {
  pendiente: "bg-amber-100 text-amber-700",
  confirmado: "bg-blue-100 text-blue-700",
  cumplido: "bg-teal-100 text-teal-700",
  anulado: "bg-red-100 text-red-600",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export default function OrderHistoryTable({ orders }: Props) {
  const router = useRouter();

  const grandTotal = orders.reduce((acc, o) => acc + o.total, 0);
  const grandPaid = orders.reduce((acc, o) => acc + o.paid, 0);
  const grandBalance = grandTotal - grandPaid;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShoppingBag size={40} className="text-gray-200 mb-3" />
        <p className="text-sm font-medium text-gray-400">Este cliente aún no tiene pedidos</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Pedidos", value: orders.length.toString() },
          { label: "Facturado", value: fmt(grandTotal) },
          { label: "Cobrado", value: fmt(grandPaid) },
          {
            label: "Saldo",
            value: fmt(grandBalance),
            highlight: grandBalance > 0.01,
          },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="bg-gray-50 rounded-lg px-3 py-2.5 text-center">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className={`text-sm font-bold ${highlight ? "text-amber-600" : "text-gray-800"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/70">
            <tr>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase">N°</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Fecha</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Artículos</th>
              <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Estado</th>
              <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Entrega</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.map((o) => (
              <tr
                key={o.id}
                onClick={() => router.push(`/orders/${o.id}`)}
                className="hover:bg-blue-50/40 cursor-pointer transition-colors"
              >
                <td className="px-5 py-3 font-mono font-medium text-gray-700">
                  #{String(o.order_number ?? "—").padStart(4, "0")}
                </td>
                <td className="px-3 py-3 text-gray-500 hidden sm:table-cell">
                  {fmtDate(o.order_date)}
                </td>
                <td className="px-3 py-3 text-gray-600 hidden md:table-cell max-w-xs truncate">
                  {o.itemsSummary || <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-gray-900">
                  {fmt(o.total)}
                </td>
                <td className="px-3 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[o.status]}`}>
                    {o.status === "cumplido" && <CheckCircle size={10} />}
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-gray-500 hidden lg:table-cell">
                  {o.delivered_date ? fmtDate(o.delivered_date) : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
