import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, isPlausibleArgPhone } from "@/lib/utils/phone";
import { pName } from "@/lib/utils/product";
import { sendPortalOrderWhatsApp } from "@/lib/utils/whatsapp-notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingItem {
  product_id: string;
  quantity: number;
}

interface IncomingPayload {
  guestFirstName?: string;
  guestLastName?: string;
  guestPhone?: string;
  guestCity?: string;
  guestEmail?: string;
  desiredDate?: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  notes?: string;
  items?: IncomingItem[];
}

const MAX_QTY_PER_ITEM = 100;
const MAX_ITEMS_PER_ORDER = 50;
const MAX_NOTES_LENGTH = 1000;
const PAYMENT_METHODS = new Set(["efectivo", "transferencia"]);
const DELIVERY_METHODS = new Set(["retiro", "cadeteria"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  let body: IncomingPayload;
  try {
    body = await request.json();
  } catch {
    return bad("El cuerpo del pedido no es válido.");
  }

  const firstName = (body.guestFirstName ?? "").trim();
  const lastName = (body.guestLastName ?? "").trim();
  const phoneRaw = (body.guestPhone ?? "").trim();
  const city = (body.guestCity ?? "").trim();
  const email = (body.guestEmail ?? "").trim();
  const desiredDate = (body.desiredDate ?? "").trim();
  const paymentMethod = (body.paymentMethod ?? "").trim();
  const deliveryMethod = (body.deliveryMethod ?? "").trim();
  const notes = (body.notes ?? "").trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!firstName) return bad("Ingresá tu nombre.");
  if (!lastName) return bad("Ingresá tu apellido.");
  if (!phoneRaw || !isPlausibleArgPhone(phoneRaw)) return bad("Ingresá un teléfono válido.");
  if (!city) return bad("Ingresá tu ciudad.");
  if (!email) return bad("Ingresá tu email.");
  if (!EMAIL_RE.test(email)) return bad("El email ingresado no es válido.");
  if (!desiredDate) return bad("Seleccioná una fecha de entrega.");

  const today = new Date().toISOString().slice(0, 10);
  if (desiredDate < today) return bad("La fecha de entrega no puede ser en el pasado.");

  if (!PAYMENT_METHODS.has(paymentMethod)) return bad("Seleccioná una modalidad de pago válida.");
  if (!DELIVERY_METHODS.has(deliveryMethod)) return bad("Seleccioná una modalidad de entrega válida.");
  if (notes.length > MAX_NOTES_LENGTH) return bad("Las notas son demasiado largas.");

  if (items.length === 0) return bad("Agregá al menos un artículo al pedido.");
  if (items.length > MAX_ITEMS_PER_ORDER) return bad("Demasiados artículos en el pedido.");

  const cleanItems: { product_id: string; quantity: number }[] = [];
  for (const it of items) {
    if (!it || typeof it.product_id !== "string" || !it.product_id) {
      return bad("Hay un artículo inválido en el pedido.");
    }
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY_PER_ITEM) {
      return bad("Hay una cantidad inválida en el pedido.");
    }
    cleanItems.push({ product_id: it.product_id, quantity: qty });
  }

  const productIds = Array.from(new Set(cleanItems.map((it) => it.product_id)));

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    console.error("[portal/create-order] Admin client init failed:", err);
    return bad("Error de configuración del servidor. Intentá nuevamente más tarde.", 500);
  }

  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, name, presentation, active, show_in_portal")
    .in("id", productIds);

  if (pErr) {
    console.error("[portal/create-order] Products lookup error:", pErr);
    return bad("No se pudo validar el catálogo. Intentá nuevamente.", 500);
  }

  const productMap = new Map(
    (products ?? [])
      .filter((p) => p.active && p.show_in_portal)
      .map((p) => [p.id, p])
  );

  for (const id of productIds) {
    if (!productMap.has(id)) {
      return bad("Alguno de los artículos seleccionados ya no está disponible. Volvé a cargar el catálogo.");
    }
  }

  const { data: costs, error: cErr } = await supabase
    .from("product_costs")
    .select("product_id, price_minorista")
    .in("product_id", productIds);

  if (cErr) {
    console.error("[portal/create-order] Costs lookup error:", cErr);
    return bad("No se pudo validar los precios. Intentá nuevamente.", 500);
  }

  const priceMap = new Map<string, number>();
  for (const c of costs ?? []) {
    if (c.price_minorista != null && c.price_minorista > 0) {
      priceMap.set(c.product_id, c.price_minorista);
    }
  }

  for (const id of productIds) {
    if (!priceMap.has(id)) {
      return bad("Alguno de los artículos no tiene precio asignado. Volvé a cargar el catálogo.");
    }
  }

  const phone = normalizePhone(phoneRaw);

  const { data: newOrder, error: oErr } = await supabase
    .from("orders")
    .insert({
      guest_name: `${firstName} ${lastName}`,
      guest_phone: phone,
      guest_email: email || null,
      guest_city: city,
      desired_date: desiredDate,
      payment_method: paymentMethod as "efectivo" | "transferencia",
      delivery_method: deliveryMethod as "retiro" | "cadeteria",
      notes: notes || null,
      status: "pendiente",
      origin: "portal",
      order_date: today,
    })
    .select("id, order_number")
    .single();

  if (oErr || !newOrder) {
    console.error("[portal/create-order] Order insert error:", oErr);
    return bad("No se pudo registrar el pedido. Intentá nuevamente.", 500);
  }

  const orderItemsRows = cleanItems.map((it) => ({
    order_id: newOrder.id,
    product_id: it.product_id,
    quantity: it.quantity,
    unit_price: priceMap.get(it.product_id)!,
  }));

  const { error: iErr } = await supabase.from("order_items").insert(orderItemsRows);

  if (iErr) {
    console.error("[portal/create-order] Order items insert error:", iErr);
    // Best-effort cleanup: if items failed, remove the orphan order so it doesn't show empty in the dashboard.
    await supabase.from("orders").delete().eq("id", newOrder.id);
    return bad("No se pudo registrar los artículos del pedido. Intentá nuevamente.", 500);
  }

  const total = orderItemsRows.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);

  const { error: nErr } = await supabase.from("notifications").insert({
    type: "nuevo_pedido_portal",
    message: `Nuevo pedido del portal de ${firstName} ${lastName} — ${fmt(total)}`,
    read: false,
    order_id: newOrder.id,
  });
  if (nErr) {
    console.error("[portal/create-order] Notification insert error (non-fatal):", nErr);
  }

  // Esperamos al envío para no perder la notificación cuando la función serverless
  // se cierra al responder. El helper captura sus propios errores, así que no aborta
  // la respuesta al cliente.
  await sendPortalOrderWhatsApp({
    orderNumber: newOrder.order_number,
    firstName,
    lastName,
    phone: phoneRaw,
    items: cleanItems.map((it) => {
      const product = productMap.get(it.product_id)!;
      return {
        product_name: pName(product),
        quantity: it.quantity,
        unit_price: priceMap.get(it.product_id)!,
      };
    }),
    total,
    desiredDate,
    paymentMethod,
  });

  return NextResponse.json({
    ok: true,
    orderId: newOrder.id,
    orderNumber: newOrder.order_number,
  });
}
