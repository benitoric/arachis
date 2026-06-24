import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import MaterialForm from "@/components/materials/MaterialForm";

export default function NewMaterialPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/materials"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a insumos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo insumo</h1>
        <p className="text-gray-500 mt-0.5">Completá los datos del nuevo insumo</p>
      </div>
      <div className="max-w-lg">
        <MaterialForm mode="create" />
      </div>
    </div>
  );
}
