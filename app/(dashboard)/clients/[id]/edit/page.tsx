import { createClient } from "@/lib/supabase/server";
import ClientForm from "@/components/clients/ClientForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/clients/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-chocolate transition-colors mb-3"
        >
          <ChevronLeft size={16} />
          Volver al cliente
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Editar cliente</h1>
        <p className="text-gray-500 mt-0.5">{client.first_name ? `${client.last_name}, ${client.first_name}` : client.last_name}</p>
      </div>
      <ClientForm mode="edit" initialData={client} />
    </div>
  );
}
