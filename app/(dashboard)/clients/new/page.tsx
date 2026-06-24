import ClientForm from "@/components/clients/ClientForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewClientPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a clientes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo cliente</h1>
        <p className="text-gray-500 mt-0.5">Completá los datos del nuevo cliente</p>
      </div>
      <ClientForm mode="create" />
    </div>
  );
}
