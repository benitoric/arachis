import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();

  // Return cached rate for this exact date if available
  const { data: existing } = await supabase
    .from("exchange_rates")
    .select("rate, date")
    .lte("date", date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.date === date) {
    return NextResponse.json({ rate: existing.rate, date: existing.date, source: "cache" });
  }

  const today = new Date().toISOString().slice(0, 10);

  // 1. Try argentinadatos.com (supports historical and current dates)
  try {
    const url = `https://api.argentinadatos.com/v1/cotizaciones/dolares/oficial?fecha_desde=${date}&fecha_hasta=${date}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "arachis-erp/1.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const body = await res.json() as Array<{ fecha: string; venta?: number }>;
      if (Array.isArray(body)) {
        const found = body.find((r) => r.fecha === date && typeof r.venta === "number" && r.venta > 0);
        if (found?.venta) {
          await supabase
            .from("exchange_rates")
            .upsert({ date, rate: found.venta, source: "argentinadatos" }, { onConflict: "date" });
          return NextResponse.json({ rate: found.venta, date, source: "argentinadatos" });
        }
      }
    }
  } catch { /* fall through */ }

  // 2. Fallback: dolarapi.com (only provides current rate — useful for today)
  if (date === today) {
    try {
      const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
        headers: { "User-Agent": "arachis-erp/1.0" },
        cache: "no-store",
      });
      if (res.ok) {
        const body = await res.json() as { venta?: number };
        const rate = body.venta;
        if (typeof rate === "number" && rate > 0) {
          await supabase
            .from("exchange_rates")
            .upsert({ date, rate, source: "dolarapi" }, { onConflict: "date" });
          return NextResponse.json({ rate, date, source: "dolarapi" });
        }
      }
    } catch { /* fall through */ }
  }

  // 3. Return last available cached rate as fallback
  if (existing) {
    return NextResponse.json({ rate: existing.rate, date: existing.date, source: "cache_fallback" });
  }

  return NextResponse.json({ error: "No hay tipo de cambio disponible" }, { status: 404 });
}
