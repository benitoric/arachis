interface OrderItemNotify {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface PortalOrderNotifyPayload {
  orderNumber: number;
  firstName: string;
  lastName: string;
  phone: string;
  items: OrderItemNotify[];
  total: number;
  desiredDate: string;
  paymentMethod: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);

export async function sendPortalOrderWhatsApp(payload: PortalOrderNotifyPayload): Promise<void> {
  const cmPhone = process.env.CALLMEBOT_PHONE;
  const cmApiKey = process.env.CALLMEBOT_APIKEY;

  if (!cmPhone || !cmApiKey) {
    console.error("[whatsapp-notify] Missing CALLMEBOT_PHONE or CALLMEBOT_APIKEY");
    return;
  }

  const itemLines = payload.items
    .map((it) => `- ${it.quantity}x ${it.product_name} (${fmt(it.unit_price)})`)
    .join("\n");

  const message = [
    `Arachis Nuevo pedido #${String(payload.orderNumber).padStart(4, "0")}`,
    `Cliente: ${payload.lastName}, ${payload.firstName}`,
    `Tel: ${payload.phone}`,
    `Artículos:`,
    itemLines,
    `Total: ${fmt(payload.total)}`,
    `Entrega: ${payload.desiredDate || "-"}`,
    `Pago: ${payload.paymentMethod}`,
  ].join("\n");

  const url = `https://api.callmebot.com/whatsapp.php?phone=${cmPhone}&text=${encodeURIComponent(message)}&apikey=${cmApiKey}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[whatsapp-notify] CallMeBot returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error("[whatsapp-notify] Fetch error:", err);
  }
}
