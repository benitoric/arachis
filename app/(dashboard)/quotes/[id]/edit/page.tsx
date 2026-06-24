"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import QuoteForm from "@/components/quotes/QuoteForm";
import type { Database } from "@/lib/types/database";

type Quote = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteItem = Database["public"]["Tables"]["quote_items"]["Row"];

interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

export default function EditQuotePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [data, setData] = useState<QuoteWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: q }, { data: its }] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", id).single(),
        supabase.from("quote_items").select("*").eq("quote_id", id).order("created_at"),
      ]);
      if (q) setData({ ...q, items: its ?? [] });
      setLoading(false);
    }
    load();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-gray-400">Presupuesto no encontrado.</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/quotes/${id}`)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Editar presupuesto #{String(data.quote_number).padStart(4, "0")}
          </h1>
          <p className="text-gray-500 mt-0.5">{data.client_name}</p>
        </div>
      </div>
      <QuoteForm initialData={data} />
    </div>
  );
}
