import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pName } from "@/lib/utils/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("[portal/catalog] Admin client init failed:", err);
    return NextResponse.json({ ok: false, error: "Configuración del servidor incompleta." }, { status: 500 });
  }

  const [{ data: products, error: pErr }, { data: costs, error: cErr }, { data: images, error: iErr }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, presentation, image_url")
      .eq("active", true)
      .eq("show_in_portal", true)
      .order("name"),
    supabase.from("product_costs").select("product_id, price_minorista"),
    supabase.from("product_images").select("product_id, url, position").order("position"),
  ]);

  if (pErr || cErr || iErr) {
    console.error("[portal/catalog] Lookup error:", pErr ?? cErr ?? iErr);
    return NextResponse.json({ ok: false, error: "No se pudo cargar el catálogo." }, { status: 500 });
  }

  const priceMap = new Map<string, number>();
  for (const c of costs ?? []) {
    if (c.price_minorista != null && c.price_minorista > 0) {
      priceMap.set(c.product_id, c.price_minorista);
    }
  }

  const imagesMap = new Map<string, string[]>();
  for (const img of images ?? []) {
    if (!imagesMap.has(img.product_id)) imagesMap.set(img.product_id, []);
    imagesMap.get(img.product_id)!.push(img.url);
  }

  const items = (products ?? [])
    .filter((p) => priceMap.has(p.id))
    .map((p) => {
      const productImages = imagesMap.get(p.id) ?? [];
      const allImages = productImages.length > 0
        ? productImages
        : p.image_url ? [p.image_url] : [];
      return {
        id: p.id,
        name: pName(p),
        price_minorista: priceMap.get(p.id)!,
        image_url: allImages[0] ?? null,
        images: allImages,
      };
    });

  return NextResponse.json({ ok: true, items });
}
