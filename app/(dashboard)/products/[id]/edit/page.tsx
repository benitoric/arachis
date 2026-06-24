import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import ProductForm from "@/components/products/ProductForm";
import type { RecipeEntry, ExistingImage } from "@/components/products/ProductForm";
import { pName } from "@/lib/utils/product";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: recipes }, { data: productImages }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase
      .from("recipes")
      .select("id, material_id, quantity, material:materials(id, name, unit)")
      .eq("product_id", id),
    supabase.from("product_images").select("id, url, storage_path, position").eq("product_id", id).order("position"),
  ]);

  if (!product) notFound();

  const initialImages: ExistingImage[] = (productImages ?? []).map((img) => ({
    id: img.id,
    url: img.url,
    storage_path: img.storage_path,
  }));

  const initialRecipe: RecipeEntry[] = (recipes ?? []).map((r) => {
    const mat = r.material as unknown as { id: string; name: string; unit: string } | null;
    return {
      id: r.id,
      material_id: r.material_id,
      quantity: r.quantity,
      material_name: mat?.name ?? "",
      material_unit: mat?.unit ?? "",
    };
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Editar artículo</h1>
        <p className="text-gray-500 mt-0.5">{pName(product)}</p>
      </div>
      <ProductForm mode="edit" initialData={product} initialRecipe={initialRecipe} initialImages={initialImages} />
    </div>
  );
}
