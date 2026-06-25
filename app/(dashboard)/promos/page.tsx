"use client";

import React, { useState, useEffect, useRef } from "react";
import { pName } from "@/lib/utils/product";
import type { Json } from "@/lib/types/database";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2, Save, Settings, List, Trash2, Copy,
  FileImage, FileText, Megaphone, Phone, Link as LinkIcon,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductOption {
  id: string;
  name: string;
  basePrice: number;
}

interface SelectedItem {
  product_id: string;
  product_name: string;
  price: number;
}

type TemplateStyle = "elegante" | "fresco" | "festivo";
type Tab = "editor" | "lista" | "ajustes";

interface SavedPromo {
  id: string;
  title: string;
  subtitle: string | null;
  promo_text: string | null;
  template_style: string;
  items: SelectedItem[];
  created_at: string;
}

// ── Template definitions ─────────────────────────────────────────────────────

interface TemplateDef {
  label: string;
  description: string;
  bg: string;
  titleColor: string;
  subtitleColor: string;
  priceColor: string;
  itemBg: string;
  itemBorderLeft?: boolean;
  footerBg: string;
  footerText: string;
  dividerColor: string;
  topAccentColor?: string;
}

const TEMPLATES: Record<TemplateStyle, TemplateDef> = {
  elegante: {
    label: "Elegante",
    description: "Fondo oscuro, estilo premium",
    bg: "#1a1b1f",
    titleColor: "#f5e6c8",
    subtitleColor: "#e8a95a",
    priceColor: "#D4A853",
    itemBg: "rgba(255,255,255,0.08)",
    footerBg: "rgba(0,0,0,0.45)",
    footerText: "rgba(255,255,255,0.95)",
    dividerColor: "#e8a95a",
  },
  fresco: {
    label: "Fresco",
    description: "Fondo claro, estilo moderno",
    bg: "#faf7f2",
    titleColor: "#c93050",
    subtitleColor: "#a9760a",
    priceColor: "#c93050",
    itemBg: "#ffffff",
    itemBorderLeft: true,
    footerBg: "#a9760a",
    footerText: "#ffffff",
    dividerColor: "#c93050",
    topAccentColor: "#c93050",
  },
  festivo: {
    label: "Festivo",
    description: "Gradiente vibrante, estilo llamativo",
    bg: "linear-gradient(145deg, #c93050 0%, #1a1b1f 100%)",
    titleColor: "#ffffff",
    subtitleColor: "rgba(255,255,255,0.88)",
    priceColor: "#FFE066",
    itemBg: "rgba(255,255,255,0.15)",
    footerBg: "rgba(0,0,0,0.42)",
    footerText: "rgba(255,255,255,0.95)",
    dividerColor: "rgba(255,255,255,0.45)",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

// ── PromoPlate — defined OUTSIDE PromosPage so React never remounts it ────────
// Renders at fixed 1080×1350 px with all-inline styles (no Tailwind).
// For preview: wrap in a CSS-transform container scaled to fit.
// For export: render off-screen at full size and capture with html2canvas.

interface PromoPlateProps {
  template: TemplateStyle;
  title: string;
  subtitle: string;
  promoText: string;
  items: SelectedItem[];
  phone: string;
  portalUrl: string;
  divRef?: React.RefObject<HTMLDivElement>;
}

function PromoPlate({ template, title, subtitle, promoText, items, phone, portalUrl, divRef }: PromoPlateProps) {
  const tmpl = TEMPLATES[template];
  const count = items.length;

  // Scale font/padding by item count so all items always fit in the flex zone
  const namePx  = count <= 6 ? 26 : count <= 9 ? 22 : count <= 12 ? 20 : 18;
  const pricePx = count <= 6 ? 30 : count <= 9 ? 26 : count <= 12 ? 22 : 20;
  const rowPadV = count <= 6 ? 16 : count <= 9 ? 12 : 9;
  const rowGap  = count <= 6 ? 10 : count <= 9 ? 8  : 6;

  // Title font — smaller if long title
  const titleFsz = title.length > 30 ? 40 : title.length > 20 ? 46 : 52;

  // Solid name color — full opacity, high contrast
  const nameColor = template === "fresco" ? "#1a1a1a" : "#FFFFFF";

  return (
    <div
      ref={divRef}
      style={{
        width: "1080px",
        height: "1350px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: tmpl.bg,
        fontFamily: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* ── ZONA 1: Header — flex-shrink: 0, height: 320px ── */}
      <div style={{
        flexShrink: 0,
        height: "320px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 40px",
        ...(tmpl.topAccentColor ? { borderTop: `8px solid ${tmpl.topAccentColor}` } : {}),
        boxSizing: "border-box",
      }}>
        {/* Logo — 150×150 CSS; source is 1742×1734 so it renders sharp */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Arachis"
          crossOrigin="anonymous"
          width={150}
          height={150}
          style={{ objectFit: "contain", display: "block" }}
        />

        {/* Brand tag */}
        <p style={{
          color: tmpl.subtitleColor,
          fontSize: "14px",
          fontWeight: 600,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          margin: "10px 0 14px",
          opacity: 0.85,
        }}>
          Repostería Artesanal
        </p>

        {/* Divider */}
        <div style={{
          width: "200px",
          height: "1px",
          background: tmpl.dividerColor,
          marginBottom: "16px",
          opacity: 0.7,
        }} />

        {/* Title */}
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
          fontSize: `${titleFsz}px`,
          fontWeight: 700,
          color: tmpl.titleColor,
          margin: 0,
          lineHeight: 1.2,
          textAlign: "center",
        }}>
          {title || "Título de la promoción"}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p style={{
            color: tmpl.subtitleColor,
            fontSize: "20px",
            fontWeight: 500,
            margin: "10px 0 0",
            textAlign: "center",
            lineHeight: 1.3,
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* ── ZONA 2: Artículos — flex: 1, se expande/contrae automáticamente ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: `${rowGap}px`,
        padding: "16px 40px",
        overflow: "hidden",
        boxSizing: "border-box",
      }}>
        {count === 0 ? (
          <p style={{
            textAlign: "center",
            color: "#FFFFFF",
            opacity: 0.4,
            fontSize: "20px",
            fontStyle: "italic",
          }}>
            Seleccioná artículos en el formulario
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.product_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: tmpl.itemBg,
                borderRadius: "12px",
                padding: `${rowPadV}px 24px`,
                boxSizing: "border-box",
                ...(tmpl.itemBorderLeft ? { borderLeft: "8px solid #a9760a" } : {}),
              }}
            >
              {/* Name — never clipped, wraps if needed */}
              <span style={{
                color: nameColor,
                fontSize: `${namePx}px`,
                fontWeight: 600,
                lineHeight: 1.3,
                flex: 1,
                marginRight: "20px",
              }}>
                {item.product_name}
              </span>

              {/* Price — right-aligned, never wraps */}
              <span style={{
                color: tmpl.priceColor,
                fontSize: `${pricePx}px`,
                fontWeight: 700,
                whiteSpace: "nowrap",
                flexShrink: 0,
                fontFamily: "'Montserrat', sans-serif",
              }}>
                {fmt(item.price)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* ── ZONA 3: Texto promocional — flex-shrink: 0, solo si existe ── */}
      {promoText && (
        <div style={{
          flexShrink: 0,
          padding: "14px 60px",
          textAlign: "center",
          boxSizing: "border-box",
        }}>
          <p style={{
            color: tmpl.subtitleColor,
            fontSize: "20px",
            fontStyle: "italic",
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.4,
          }}>
            ✦ {promoText} ✦
          </p>
        </div>
      )}

      {/* ── ZONA 4: Pie de contacto — flex-shrink: 0, height: 150px ── */}
      <div style={{
        flexShrink: 0,
        height: "150px",
        background: tmpl.footerBg,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "20px 40px",
        boxSizing: "border-box",
      }}>
        <p style={{
          color: tmpl.footerText,
          fontSize: "14px",
          fontWeight: 700,
          margin: "0 0 10px",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.75,
        }}>
          Hacé tu pedido:
        </p>

        {/* WhatsApp row — inline SVG, no emoji, no external image */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="#25D366"
            style={{ flexShrink: 0, display: "block" }}
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <span style={{ color: tmpl.footerText, fontSize: "22px", fontWeight: 700 }}>
            {phone}
          </span>
        </div>

        {/* Portal URL row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#D4A853"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, display: "block" }}
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span style={{ color: tmpl.footerText, fontSize: "16px", opacity: 0.85, wordBreak: "break-all" }}>
            {portalUrl}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

export default function PromosPage() {
  const supabase = createClient();
  const exportPlateRef = useRef<HTMLDivElement>(null);

  // Tabs
  const [tab, setTab] = useState<Tab>("editor");

  // Products
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [promoText, setPromoText] = useState("");
  const [template, setTemplate] = useState<TemplateStyle>("elegante");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [itemPrices, setItemPrices] = useState<Record<string, string>>({});

  // Settings
  const [settingsPhone, setSettingsPhone] = useState("381 206 7869");
  const [settingsPortalUrl, setSettingsPortalUrl] = useState("https://app.arachis.com.ar/pedidos");
  const [savingSettings, setSavingSettings] = useState(false);

  // Saved promos list
  const [promos, setPromos] = useState<SavedPromo[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(false);

  // Action states
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<"jpg" | "pdf" | null>(null);

  // Inject Google Fonts once
  useEffect(() => {
    const id = "promo-gfonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Montserrat:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // Load products + settings
  useEffect(() => {
    async function load() {
      const [{ data: prods }, { data: costs }, { data: settings }] = await Promise.all([
        supabase.from("products").select("id, name, presentation").eq("active", true).order("name"),
        supabase.from("product_costs").select("product_id, price_minorista"),
        supabase.from("promo_settings").select("key, value"),
      ]);

      const priceMap: Record<string, number> = {};
      (costs ?? []).forEach((c: { product_id: string; price_minorista: number | null }) => {
        if (c.price_minorista != null) priceMap[c.product_id] = c.price_minorista;
      });

      setProducts(
        (prods ?? []).map((p: { id: string; name: string; presentation: number }) => ({
          id: p.id,
          name: pName(p),
          basePrice: priceMap[p.id] ?? 0,
        }))
      );
      setLoadingProducts(false);

      (settings ?? []).forEach((s: { key: string; value: string }) => {
        if (s.key === "phone") setSettingsPhone(s.value);
        if (s.key === "portal_url") setSettingsPortalUrl(s.value);
      });
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load saved promos when switching to lista tab
  useEffect(() => {
    if (tab !== "lista") return;
    setLoadingPromos(true);
    supabase
      .from("promos")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setPromos((data ?? []).map((p) => ({ ...p, items: p.items as unknown as SelectedItem[] })));
        setLoadingPromos(false);
      });
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedItems: SelectedItem[] = products
    .filter((p) => checkedIds.has(p.id))
    .map((p) => ({
      product_id: p.id,
      product_name: p.name,
      price: parseFloat(itemPrices[p.id] ?? String(p.basePrice)) || 0,
    }));

  // ── Handlers ───────────────────────────────────────────────────────────────

  function toggleProduct(id: string, basePrice: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setItemPrices((p) => ({ ...p, [id]: String(basePrice) }));
      }
      return next;
    });
  }

  async function handleSavePromo() {
    if (!title.trim()) { alert("Ingresá un título para la placa."); return; }
    setSaving(true);
    const { error } = await supabase.from("promos").insert({
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      promo_text: promoText.trim() || null,
      template_style: template,
      items: selectedItems as unknown as Json,
    });
    if (error) {
      console.error("Error guardando promo:", error);
      alert(`Error al guardar: ${error.message}`);
    } else {
      alert("Placa guardada. Podés verla en la pestaña \"Placas guardadas\".");
    }
    setSaving(false);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    for (const [key, value] of [
      ["phone", settingsPhone.trim()],
      ["portal_url", settingsPortalUrl.trim()],
    ]) {
      const { error } = await supabase
        .from("promo_settings")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) console.error("Error guardando setting:", key, error);
    }
    setSavingSettings(false);
    alert("Ajustes guardados.");
  }

  // ── Export capture ──────────────────────────────────────────────────────────
  // The off-screen export plate is already rendered at 1080×1350.
  // Steps:
  //   1. Pre-load logo via new Image() so html2canvas finds it in cache at native res.
  //   2. Wait for all fonts.
  //   3. html2canvas with scale:2 → output is 2160×2700 (crisp at all sizes).

  async function captureCanvas(): Promise<HTMLCanvasElement> {
    if (!exportPlateRef.current) throw new Error("No export plate ref");

    // 1. Pre-load the logo image so html2canvas finds it fully decoded
    await new Promise<void>((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload  = () => resolve();
      img.onerror = () => resolve(); // don't block on error — canvas may still render
      img.src = "/logo.png";
    });

    // 2. Wait for web fonts
    await document.fonts.ready;

    // 3. Capture
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(exportPlateRef.current, {
      scale: 2,             // 1080×2 = 2160px wide, 1350×2 = 2700px tall — sharp logo
      width: 1080,
      height: 1350,
      useCORS: true,
      allowTaint: true,
      imageTimeout: 15000,
      logging: false,
      backgroundColor: null,
    });
  }

  async function handleDownloadJPG() {
    setDownloading("jpg");
    try {
      const canvas = await captureCanvas(); // 2160×2700
      const url = canvas.toDataURL("image/jpeg", 0.95);
      const a = document.createElement("a");
      a.href = url;
      a.download = `promo-${(title || "placa").replace(/\s+/g, "-")}.jpg`;
      a.click();
    } catch (err) {
      console.error("Error generando JPG:", err);
      alert("Error al generar la imagen. Verificá la consola.");
    }
    setDownloading(null);
  }

  async function handleDownloadPDF() {
    setDownloading("pdf");
    try {
      const canvas = await captureCanvas(); // 2160×2700
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      const { jsPDF } = await import("jspdf");
      const pdfW = 1080;
      const pdfH = 1350;
      const pdf  = new jsPDF({ orientation: "portrait", unit: "px", format: [pdfW, pdfH] });

      // Insert the 2160×2700 image scaled to 1080×1350 — jsPDF handles the downscaling
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);

      // Clickable link annotations over the footer (bottom 150px of 1350px plate)
      // Footer: starts at y=1200. Padding: 20px. Label: ~24px+10px margin.
      // WA row: y≈1254, height≈34px.  URL row: y≈1296, height≈28px.
      const footerY = pdfH - 150; // 1200
      const waPhone = `549${settingsPhone.replace(/\D/g, "")}`;
      pdf.link(0, footerY + 54, pdfW, 40, { url: `https://wa.me/${waPhone}` });
      pdf.link(0, footerY + 100, pdfW, 38, { url: settingsPortalUrl });

      pdf.save(`promo-${(title || "placa").replace(/\s+/g, "-")}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Error al generar el PDF. Verificá la consola.");
    }
    setDownloading(null);
  }

  async function handleDeletePromo(id: string) {
    if (!confirm("¿Eliminar esta placa? Esta acción no se puede deshacer.")) return;
    await supabase.from("promos").delete().eq("id", id);
    setPromos((prev) => prev.filter((p) => p.id !== id));
  }

  function handleLoadPromo(promo: SavedPromo) {
    setTitle(promo.title);
    setSubtitle(promo.subtitle ?? "");
    setPromoText(promo.promo_text ?? "");
    setTemplate(
      (promo.template_style as TemplateStyle) in TEMPLATES
        ? (promo.template_style as TemplateStyle)
        : "elegante"
    );
    const ids = new Set<string>();
    const prices: Record<string, string> = {};
    promo.items.forEach((it) => {
      ids.add(it.product_id);
      prices[it.product_id] = String(it.price);
    });
    setCheckedIds(ids);
    setItemPrices(prices);
    setTab("editor");
  }

  // Props shared by both preview and export PromoPlate instances
  const plateProps: Omit<PromoPlateProps, "divRef"> = {
    template,
    title,
    subtitle,
    promoText,
    items: selectedItems,
    phone: settingsPhone,
    portalUrl: settingsPortalUrl,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/*
        Off-screen export plate at full 1080×1350.
        position:fixed + left:-9999px keeps it out of layout and viewport.
        Logo loads eagerly from component mount — ready before user clicks export.
      */}
      <div style={{
        position: "fixed",
        left: "-9999px",
        top: 0,
        width: "1080px",
        height: "1350px",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: -1,
      }}>
        <PromoPlate {...plateProps} divRef={exportPlateRef} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promociones</h1>
          <p className="text-gray-500 mt-0.5">Generador de placas y material de difusión</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6 w-fit">
        {([
          ["editor",  "Nueva placa",      Megaphone],
          ["lista",   "Placas guardadas", List     ],
          ["ajustes", "Ajustes",          Settings ],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── EDITOR ── */}
      {tab === "editor" && (
        <div className="flex flex-col xl:flex-row gap-6">

          {/* Left: form */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Basic info */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Información</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Título <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Pascuas 2026, Promo Día de la Madre"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Subtítulo <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ej: Hacé tu pedido hasta el 15 de abril"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Texto promocional <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={promoText}
                    onChange={(e) => setPromoText(e.target.value)}
                    placeholder="Ej: Envío gratis en compras mayores a $50.000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>

            {/* Template */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Plantilla</h3>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TEMPLATES) as [TemplateStyle, TemplateDef][]).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => setTemplate(key)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      template === key
                        ? "border-blue-400 shadow-md ring-2 ring-blue-100"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="w-full h-9 rounded-lg mb-2.5" style={{ background: t.bg }} />
                    <p className="text-xs font-semibold text-gray-900 leading-tight">{t.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Products */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Artículos</h3>
                {checkedIds.size > 0 && (
                  <span className="text-xs text-blue-600 font-medium">
                    {checkedIds.size} seleccionado{checkedIds.size !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {loadingProducts ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="animate-spin text-gray-300" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4 italic">
                  No hay artículos activos con precio configurado.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {products.map((p) => {
                    const checked = checkedIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          checked ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          id={`prod-${p.id}`}
                          checked={checked}
                          onChange={() => toggleProduct(p.id, p.basePrice)}
                          className="w-4 h-4 rounded accent-blue-500 flex-shrink-0 cursor-pointer"
                        />
                        <label
                          htmlFor={`prod-${p.id}`}
                          className="flex-1 text-sm text-gray-800 cursor-pointer font-medium select-none"
                        >
                          {p.name}
                        </label>
                        {checked && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs text-gray-400">$</span>
                            <input
                              type="number"
                              value={itemPrices[p.id] ?? String(p.basePrice)}
                              onChange={(e) =>
                                setItemPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                              min={0}
                              step={100}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSavePromo}
                disabled={saving || !title.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar placa
              </button>
              <button
                onClick={handleDownloadJPG}
                disabled={downloading !== null}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#a9760a" }}
              >
                {downloading === "jpg" ? <Loader2 size={14} className="animate-spin" /> : <FileImage size={14} />}
                Descargar JPG
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading !== null}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#c93050" }}
              >
                {downloading === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Descargar PDF
              </button>
            </div>
          </div>

          {/* Right: preview — PromoPlate scaled down to ~400×500 with CSS transform */}
          <div className="xl:sticky xl:top-6 xl:self-start flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Vista previa
              </p>
              {/*
                Container clips the scaled-down 1080×1350 plate to ~400×500.
                transform: scale() doesn't affect layout so overflow:hidden is required.
                scale = 400/1080 ≈ 0.37037
              */}
              <div style={{ width: "400px", height: "500px", overflow: "hidden", flexShrink: 0 }}>
                <div style={{ transform: "scale(0.37037)", transformOrigin: "top left" }}>
                  <PromoPlate {...plateProps} />
                </div>
              </div>
              <p className="text-center text-[10px] text-gray-400 mt-3">
                Formato Instagram · 1080 × 1350 px
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── LISTA ── */}
      {tab === "lista" && (
        <div>
          {loadingPromos ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
          ) : promos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Megaphone size={32} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No hay placas guardadas todavía</p>
              <p className="text-sm text-gray-400 mt-1">Creá tu primera placa en el editor.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {promos.map((promo) => {
                const t = TEMPLATES[(promo.template_style as TemplateStyle)] ?? TEMPLATES.elegante;
                return (
                  <div key={promo.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {/* Mini preview */}
                    <div
                      className="relative flex items-center justify-center px-4"
                      style={{ background: t.bg, height: "90px" }}
                    >
                      <p style={{
                        color: t.titleColor,
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "15px",
                        fontWeight: 700,
                        textAlign: "center",
                        lineHeight: 1.3,
                        maxWidth: "100%",
                      }}>
                        {promo.title}
                      </p>
                      <div
                        className="absolute bottom-0 left-0 right-0"
                        style={{ height: "4px", background: t.footerBg }}
                      />
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900 leading-tight">{promo.title}</p>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                          {fmtDate(promo.created_at)}
                        </span>
                      </div>
                      {promo.subtitle && (
                        <p className="text-xs text-gray-500 mb-1 truncate">{promo.subtitle}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mb-3">
                        {promo.items.length} artículo{promo.items.length !== 1 ? "s" : ""} · {t.label}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoadPromo(promo)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                          title="Cargar en el editor"
                        >
                          <Copy size={12} /> Editar
                        </button>
                        <button
                          onClick={() => handleDeletePromo(promo.id)}
                          className="p-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── AJUSTES ── */}
      {tab === "ajustes" && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-5">Datos de contacto en las placas</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Teléfono de contacto
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    placeholder="381 206 7869"
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                  El link de WhatsApp en el PDF se genera como wa.me/549 + número sin guiones.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Link al portal de pedidos
                </label>
                <div className="relative">
                  <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="url"
                    value={settingsPortalUrl}
                    onChange={(e) => setSettingsPortalUrl(e.target.value)}
                    placeholder="https://app.arachis.com.ar/pedidos"
                    className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: "#a9760a" }}
              >
                {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar ajustes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
