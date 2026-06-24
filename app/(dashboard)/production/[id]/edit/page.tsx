import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import ProductionForm from "@/components/production/ProductionForm";

export default async function EditProductionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: log } = await supabase
    .from("production_logs")
    .select("*")
    .eq("id", id)
    .single();

  if (!log) notFound();

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
        <h1 className="text-2xl font-bold text-gray-900">Editar producción</h1>
        <p className="text-gray-500 mt-0.5">
          {new Date(log.date + "T12:00:00").toLocaleDateString("es-AR")}
        </p>
      </div>
      <div className="max-w-2xl">
        <ProductionForm mode="edit" initialData={log} />
      </div>
    </div>
  );
}
