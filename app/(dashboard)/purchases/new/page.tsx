import Link from "next/link";
import { ChevronLeft, Copy } from "lucide-react";
import PurchaseForm from "@/components/purchases/PurchaseForm";
import { createClient } from "@/lib/supabase/server";

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ duplicate?: string }>;
}) {
  const { duplicate } = await searchParams;

  let initialData: React.ComponentProps<typeof PurchaseForm>["initialData"];

  if (duplicate) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("purchases")
      .select("*")
      .eq("id", duplicate)
      .single();
    if (data) {
      initialData = data;
    }
  }

  const isDuplicate = Boolean(initialData);

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
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          {isDuplicate && <Copy size={20} className="text-blue-500" />}
          {isDuplicate ? "Duplicar compra" : "Nueva compra"}
        </h1>
        <p className="text-gray-500 mt-0.5">
          {isDuplicate
            ? "Revisá los datos copiados y guardá como una compra nueva"
            : "Registrá una compra de insumos"}
        </p>
      </div>
      <div className="max-w-5xl">
        <PurchaseForm mode="create" initialData={initialData} />
      </div>
    </div>
  );
}
