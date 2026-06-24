import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import MaterialForm from "@/components/materials/MaterialForm";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .single();

  if (!material) notFound();

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
        <h1 className="text-2xl font-bold text-gray-900">Editar insumo</h1>
        <p className="text-gray-500 mt-0.5">{material.name}</p>
      </div>
      <div className="max-w-lg">
        <MaterialForm mode="edit" initialData={material} />
      </div>
    </div>
  );
}
