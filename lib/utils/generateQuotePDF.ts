import type { Database } from "@/lib/types/database";

type Quote = Database["public"]["Tables"]["quotes"]["Row"];
type QuoteItem = Database["public"]["Tables"]["quote_items"]["Row"];

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

const BLUE: [number, number, number] = [73, 120, 157];   // #49789d
const CORAL: [number, number, number] = [232, 71, 95];   // #E8475F
const NAVY: [number, number, number] = [30, 58, 82];     // #1e3a52
const LIGHT_BG: [number, number, number] = [240, 246, 251];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [100, 100, 100];
const WHITE: [number, number, number] = [255, 255, 255];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

async function imageToBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function generateQuotePDF(quote: QuoteWithItems): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const ML = 15; // left margin
  const MR = 15; // right margin
  const CW = pageW - ML - MR; // content width = 180mm

  // ── HEADER ────────────────────────────────────────────────────
  // Logo
  try {
    const logo = await imageToBase64("/logo.png");
    doc.addImage(logo, "PNG", ML, 12, 38, 15);
  } catch {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BLUE);
    doc.text("Arachis", ML, 22);
  }

  // Company name + contact
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text("Arachis", ML + 42, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    "Tel: +54 381 206 7869   |   arachistuc@gmail.com   |   @arachis.tucuman",
    ML + 42,
    24.5
  );

  // Divider
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.6);
  doc.line(ML, 32, pageW - MR, 32);

  // Quote number (left) and date (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...BLUE);
  doc.text(
    `Presupuesto N° ${String(quote.quote_number).padStart(4, "0")}`,
    ML,
    41
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Fecha: ${fmtDate(quote.date)}`, pageW - MR, 41, { align: "right" });

  // ── CLIENT BOX ─────────────────────────────────────────────────
  let y = 47;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ML, y, CW, 20, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BLUE);
  doc.text("DATOS DEL CLIENTE", ML + 3, y + 5.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(quote.client_name, ML + 3, y + 12);
  if (quote.client_phone)
    doc.text(`Tel: ${quote.client_phone}`, ML + 75, y + 12);
  if (quote.client_email)
    doc.text(`Email: ${quote.client_email}`, ML + 130, y + 12);

  // ── EVENT BOX ──────────────────────────────────────────────────
  y += 25;
  const eventParts: string[] = [];
  if (quote.event_type) eventParts.push(`Evento: ${quote.event_type}`);
  if (quote.event_date) eventParts.push(`Fecha: ${fmtDate(quote.event_date)}`);
  if (quote.estimated_guests)
    eventParts.push(`Personas: ${quote.estimated_guests}`);

  if (eventParts.length > 0) {
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(ML, y, CW, 20, 2, 2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE);
    doc.text("DATOS DEL EVENTO", ML + 3, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(eventParts.join("   |   "), ML + 3, y + 12);
    y += 25;
  }

  // ── ITEMS TABLE ─────────────────────────────────────────────────
  y += 4;

  // Build table rows (client sees prices, NOT costs)
  const tableBody: (string | number)[][] = quote.items.map((item) => [
    item.product_name,
    item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(2),
    fmt(item.unit_price),
    fmt(item.unit_price * item.quantity),
  ]);

  if (quote.labor_cost > 0) {
    tableBody.push(["Mano de obra", "—", "—", fmt(quote.labor_cost)]);
  }
  if (quote.extra_charge_amount > 0) {
    tableBody.push([
      quote.extra_charge_description || "Cargos adicionales",
      "—",
      "—",
      fmt(quote.extra_charge_amount),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Artículo", "Cant.", "Precio unit.", "Subtotal"]],
    body: tableBody,
    margin: { left: ML, right: MR },
    headStyles: {
      fillColor: BLUE,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 9,
      halign: "left",
    },
    bodyStyles: { fontSize: 9, textColor: DARK },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "right", cellWidth: 38 },
      3: { halign: "right", cellWidth: 38 },
    },
    alternateRowStyles: { fillColor: [248, 252, 255] },
    theme: "grid",
    tableLineColor: [220, 228, 235],
    tableLineWidth: 0.2,
  });

  // ── TOTAL BOX ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  const boxW = 70;
  const boxX = pageW - MR - boxW;
  doc.setFillColor(...CORAL);
  doc.roundedRect(boxX, y, boxW, 18, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text("TOTAL FINAL", boxX + boxW / 2, y + 6.5, { align: "center" });

  doc.setFontSize(14);
  doc.text(fmt(quote.final_price), boxX + boxW / 2, y + 14, {
    align: "center",
  });

  y += 26;

  // ── CONDITIONS ────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLUE);
  doc.text("CONDICIONES", ML, y);
  y += 5;

  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.3);
  doc.line(ML, y, pageW - MR, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);

  const addConditionLine = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}: `, ML, y);
    const labelW = doc.getTextWidth(`${label}: `);
    doc.setFont("helvetica", "normal");
    doc.text(value, ML + labelW, y);
    y += 5.5;
  };

  addConditionLine(
    "Vigencia",
    `${quote.validity_days} días desde la emisión del presupuesto`
  );
  if (quote.payment_terms)
    addConditionLine("Modalidad de pago", quote.payment_terms);
  if (quote.notes) {
    addConditionLine("Notas", "");
    y -= 5.5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(quote.notes, CW - 20) as string[];
    doc.text(lines, ML + 14, y);
    y += lines.length * 5;
  }

  y += 4;

  // ── INCLUYE / NO INCLUYE ───────────────────────────────────────
  const colW = (CW - 8) / 2;

  // Incluye
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(ML, y, colW, 38, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("INCLUYE", ML + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  const includes = [
    "Caja de degustación, con fecha de",
    "  entrega a definir.",
    "Traslado, montaje y desmontaje de",
    "  la mesa dulce.",
    "Bases y soportes para la correcta",
    "  disposición de los productos.",
  ];
  includes.forEach((line, i) => {
    if (i % 2 === 0) {
      doc.setFont("helvetica", "bold");
      doc.text("•", ML + 4, y + 12 + Math.floor(i / 2) * 11);
    }
    doc.setFont("helvetica", "normal");
    doc.text(line, ML + 7, y + 12 + Math.floor(i / 2) * 11 + (i % 2 === 1 ? 5 : 0));
  });

  // No incluye
  const col2X = ML + colW + 8;
  doc.setFillColor(255, 245, 247);
  doc.roundedRect(col2X, y, colW, 38, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...CORAL);
  doc.text("NO INCLUYE", col2X + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...DARK);
  const excludes = [
    "Mobiliario, mantelería",
    "  y arreglos florales.",
  ];
  excludes.forEach((line, i) => {
    if (i % 2 === 0) {
      doc.setFont("helvetica", "bold");
      doc.text("•", col2X + 4, y + 12 + Math.floor(i / 2) * 11);
    }
    doc.setFont("helvetica", "normal");
    doc.text(line, col2X + 7, y + 12 + Math.floor(i / 2) * 11 + (i % 2 === 1 ? 5 : 0));
  });

  y += 46;

  // ── FOOTER ─────────────────────────────────────────────────────
  doc.setDrawColor(...BLUE);
  doc.setLineWidth(0.4);
  doc.line(ML, y, pageW - MR, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BLUE);
  doc.text("Arachis", ML, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(
    `Emitido el ${new Date().toLocaleDateString("es-AR")}`,
    pageW - MR,
    y,
    { align: "right" }
  );

  doc.save(`presupuesto-${String(quote.quote_number).padStart(4, "0")}.pdf`);
}
