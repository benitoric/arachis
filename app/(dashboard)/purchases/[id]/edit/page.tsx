import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import PurchaseForm from "@/components/purchases/PurchaseForm";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: purchase } = await supabase
    .from("purchases")
    .select("*")
    .eq("id", id)
    .single();

  if (!purchase) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/purchases"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a compras
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar compra</h1>
        <p className="text-gray-500 mt-0.5">
          {new Date(purchase.date + "T12:00:00").toLocaleDateString("es-AR")}
        </p>
      </div>
      <div className="max-w-2xl">
        <PurchaseForm mode="edit" initialData={purchase} />
      </div>
    </div>
  );
}
