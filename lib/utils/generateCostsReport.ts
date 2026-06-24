const BLUE: [number, number, number] = [73, 120, 157];
const NAVY: [number, number, number] = [30, 58, 82];
const LIGHT_BG: [number, number, number] = [240, 246, 251];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY: [number, number, number] = [100, 100, 100];
const WHITE: [number, number, number] = [255, 255, 255];

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtDateTime = (d: Date) =>
  d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface ProductReportRow {
  name: string;
  direct_cost: number;
  labor_cost: number;
  total_cost: number;
  margin_percentage: number;
  price_minorista: number;
  discount_percentage: number;
  price_mayorista: number;
}

export interface MaterialReportRow {
  name: string;
  unit: string;
  last_purchase_cost: number | null;
  manual_unit_cost: number | null;
  effective_cost: number | null;
}

export interface HistoryReportRow {
  product_name: string;
  direct_cost: number;
  labor_cost: number;
  total_cost: number;
  margin_percentage: number;
  price_minorista: number;
  discount_percentage: number;
  price_mayorista: number;
}

interface ReportHeaderOpts {
  title: string;
  subtitle?: string;
  filtersSummary?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildHeader(doc: any, opts: ReportHeaderOpts) {
  const pageW = doc.internal.pageSize.getWidth();
  const ML = 15;

  const logo = await loadLogo();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", ML, 12, 30, 12);
    } catch {
      // ignore
    }
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text(opts.title, pageW - 15, 18, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text(`Generado: ${fmtDateTime(new Date())}`, pageW - 15, 24, { align: "right" });

  if (opts.subtitle) {
    doc.text(opts.subtitle, pageW - 15, 29, { align: "right" });
  }

  let y = 32;
  if (opts.filtersSummary && opts.filtersSummary.length > 0) {
    doc.setFillColor(...LIGHT_BG);
    const boxH = 6 + opts.filtersSummary.length * 4;
    doc.rect(ML, y, pageW - 30, boxH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...NAVY);
    doc.text("Filtros aplicados:", ML + 2, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    opts.filtersSummary.forEach((f, i) => {
      doc.text(`• ${f}`, ML + 4, y + 8 + i * 4);
    });
    y += boxH + 2;
  }

  return y;
}

export async function generateProductCostsReport(
  rows: ProductReportRow[],
  opts: { filtersSummary?: string[] } = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const startY = await buildHeader(doc, {
    title: "Listado de Costos y Precios",
    subtitle: `${rows.length} artículo${rows.length !== 1 ? "s" : ""}`,
    filtersSummary: opts.filtersSummary,
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.direct += r.direct_cost;
      acc.labor += r.labor_cost;
      acc.total += r.total_cost;
      acc.minorista += r.price_minorista;
      acc.mayorista += r.price_mayorista;
      return acc;
    },
    { direct: 0, labor: 0, total: 0, minorista: 0, mayorista: 0 }
  );

  autoTable(doc, {
    startY: startY + 4,
    head: [[
      "Artículo",
      "Costo dir.",
      "M.O.",
      "Total",
      "Mg%",
      "Precio min.",
      "Dto.%",
      "Precio may.",
    ]],
    body: rows.map((r) => [
      r.name,
      fmt(r.direct_cost),
      fmt(r.labor_cost),
      fmt(r.total_cost),
      `${r.margin_percentage.toFixed(1)}%`,
      fmt(r.price_minorista),
      `${r.discount_percentage.toFixed(1)}%`,
      fmt(r.price_mayorista),
    ]),
    foot: rows.length > 0
      ? [[
          "Totales",
          fmt(totals.direct),
          fmt(totals.labor),
          fmt(totals.total),
          "",
          fmt(totals.minorista),
          "",
          fmt(totals.mayorista),
        ]]
      : undefined,
    styles: { fontSize: 8, cellPadding: 2, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: "bold" },
    footStyles: { fillColor: LIGHT_BG, textColor: NAVY, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right" },
      5: { halign: "right", textColor: BLUE, fontStyle: "bold" },
      6: { halign: "right" },
      7: { halign: "right", textColor: NAVY, fontStyle: "bold" },
    },
    margin: { left: 15, right: 15 },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`costos-precios-${stamp}.pdf`);
}

export async function generateMaterialsReport(
  rows: MaterialReportRow[],
  opts: { filtersSummary?: string[] } = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const startY = await buildHeader(doc, {
    title: "Precios de Insumos",
    subtitle: `${rows.length} insumo${rows.length !== 1 ? "s" : ""}`,
    filtersSummary: opts.filtersSummary,
  });

  autoTable(doc, {
    startY: startY + 4,
    head: [["Insumo", "Unidad", "Últ. compra", "Manual", "Vigente"]],
    body: rows.map((r) => [
      r.name,
      r.unit,
      r.last_purchase_cost != null ? fmt(r.last_purchase_cost) : "—",
      r.manual_unit_cost != null ? fmt(r.manual_unit_cost) : "—",
      r.effective_cost != null && r.effective_cost > 0 ? fmt(r.effective_cost) : "Sin precio",
    ]),
    styles: { fontSize: 9, cellPadding: 2, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: {},
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 15, right: 15 },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`insumos-precios-${stamp}.pdf`);
}

export async function generateHistoryReport(
  rows: HistoryReportRow[],
  generatedDate: string,
  opts: { filtersSummary?: string[] } = {}
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const subtitle = `Lista del ${fmtDateTime(new Date(generatedDate))} · ${rows.length} artículo${rows.length !== 1 ? "s" : ""}`;
  const startY = await buildHeader(doc, {
    title: "Lista de Precios — Historial",
    subtitle,
    filtersSummary: opts.filtersSummary,
  });

  autoTable(doc, {
    startY: startY + 4,
    head: [[
      "Artículo",
      "Costo dir.",
      "M.O.",
      "Total",
      "Mg%",
      "Minorista",
      "Dto%",
      "Mayorista",
    ]],
    body: rows.map((r) => [
      r.product_name,
      fmt(r.direct_cost),
      fmt(r.labor_cost),
      fmt(r.total_cost),
      `${r.margin_percentage.toFixed(1)}%`,
      fmt(r.price_minorista),
      `${r.discount_percentage.toFixed(1)}%`,
      fmt(r.price_mayorista),
    ]),
    styles: { fontSize: 8, cellPadding: 2, textColor: DARK },
    headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right", fontStyle: "bold" },
      4: { halign: "right" },
      5: { halign: "right", textColor: BLUE, fontStyle: "bold" },
      6: { halign: "right" },
      7: { halign: "right", textColor: NAVY, fontStyle: "bold" },
    },
    margin: { left: 15, right: 15 },
  });

  const stamp = new Date(generatedDate).toISOString().slice(0, 10);
  doc.save(`lista-precios-${stamp}.pdf`);
}

function csvCell(s: string | number): string {
  const v = String(s ?? "");
  if (/[",;\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportProductCostsCSV(rows: ProductReportRow[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  const data: (string | number)[][] = [
    ["Artículo", "Costo directo", "M.O.", "Total", "Margen %", "Precio minorista", "Descuento %", "Precio mayorista"],
    ...rows.map((r) => [
      r.name,
      r.direct_cost,
      r.labor_cost,
      r.total_cost,
      r.margin_percentage,
      r.price_minorista,
      r.discount_percentage,
      r.price_mayorista,
    ]),
  ];
  downloadCSV(`costos-precios-${stamp}.csv`, data);
}

export function exportMaterialsCSV(rows: MaterialReportRow[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  const data: (string | number)[][] = [
    ["Insumo", "Unidad", "Último precio compra", "Precio manual", "Precio vigente"],
    ...rows.map((r) => [
      r.name,
      r.unit,
      r.last_purchase_cost ?? "",
      r.manual_unit_cost ?? "",
      r.effective_cost ?? "",
    ]),
  ];
  downloadCSV(`insumos-precios-${stamp}.csv`, data);
}

export function exportHistoryCSV(rows: HistoryReportRow[], generatedDate: string) {
  const stamp = new Date(generatedDate).toISOString().slice(0, 10);
  const data: (string | number)[][] = [
    ["Artículo", "Costo directo", "M.O.", "Total", "Margen %", "Minorista", "Descuento %", "Mayorista"],
    ...rows.map((r) => [
      r.product_name,
      r.direct_cost,
      r.labor_cost,
      r.total_cost,
      r.margin_percentage,
      r.price_minorista,
      r.discount_percentage,
      r.price_mayorista,
    ]),
  ];
  downloadCSV(`lista-precios-${stamp}.csv`, data);
}

// ── Excel (.xlsx) exports ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autoFitColumns(ws: any, rows: (string | number | null | undefined)[][]) {
  if (rows.length === 0) return;
  const widths: number[] = rows[0].map(() => 10);
  rows.forEach((row) => {
    row.forEach((cell, i) => {
      const len = String(cell ?? "").length + 2;
      if (len > (widths[i] ?? 10)) widths[i] = Math.min(len, 60);
    });
  });
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

async function downloadXLSX(
  filename: string,
  sheetName: string,
  rows: (string | number | null | undefined)[][],
  numericCols: number[] = []
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Style numeric columns: integer thousands separator (es-AR style)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let R = 1; R <= range.e.r; R++) {
    for (const C of numericCols) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell && typeof cell.v === "number") {
        cell.t = "n";
        cell.z = "#,##0";
      }
    }
  }

  autoFitColumns(ws, rows);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

export async function exportProductCostsXLSX(rows: ProductReportRow[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  const data: (string | number)[][] = [
    ["Artículo", "Costo directo", "M.O.", "Total", "Margen %", "Precio minorista", "Descuento %", "Precio mayorista"],
    ...rows.map((r) => [
      r.name,
      r.direct_cost,
      r.labor_cost,
      r.total_cost,
      r.margin_percentage,
      r.price_minorista,
      r.discount_percentage,
      r.price_mayorista,
    ]),
  ];
  await downloadXLSX(`costos-precios-${stamp}.xlsx`, "Costos y Precios", data, [1, 2, 3, 4, 5, 6, 7]);
}

export async function exportMaterialsXLSX(rows: MaterialReportRow[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  const data: (string | number | null)[][] = [
    ["Insumo", "Unidad", "Último precio compra", "Precio manual", "Precio vigente"],
    ...rows.map((r) => [
      r.name,
      r.unit,
      r.last_purchase_cost,
      r.manual_unit_cost,
      r.effective_cost,
    ]),
  ];
  await downloadXLSX(`insumos-precios-${stamp}.xlsx`, "Precios de Insumos", data, [2, 3, 4]);
}

export async function exportHistoryXLSX(rows: HistoryReportRow[], generatedDate: string) {
  const stamp = new Date(generatedDate).toISOString().slice(0, 10);
  const data: (string | number)[][] = [
    ["Artículo", "Costo directo", "M.O.", "Total", "Margen %", "Minorista", "Descuento %", "Mayorista"],
    ...rows.map((r) => [
      r.product_name,
      r.direct_cost,
      r.labor_cost,
      r.total_cost,
      r.margin_percentage,
      r.price_minorista,
      r.discount_percentage,
      r.price_mayorista,
    ]),
  ];
  await downloadXLSX(`lista-precios-${stamp}.xlsx`, "Lista de Precios", data, [1, 2, 3, 4, 5, 6, 7]);
}
