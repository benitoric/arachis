import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ProductForm from "@/components/products/ProductForm";

export default function NewProductPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a artículos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nuevo artículo</h1>
        <p className="text-gray-500 mt-0.5">Completá los datos del nuevo artículo y su receta</p>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
