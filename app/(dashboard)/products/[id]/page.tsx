import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft, Edit2 } from "lucide-react";
import { pName } from "@/lib/utils/product";
import { notFound } from "next/navigation";

const UNIT_LABELS: Record<string, string> = {
  gramos: "g",
  kg: "kg",
  litro: "litro",
  ml: "ml",
  unidad: "unidades",
  cm: "cm",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: recipes }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase
      .from("recipes")
      .select("id, quantity, material:materials(id, name, unit)")
      .eq("product_id", id)
      .order("id"),
  ]);

  if (!product) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
          >
            <ChevronLeft size={16} />
            Volver a artículos
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{pName(product)}</h1>
          <div className="mt-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                product.active
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  product.active ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              {product.active ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>
        <Link
          href={`/products/${product.id}/edit`}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Edit2 size={15} />
          Editar
        </Link>
      </div>

      {/* Recipe */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Receta / Ingredientes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {recipes && recipes.length > 0
              ? `${recipes.length} ingrediente${recipes.length !== 1 ? "s" : ""}`
              : "Sin ingredientes definidos"}
          </p>
        </div>

        {recipes && recipes.length > 0 ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                  Insumo
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                  Cantidad
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recipes.map((r) => {
                const mat = r.material as unknown as { id: string; name: string; unit: string } | null;
                return (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {mat?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {r.quantity}{" "}
                      {mat ? (UNIT_LABELS[mat.unit] ?? mat.unit) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">
            Este artículo no tiene ingredientes definidos todavía.
          </div>
        )}
      </div>
    </div>
  );
}
