"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Eye,
  UserX,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Loader2,
} from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/utils/whatsapp";
import { useSortableData } from "@/hooks/useSortableData";
import SortableHeader from "@/components/ui/SortableHeader";

type Client = Database["public"]["Tables"]["clients"]["Row"];

function clientDisplayName(c: { last_name: string; first_name: string }) {
  return c.first_name ? `${c.last_name}, ${c.first_name}` : c.last_name;
}

const WA_ICON = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const PRICE_TYPE_LABELS: Record<string, string> = {
  minorista: "Minorista",
  mayorista: "Mayorista",
  otra: "Otra",
};

const PRICE_TYPE_COLORS: Record<string, string> = {
  minorista: "bg-blue-100 text-blue-700",
  mayorista: "bg-purple-100 text-purple-700",
  otra: "bg-amber-100 text-amber-700",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priceTypeFilter, setPriceTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { sorted: clientsSorted, sort, toggleSort } = useSortableData(clients as any[]);
  const sortedClients = clientsSorted as Client[];

  const fetchClients = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("clients")
      .select("*")
      .order("last_name")
      .order("first_name");

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (priceTypeFilter !== "all") {
      query = query.eq("price_type", priceTypeFilter as "minorista" | "mayorista" | "otra");
    }
    if (search.trim()) {
      query = query.or(`last_name.ilike.%${search.trim()}%,first_name.ilike.%${search.trim()}%`);
    }

    const { data } = await query;
    setClients(data ?? []);
    setLoading(false);
  }, [supabase, search, priceTypeFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchClients, 300);
    return () => clearTimeout(timer);
  }, [fetchClients]);

  async function handleDeactivate(id: string) {
    if (!confirm("¿Dar de baja este cliente?")) return;
    await supabase.from("clients").update({ status: "inactive" }).eq("id", id);
    fetchClients();
  }

  async function handleActivate(id: string) {
    await supabase.from("clients").update({ status: "active" }).eq("id", id);
    fetchClients();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-0.5">Gestión del CRM</p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-2 bg-chocolate hover:bg-dark-red text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nuevo cliente
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por apellido o nombre..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
            />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={priceTypeFilter}
              onChange={(e) => setPriceTypeFilter(e.target.value)}
              className="pl-8 pr-8 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer appearance-none"
            >
              <option value="all">Todos los tipos</option>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
              <option value="otra">Otra</option>
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
          >
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
            <option value="all">Todos</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gold" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4">
              <Search size={24} className="text-gold" />
            </div>
            <p className="text-gray-500 font-medium">No se encontraron clientes</p>
            <p className="text-sm text-gray-400 mt-1">
              {search ? "Probá con otro término de búsqueda" : "Creá el primer cliente con el botón de arriba"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <SortableHeader label="Cliente" sortKey="last_name" sort={sort} onSort={toggleSort} className="px-3" />
                  <SortableHeader label="Contacto" sortKey="email" sort={sort} onSort={toggleSort} className="hidden md:table-cell px-2" />
                  <SortableHeader label="Ciudad" sortKey="city" sort={sort} onSort={toggleSort} className="hidden lg:table-cell px-2" />
                  <SortableHeader label="Tipo" sortKey="price_type" sort={sort} onSort={toggleSort} className="px-2" />
                  <SortableHeader label="Estado" sortKey="status" sort={sort} onSort={toggleSort} className="hidden sm:table-cell px-2" />
                  <th className="px-2 py-3 w-24"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-3 py-3 max-w-[180px]">
                      <p className="font-medium text-gray-900 truncate">{clientDisplayName(client)}</p>
                      {client.email && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 md:hidden truncate">
                          <Mail size={11} className="flex-shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-3 hidden md:table-cell max-w-[220px]">
                      <div className="space-y-0.5 min-w-0">
                        {client.phone && (
                          <p className="text-sm text-gray-600 flex items-center gap-1.5 whitespace-nowrap">
                            <Phone size={12} className="text-gray-400 flex-shrink-0" />
                            {client.phone}
                            <a
                              href={buildWhatsAppUrl(client.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-500 hover:text-green-600 transition-colors"
                              title="Abrir WhatsApp"
                            >
                              {WA_ICON}
                            </a>
                          </p>
                        )}
                        {client.email && (
                          <p className="text-sm text-gray-600 flex items-center gap-1.5 min-w-0">
                            <Mail size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{client.email}</span>
                          </p>
                        )}
                        {!client.phone && !client.email && (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 hidden lg:table-cell">
                      {client.city ? (
                        <span className="text-sm text-gray-600 flex items-center gap-1.5 whitespace-nowrap">
                          <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                          {client.city}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${PRICE_TYPE_COLORS[client.price_type]}`}>
                        {PRICE_TYPE_LABELS[client.price_type]}
                      </span>
                    </td>
                    <td className="px-2 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        client.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${client.status === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                        {client.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link
                          href={`/clients/${client.id}`}
                          className="p-1.5 text-gray-400 hover:text-chocolate hover:bg-cream rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye size={15} />
                        </Link>
                        <Link
                          href={`/clients/${client.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </Link>
                        {client.status === "active" ? (
                          <button
                            onClick={() => handleDeactivate(client.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Dar de baja"
                          >
                            <UserX size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(client.id)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Reactivar"
                          >
                            <UserCheck size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && clients.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/30">
            <p className="text-xs text-gray-400">
              {clients.length} cliente{clients.length !== 1 ? "s" : ""} encontrado{clients.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
