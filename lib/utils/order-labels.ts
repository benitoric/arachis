export const PAYMENT_LABEL: Record<string, string> = {
  efectivo:     "Efectivo",
  transferencia: "Transferencia",
  sin_cargo:    "Sin cargo",
  canje:        "Canje",
};

export const ORIGIN_LABEL: Record<string, string> = {
  manual:       "Manual",
  portal:       "Portal",
  venta_rapida: "Venta rápida",
};

export const DELIVERY_LABEL: Record<string, string> = {
  retiro:       "Retiro en local",
  cadeteria:    "Cadetería",
  envio_gratis: "Envío gratis",
};

export function fmtPayment(v: string | null | undefined): string {
  if (!v) return "—";
  return PAYMENT_LABEL[v] ?? v;
}

export function fmtDelivery(v: string | null | undefined): string {
  if (!v) return "—";
  return DELIVERY_LABEL[v] ?? v;
}
