/**
 * Builds a wa.me URL for an Argentine phone number.
 * Strips leading 0 (trunk prefix) and 15 (mobile prefix) before prepending country code 54.
 */
export function buildWhatsAppUrl(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  // Already has country code
  if (digits.startsWith("54")) return `https://wa.me/${digits}`;

  // Remove leading 0 (trunk prefix)
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Remove 15 (mobile prefix) that appears after area code (2–4 digits)
  digits = digits.replace(/^(\d{2,4})15/, "$1");

  return `https://wa.me/54${digits}`;
}

export function buildWhatsAppTextUrl(phone: string, text: string): string {
  return `${buildWhatsAppUrl(phone)}?text=${encodeURIComponent(text)}`;
}
