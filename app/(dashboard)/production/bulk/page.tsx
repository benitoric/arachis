import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import BulkProductionForm from "@/components/production/BulkProductionForm";

export default function BulkProductionPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/production"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a producción
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Registrar producción</h1>
        <p className="text-gray-500 mt-0.5">
          Cargá todas las variedades producidas en un mismo día
        </p>
      </div>
      <div className="max-w-4xl">
        <BulkProductionForm />
      </div>
    </div>
  );
}
