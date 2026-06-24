import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: manual entry { date, rate }
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const body = await request.json() as { date?: string; rate?: number };
  if (!body.date || !body.rate || body.rate <= 0) {
    return NextResponse.json({ error: "Se requiere fecha y tipo de cambio válido." }, { status: 400 });
  }
  const { error } = await supabase
    .from("exchange_rates")
    .upsert({ date: body.date, rate: body.rate, source: "manual" }, { onConflict: "date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, date: body.date, rate: body.rate });
}

// GET: load historical rates from argentinadatos.com, fallback to dolarapi
export async function GET() {
  const supabase = await createClient();

  // Find earliest operation date across all tables
  const [
    { data: orders },
    { data: purchases },
    { data: expenses },
    { data: events },
  ] = await Promise.all([
    supabase.from("orders").select("order_date").order("order_date").limit(1),
    supabase.from("purchases").select("date").order("date").limit(1),
    supabase.from("indirect_expenses").select("date").order("date").limit(1),
    supabase.from("event_results").select("date").order("date").limit(1),
  ]);

  const candidates = [
    orders?.[0]?.order_date,
    purchases?.[0]?.date,
    expenses?.[0]?.date,
    events?.[0]?.date,
  ].filter(Boolean) as string[];

  const today = new Date().toISOString().slice(0, 10);
  const twoYearsAgo = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const earliest = candidates.length > 0 ? [...candidates].sort()[0] : twoYearsAgo;
  const from = earliest < twoYearsAgo ? twoYearsAgo : earliest;

  // 1. Try argentinadatos.com (provides full historical range)
  let rows: { date: string; rate: number; source: string }[] = [];
  let source = "";
  try {
    const url = `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial?fecha_desde=${from}&fecha_hasta=${today}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "arachis-erp/1.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const body = await res.json() as Array<{ fecha: string; venta?: number }>;
      if (Array.isArray(body)) {
        rows = body
          .filter((r) => typeof r.venta === "number" && r.venta > 0)
          .map((r) => ({ date: r.fecha, rate: r.venta!, source: "argentinadatos" }));
        source = "argentinadatos";
      }
    }
  } catch { /* fall through */ }

  // 2. Fallback: dolarapi.com (only provides current rate)
  if (rows.length === 0) {
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
        headers: { "User-Agent": "arachis-erp/1.0" },
        cache: "no-store",
      });
      if (res.ok) {
        const body = await res.json() as { venta?: number };
        if (typeof body.venta === "number" && body.venta > 0) {
          rows = [{ date: today, rate: body.venta, source: "dolarapi" }];
          source = "dolarapi";
        }
      }
    } catch { /* fall through */ }
  }

  if (rows.length === 0) {
    return NextResponse.json(
      {
        error: "No se pudo conectar a ninguna fuente de tipos de cambio. Cargá los valores manualmente.",
        manual: true,
      },
      { status: 502 }
    );
  }

  // Insert ignoring duplicates (don't overwrite manually loaded rates)
  const { error } = await supabase
    .from("exchange_rates")
    .upsert(rows, { onConflict: "date", ignoreDuplicates: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ loaded: rows.length, from, to: today, source });
}
