import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import ExpenseForm from "@/components/expenses/ExpenseForm";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: expense } = await supabase
    .from("indirect_expenses")
    .select("*")
    .eq("id", id)
    .single();

  if (!expense) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/expenses"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver a gastos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar gasto</h1>
        <p className="text-gray-500 mt-0.5">
          {new Date(expense.date + "T12:00:00").toLocaleDateString("es-AR")}
        </p>
      </div>
      <div className="max-w-2xl">
        <ExpenseForm mode="edit" initialData={expense} />
      </div>
    </div>
  );
}
