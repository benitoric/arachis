"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { pName } from "@/lib/utils/product";
import { createClient } from "@/lib/supabase/client";
import { Save, Loader2, Calculator, AlertCircle, AlertTriangle, History, BookOpen, ChevronDown, ChevronRight, Tag, Package, Search, X, FileDown, FileSpreadsheet, Filter, CheckSquare, Square } from "lucide-react";
import {
  generateProductCostsReport,
  generateMaterialsReport,
  generateHistoryReport,
  exportProductCostsCSV,
  exportMaterialsCSV,
  exportHistoryCSV,
  exportProductCostsXLSX,
  exportMaterialsXLSX,
  exportHistoryXLSX,
  type ProductReportRow,
  type MaterialReportRow,
  type HistoryReportRow,
} from "@/lib/utils/generateCostsReport";

interface RecipeIngredient {
  material_id: string;
  material_name: string;
  unit: string;
  quantity: number;
  unit_cost: number;
}

interface ProductInfo {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  direct_cost: number;
  has_recipe: boolean;
}

interface ProductValues {
  labor_cost: string;
  margin_percentage: string;
  price_minorista: string;
  discount_percentage: string;
  price_mayorista: string;
}

interface SavedCost {
  product_id: string;
  direct_cost: number | null;
  labor_cost: number | null;
  margin_percentage: number | null;
  price_minorista: number | null;
  discount_percentage: number | null;
  price_mayorista: number | null;
}

interface HistoryRecord {
  id: string;
  generated_date: string;
  items?: HistoryItem[];
}

interface HistoryItem {
  product_name: string;
  direct_cost: number;
  labor_cost: number;
  total_cost: number;
  margin_percentage: number;
  price_minorista: number;
  discount_percentage: number;
  price_mayorista: number;
}

type Tab = "costos" | "insumos" | "historial";

interface MaterialWithCosts {
  id: string;
  name: string;
  unit: string;
  manual_unit_cost: number | null;
  last_purchase_cost: number | null; // unit_cost from last purchase
}

// Round to nearest hundred
const roundH = (n: number) => Math.round(n / 100) * 100;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const num = (s: string) => parseFloat(s) || 0;

function computeDerived(direct_cost: number, v: ProductValues) {
  const labor = roundH(num(v.labor_cost));
  const total = roundH(direct_cost + labor);
  const margin = num(v.margin_percentage);
  const minSuggested = roundH(total * (1 + margin / 100));
  const minFinal = roundH(num(v.price_minorista));
  const discount = num(v.discount_percentage);
  const maySuggested = roundH(minFinal * (1 - discount / 100));
  return { labor, total, margin, minSuggested, minFinal, discount, maySuggested };
}

const EMPTY_VALUES: ProductValues = {
  labor_cost: "0",
  margin_percentage: "0",
  price_minorista: "0",
  discount_percentage: "0",
  price_mayorista: "0",
};

export default function CostsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("costos");

  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [values, setValues] = useState<Record<string, ProductValues>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Track products whose margin/discount were manually edited (not propagated from first)
  const [manualMargin, setManualMargin] = useState<Set<string>>(new Set());
  const [manualDiscount, setManualDiscount] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [loadingHistoryItems, setLoadingHistoryItems] = useState<string | null>(null);

  // Materials tab state
  const [materialsWithCosts, setMaterialsWithCosts] = useState<MaterialWithCosts[]>([]);
  const [manualCostEdits, setManualCostEdits] = useState<Record<string, string>>({});
  const [savingMaterials, setSavingMaterials] = useState(false);
  const [savedMaterialsAt, setSavedMaterialsAt] = useState<string | null>(null);

  // Filters: Costos tab
  const [costSearch, setCostSearch] = useState("");
  const [costStatus, setCostStatus] = useState<"all" | "complete" | "incomplete" | "no_recipe">("all");
  const [costMinMargin, setCostMinMargin] = useState("");
  const [costMaxMargin, setCostMaxMargin] = useState("");
  const [costMinPrice, setCostMinPrice] = useState("");
  const [costMaxPrice, setCostMaxPrice] = useState("");
  const [showCostFilters, setShowCostFilters] = useState(false);

  // Filters: Insumos tab
  const [matSearch, setMatSearch] = useState("");
  const [matStatus, setMatStatus] = useState<"all" | "manual" | "no_price">("all");

  // Filters: Historial tab
  const [histDateFrom, setHistDateFrom] = useState("");
  const [histDateTo, setHistDateTo] = useState("");
  const [histItemSearch, setHistItemSearch] = useState("");

  // Selection state (per tab)
  const [selectedCostIds, setSelectedCostIds] = useState<Set<string>>(new Set());
  const [selectedMatIds, setSelectedMatIds] = useState<Set<string>>(new Set());
  // For history items: keyed by `${historyId}::${index}`
  const [selectedHistKeys, setSelectedHistKeys] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);

    const [
      { data: prods },
      { data: recipes },
      { data: materials },
      { data: purchases },
      { data: savedCosts },
    ] = await Promise.all([
      supabase.from("products").select("id, name, presentation").eq("active", true).order("name"),
      supabase.from("recipes").select("product_id, material_id, quantity"),
      supabase.from("materials").select("id, name, unit, manual_unit_cost"),
      supabase.from("purchases").select("material_id, unit_cost, date").order("date", { ascending: false }),
      supabase.from("product_costs").select("product_id, direct_cost, labor_cost, margin_percentage, price_minorista, discount_percentage, price_mayorista"),
    ]);

    const lastCostMap: Record<string, number> = {};
    (purchases ?? []).forEach((p) => {
      if (!(p.material_id in lastCostMap) && p.unit_cost != null) {
        lastCostMap[p.material_id] = p.unit_cost;
      }
    });

    const materialMap: Record<string, { name: string; unit: string; manual_unit_cost: number | null }> = {};
    (materials ?? []).forEach((m) => {
      materialMap[m.id] = { name: m.name, unit: m.unit, manual_unit_cost: m.manual_unit_cost ?? null };
    });

    const savedMap: Record<string, SavedCost> = {};
    (savedCosts ?? []).forEach((c) => { savedMap[c.product_id] = c as SavedCost; });

    const productList: ProductInfo[] = [];
    const newValues: Record<string, ProductValues> = {};

    (prods ?? []).forEach((prod) => {
      const recipeItems = (recipes ?? []).filter((r) => r.product_id === prod.id);
      const ingredients: RecipeIngredient[] = recipeItems.map((r) => {
        const mat = materialMap[r.material_id];
        // Priority: manual_unit_cost → last purchase cost → 0
        const unit_cost = mat?.manual_unit_cost != null
          ? mat.manual_unit_cost
          : (lastCostMap[r.material_id] ?? 0);
        return {
          material_id: r.material_id,
          material_name: mat?.name ?? "—",
          unit: mat?.unit ?? "",
          quantity: r.quantity,
          unit_cost,
        };
      });

      const directCost = ingredients.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);
      const saved = savedMap[prod.id];
      const labor = roundH(saved?.labor_cost ?? 0);
      const margin = saved?.margin_percentage ?? 0;
      const total = roundH(directCost + labor);
      const minSuggested = roundH(total * (1 + margin / 100));
      const discount = saved?.discount_percentage ?? 0;
      const maySuggested = roundH(minSuggested * (1 - discount / 100));

      productList.push({
        id: prod.id,
        name: pName(prod),
        ingredients,
        direct_cost: directCost,
        has_recipe: recipeItems.length > 0,
      });

      newValues[prod.id] = {
        labor_cost: String(labor),
        margin_percentage: String(margin),
        price_minorista: String(roundH(saved?.price_minorista ?? minSuggested)),
        discount_percentage: String(discount),
        price_mayorista: String(roundH(saved?.price_mayorista ?? maySuggested)),
      };
    });

    // Build materials list for insumos tab
    const matsWithCosts: MaterialWithCosts[] = (materials ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({
        id: m.id,
        name: m.name,
        unit: m.unit,
        manual_unit_cost: m.manual_unit_cost ?? null,
        last_purchase_cost: lastCostMap[m.id] ?? null,
      }));
    setMaterialsWithCosts(matsWithCosts);
    setManualCostEdits(
      matsWithCosts.reduce<Record<string, string>>((acc, m) => {
        acc[m.id] = m.manual_unit_cost != null ? String(m.manual_unit_cost) : "";
        return acc;
      }, {})
    );

    setProducts(productList);
    setValues(newValues);
    setManualMargin(new Set());
    setManualDiscount(new Set());
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("price_list_history")
      .select("id, generated_date")
      .order("generated_date", { ascending: false });
    setHistory((data ?? []).map((h) => ({ id: h.id, generated_date: h.generated_date })));
    setHistoryLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (tab === "historial" && history.length === 0) loadHistory();
  }, [tab, history.length, loadHistory]);

  async function toggleHistoryExpand(id: string) {
    if (expandedHistoryId === id) { setExpandedHistoryId(null); return; }
    const existing = history.find((h) => h.id === id);
    if (existing?.items) { setExpandedHistoryId(id); return; }

    setLoadingHistoryItems(id);
    const { data } = await supabase
      .from("price_list_history_items")
      .select("product_name, direct_cost, labor_cost, total_cost, margin_percentage, price_minorista, discount_percentage, price_mayorista")
      .eq("history_id", id)
      .order("product_name");

    setHistory((prev) =>
      prev.map((h) => h.id === id ? { ...h, items: (data ?? []) as HistoryItem[] } : h)
    );
    setLoadingHistoryItems(null);
    setExpandedHistoryId(id);
  }

  function updateValue(productId: string, field: keyof ProductValues, val: string) {
    setValues((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? EMPTY_VALUES), [field]: val },
    }));
  }

  // Margin: if first product, propagate to all non-manually-edited
  function updateMargin(productId: string, val: string, isFirst: boolean) {
    if (isFirst) {
      setValues((prev) => {
        const next = { ...prev };
        products.forEach((p, i) => {
          if (i === 0 || !manualMargin.has(p.id)) {
            next[p.id] = { ...(prev[p.id] ?? EMPTY_VALUES), margin_percentage: val };
          }
        });
        return next;
      });
    } else {
      setManualMargin((prev) => new Set([...prev, productId]));
      setValues((prev) => ({
        ...prev,
        [productId]: { ...(prev[productId] ?? EMPTY_VALUES), margin_percentage: val },
      }));
    }
  }

  function applyMarginToAll() {
    const firstId = products[0]?.id;
    if (!firstId) return;
    setValues((prev) => {
      const margin = prev[firstId]?.margin_percentage ?? "0";
      const next = { ...prev };
      products.forEach((p) => {
        next[p.id] = { ...(prev[p.id] ?? EMPTY_VALUES), margin_percentage: margin };
      });
      return next;
    });
    setManualMargin(new Set());
  }

  // Discount: same logic
  function updateDiscount(productId: string, val: string, isFirst: boolean) {
    if (isFirst) {
      setValues((prev) => {
        const next = { ...prev };
        products.forEach((p, i) => {
          if (i === 0 || !manualDiscount.has(p.id)) {
            next[p.id] = { ...(prev[p.id] ?? EMPTY_VALUES), discount_percentage: val };
          }
        });
        return next;
      });
    } else {
      setManualDiscount((prev) => new Set([...prev, productId]));
      setValues((prev) => ({
        ...prev,
        [productId]: { ...(prev[productId] ?? EMPTY_VALUES), discount_percentage: val },
      }));
    }
  }

  function applyDiscountToAll() {
    const firstId = products[0]?.id;
    if (!firstId) return;
    setValues((prev) => {
      const discount = prev[firstId]?.discount_percentage ?? "0";
      const next = { ...prev };
      products.forEach((p) => {
        next[p.id] = { ...(prev[p.id] ?? EMPTY_VALUES), discount_percentage: discount };
      });
      return next;
    });
    setManualDiscount(new Set());
  }

  // Core save: writes product_costs, throws on error
  // Formats a Supabase/Postgrest error into a readable string and logs it to console
  function fmtError(label: string, err: unknown): string {
    console.error(`[${label}]`, err);
    if (err && typeof err === "object") {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      const parts = [e.message, e.details && `details: ${e.details}`, e.hint && `hint: ${e.hint}`, e.code && `code: ${e.code}`].filter(Boolean);
      return parts.join("\n") || JSON.stringify(err);
    }
    return String(err);
  }

  async function doSaveProducts() {
    for (const prod of products) {
      const v = values[prod.id] ?? EMPTY_VALUES;
      const payload = {
        product_id: prod.id,
        direct_cost: roundH(prod.direct_cost),
        labor_cost: roundH(num(v.labor_cost)),
        margin_percentage: num(v.margin_percentage),
        price_minorista: roundH(num(v.price_minorista)),
        discount_percentage: num(v.discount_percentage),
        price_mayorista: roundH(num(v.price_mayorista)),
        updated_at: new Date().toISOString(),
      };
      const { data: ex } = await supabase.from("product_costs").select("id").eq("product_id", prod.id).maybeSingle();
      if (ex) {
        const { error } = await supabase.from("product_costs").update(payload).eq("id", ex.id);
        if (error) { console.error("[doSaveProducts] update", prod.name, error); throw error; }
      } else {
        const { error } = await supabase.from("product_costs").insert(payload);
        if (error) { console.error("[doSaveProducts] insert", prod.name, error); throw error; }
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await doSaveProducts();
      setSavedAt(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
    } catch (err: unknown) {
      alert(`Error al guardar:\n${fmtError("handleSave", err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSavePriceList() {
    setSavingHistory(true);
    try {
      await doSaveProducts();
      setSavedAt(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));

      console.log("[handleSavePriceList] inserting price_list_history header…");
      const { data: header, error: headerErr } = await supabase
        .from("price_list_history")
        .insert({ generated_date: new Date().toISOString() })
        .select("id")
        .single();
      if (headerErr) throw headerErr;
      console.log("[handleSavePriceList] header ok, id =", header!.id);

      const items = products.map((prod) => {
        const v = values[prod.id] ?? EMPTY_VALUES;
        const { total } = computeDerived(prod.direct_cost, v);
        return {
          history_id: header!.id,
          product_id: prod.id,
          product_name: prod.name,
          direct_cost: roundH(prod.direct_cost),
          labor_cost: roundH(num(v.labor_cost)),
          total_cost: total,
          margin_percentage: num(v.margin_percentage),
          price_minorista: roundH(num(v.price_minorista)),
          discount_percentage: num(v.discount_percentage),
          price_mayorista: roundH(num(v.price_mayorista)),
        };
      });

      if (items.length > 0) {
        console.log("[handleSavePriceList] inserting", items.length, "items…");
        const { error: itemsErr } = await supabase.from("price_list_history_items").insert(items);
        if (itemsErr) throw itemsErr;
      }

      if (tab === "historial") await loadHistory();
      alert(`Lista de precios guardada con ${items.length} artículo(s).`);
    } catch (err: unknown) {
      alert(`Error al guardar la lista:\n${fmtError("handleSavePriceList", err)}`);
    } finally {
      setSavingHistory(false);
    }
  }

  async function handleSaveManualCosts() {
    setSavingMaterials(true);
    try {
      for (const mat of materialsWithCosts) {
        const raw = manualCostEdits[mat.id] ?? "";
        const val = raw.trim() === "" ? null : parseFloat(raw);
        await supabase.from("materials").update({ manual_unit_cost: val }).eq("id", mat.id);
      }
      setSavedMaterialsAt(new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }));
      // Reload costs with updated manual prices
      await loadData();
    } catch (err) {
      alert(`Error al guardar precios: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingMaterials(false);
    }
  }

  const inputCls = "w-20 border border-gray-200 rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-200";
  const busy = saving || savingHistory || loading;
  const incompleteProducts = products.filter(
    (p) => p.has_recipe && p.ingredients.some((i) => i.unit_cost === 0)
  );

  // ── Derived: filtered products for Costos tab ──
  const filteredProducts = useMemo(() => {
    const q = costSearch.trim().toLowerCase();
    const minMg = costMinMargin.trim() === "" ? null : parseFloat(costMinMargin);
    const maxMg = costMaxMargin.trim() === "" ? null : parseFloat(costMaxMargin);
    const minPr = costMinPrice.trim() === "" ? null : parseFloat(costMinPrice);
    const maxPr = costMaxPrice.trim() === "" ? null : parseFloat(costMaxPrice);

    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;

      if (costStatus !== "all") {
        const incomplete = p.has_recipe && p.ingredients.some((i) => i.unit_cost === 0);
        if (costStatus === "no_recipe" && p.has_recipe) return false;
        if (costStatus === "incomplete" && !incomplete) return false;
        if (costStatus === "complete" && (!p.has_recipe || incomplete)) return false;
      }

      const v = values[p.id] ?? EMPTY_VALUES;
      const margin = num(v.margin_percentage);
      if (minMg != null && !isNaN(minMg) && margin < minMg) return false;
      if (maxMg != null && !isNaN(maxMg) && margin > maxMg) return false;

      const price = num(v.price_minorista);
      if (minPr != null && !isNaN(minPr) && price < minPr) return false;
      if (maxPr != null && !isNaN(maxPr) && price > maxPr) return false;

      return true;
    });
  }, [products, values, costSearch, costStatus, costMinMargin, costMaxMargin, costMinPrice, costMaxPrice]);

  const costFiltersActive =
    costSearch.trim() !== "" ||
    costStatus !== "all" ||
    costMinMargin.trim() !== "" ||
    costMaxMargin.trim() !== "" ||
    costMinPrice.trim() !== "" ||
    costMaxPrice.trim() !== "";

  function clearCostFilters() {
    setCostSearch("");
    setCostStatus("all");
    setCostMinMargin("");
    setCostMaxMargin("");
    setCostMinPrice("");
    setCostMaxPrice("");
  }

  function buildCostFiltersSummary(): string[] {
    const summary: string[] = [];
    if (costSearch.trim()) summary.push(`Búsqueda: "${costSearch.trim()}"`);
    if (costStatus !== "all") {
      const labels = {
        complete: "Solo con costos completos",
        incomplete: "Solo con costos incompletos",
        no_recipe: "Solo sin receta",
      } as const;
      summary.push(labels[costStatus]);
    }
    if (costMinMargin.trim() || costMaxMargin.trim()) {
      summary.push(`Margen: ${costMinMargin || "0"}% – ${costMaxMargin || "∞"}%`);
    }
    if (costMinPrice.trim() || costMaxPrice.trim()) {
      summary.push(`Precio min.: ${costMinPrice || "0"} – ${costMaxPrice || "∞"}`);
    }
    return summary;
  }

  function productsToReportRows(list: ProductInfo[]): ProductReportRow[] {
    return list.map((p) => {
      const v = values[p.id] ?? EMPTY_VALUES;
      const { total } = computeDerived(p.direct_cost, v);
      return {
        name: p.name,
        direct_cost: roundH(p.direct_cost),
        labor_cost: roundH(num(v.labor_cost)),
        total_cost: total,
        margin_percentage: num(v.margin_percentage),
        price_minorista: roundH(num(v.price_minorista)),
        discount_percentage: num(v.discount_percentage),
        price_mayorista: roundH(num(v.price_mayorista)),
      };
    });
  }

  // Effective list to export: selected rows if any, else filtered list
  function effectiveCostList(): ProductInfo[] {
    if (selectedCostIds.size > 0) {
      return filteredProducts.filter((p) => selectedCostIds.has(p.id));
    }
    return filteredProducts;
  }

  function exportCostFiltersSummary(): string[] {
    const summary = buildCostFiltersSummary();
    if (selectedCostIds.size > 0) {
      summary.unshift(`Selección manual: ${selectedCostIds.size} artículo${selectedCostIds.size !== 1 ? "s" : ""}`);
    }
    return summary;
  }

  async function handleExportCostsPDF() {
    const rows = productsToReportRows(effectiveCostList());
    await generateProductCostsReport(rows, { filtersSummary: exportCostFiltersSummary() });
  }

  function handleExportCostsCSV() {
    exportProductCostsCSV(productsToReportRows(effectiveCostList()));
  }

  async function handleExportCostsXLSX() {
    await exportProductCostsXLSX(productsToReportRows(effectiveCostList()));
  }

  function toggleCostSelection(id: string) {
    setSelectedCostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allFilteredCostsSelected =
    filteredProducts.length > 0 && filteredProducts.every((p) => selectedCostIds.has(p.id));

  function toggleSelectAllCosts() {
    if (allFilteredCostsSelected) {
      setSelectedCostIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedCostIds((prev) => {
        const next = new Set(prev);
        filteredProducts.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }

  function clearCostSelection() {
    setSelectedCostIds(new Set());
  }

  // ── Derived: filtered materials for Insumos tab ──
  const filteredMaterials = useMemo(() => {
    const q = matSearch.trim().toLowerCase();
    return materialsWithCosts.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;

      const editVal = manualCostEdits[m.id] ?? "";
      const parsedManual = editVal.trim() !== "" ? parseFloat(editVal) : null;
      const isManualActive = parsedManual != null && !isNaN(parsedManual) && parsedManual > 0;
      const effective = isManualActive ? parsedManual : m.last_purchase_cost;

      if (matStatus === "manual" && !isManualActive) return false;
      if (matStatus === "no_price" && !(effective == null || effective <= 0)) return false;

      return true;
    });
  }, [materialsWithCosts, manualCostEdits, matSearch, matStatus]);

  const matFiltersActive = matSearch.trim() !== "" || matStatus !== "all";

  function clearMatFilters() {
    setMatSearch("");
    setMatStatus("all");
  }

  function buildMatFiltersSummary(): string[] {
    const summary: string[] = [];
    if (matSearch.trim()) summary.push(`Búsqueda: "${matSearch.trim()}"`);
    if (matStatus === "manual") summary.push("Solo con precio manual");
    if (matStatus === "no_price") summary.push("Solo sin precio");
    return summary;
  }

  function materialsToReportRows(list: MaterialWithCosts[]): MaterialReportRow[] {
    return list.map((m) => {
      const editVal = manualCostEdits[m.id] ?? "";
      const parsedManual = editVal.trim() !== "" ? parseFloat(editVal) : null;
      const manual = parsedManual != null && !isNaN(parsedManual) && parsedManual > 0 ? parsedManual : null;
      const effective = manual != null ? manual : m.last_purchase_cost;
      return {
        name: m.name,
        unit: m.unit,
        last_purchase_cost: m.last_purchase_cost,
        manual_unit_cost: manual,
        effective_cost: effective,
      };
    });
  }

  function effectiveMatList(): MaterialWithCosts[] {
    if (selectedMatIds.size > 0) {
      return filteredMaterials.filter((m) => selectedMatIds.has(m.id));
    }
    return filteredMaterials;
  }

  function exportMatFiltersSummary(): string[] {
    const summary = buildMatFiltersSummary();
    if (selectedMatIds.size > 0) {
      summary.unshift(`Selección manual: ${selectedMatIds.size} insumo${selectedMatIds.size !== 1 ? "s" : ""}`);
    }
    return summary;
  }

  async function handleExportMaterialsPDF() {
    await generateMaterialsReport(materialsToReportRows(effectiveMatList()), {
      filtersSummary: exportMatFiltersSummary(),
    });
  }

  function handleExportMaterialsCSV() {
    exportMaterialsCSV(materialsToReportRows(effectiveMatList()));
  }

  async function handleExportMaterialsXLSX() {
    await exportMaterialsXLSX(materialsToReportRows(effectiveMatList()));
  }

  function toggleMatSelection(id: string) {
    setSelectedMatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allFilteredMatsSelected =
    filteredMaterials.length > 0 && filteredMaterials.every((m) => selectedMatIds.has(m.id));

  function toggleSelectAllMats() {
    if (allFilteredMatsSelected) {
      setSelectedMatIds((prev) => {
        const next = new Set(prev);
        filteredMaterials.forEach((m) => next.delete(m.id));
        return next;
      });
    } else {
      setSelectedMatIds((prev) => {
        const next = new Set(prev);
        filteredMaterials.forEach((m) => next.add(m.id));
        return next;
      });
    }
  }

  function clearMatSelection() {
    setSelectedMatIds(new Set());
  }

  // ── Derived: filtered history for Historial tab ──
  const filteredHistory = useMemo(() => {
    const from = histDateFrom ? new Date(histDateFrom + "T00:00:00").getTime() : null;
    const to = histDateTo ? new Date(histDateTo + "T23:59:59").getTime() : null;
    return history.filter((h) => {
      const t = new Date(h.generated_date).getTime();
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;
      return true;
    });
  }, [history, histDateFrom, histDateTo]);

  const histFiltersActive = histDateFrom !== "" || histDateTo !== "";

  function clearHistFilters() {
    setHistDateFrom("");
    setHistDateTo("");
    setHistItemSearch("");
  }

  function filterHistoryItems(items: HistoryItem[]): HistoryItem[] {
    const q = histItemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.product_name.toLowerCase().includes(q));
  }

  function histItemKey(historyId: string, idx: number) {
    return `${historyId}::${idx}`;
  }

  function toggleHistItemSelection(historyId: string, idx: number) {
    const key = histItemKey(historyId, idx);
    setSelectedHistKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectedKeysForHistory(h: HistoryRecord): Set<string> {
    const ks = new Set<string>();
    selectedHistKeys.forEach((k) => {
      if (k.startsWith(h.id + "::")) ks.add(k);
    });
    return ks;
  }

  function effectiveHistoryItems(h: HistoryRecord): HistoryItem[] {
    const items = h.items ?? [];
    const visible = filterHistoryItems(items);
    const sel = selectedKeysForHistory(h);
    if (sel.size === 0) return visible;
    return items
      .map((it, idx) => ({ it, idx }))
      .filter(({ idx }) => sel.has(histItemKey(h.id, idx)))
      .map(({ it }) => it);
  }

  function toggleSelectAllHistItems(h: HistoryRecord) {
    const items = h.items ?? [];
    const visible = filterHistoryItems(items);
    const visibleIdx = items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => visible.includes(it))
      .map(({ idx }) => idx);
    const allSelected = visibleIdx.every((idx) => selectedHistKeys.has(histItemKey(h.id, idx)));

    setSelectedHistKeys((prev) => {
      const next = new Set(prev);
      visibleIdx.forEach((idx) => {
        const k = histItemKey(h.id, idx);
        if (allSelected) next.delete(k);
        else next.add(k);
      });
      return next;
    });
  }

  function clearHistSelection(historyId: string) {
    setSelectedHistKeys((prev) => {
      const next = new Set(prev);
      Array.from(next).forEach((k) => {
        if (k.startsWith(historyId + "::")) next.delete(k);
      });
      return next;
    });
  }

  function historyExportRows(h: HistoryRecord): { rows: HistoryReportRow[]; summary: string[] } {
    const items = effectiveHistoryItems(h);
    const rows: HistoryReportRow[] = items.map((it) => ({
      product_name: it.product_name,
      direct_cost: it.direct_cost,
      labor_cost: it.labor_cost,
      total_cost: it.total_cost,
      margin_percentage: it.margin_percentage,
      price_minorista: it.price_minorista,
      discount_percentage: it.discount_percentage,
      price_mayorista: it.price_mayorista,
    }));
    const summary: string[] = [];
    const selCount = selectedKeysForHistory(h).size;
    if (selCount > 0) summary.push(`Selección manual: ${selCount} artículo${selCount !== 1 ? "s" : ""}`);
    if (histItemSearch.trim() && selCount === 0) summary.push(`Búsqueda: "${histItemSearch.trim()}"`);
    return { rows, summary };
  }

  async function handleExportHistoryPDF(h: HistoryRecord) {
    const { rows, summary } = historyExportRows(h);
    await generateHistoryReport(rows, h.generated_date, { filtersSummary: summary });
  }

  function handleExportHistoryCSV(h: HistoryRecord) {
    const { rows } = historyExportRows(h);
    exportHistoryCSV(rows, h.generated_date);
  }

  async function handleExportHistoryXLSX(h: HistoryRecord) {
    const { rows } = historyExportRows(h);
    await exportHistoryXLSX(rows, h.generated_date);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Costos y Precios</h1>
          <p className="text-gray-500 mt-0.5">Cálculo de costos y listas de precios por artículo</p>
        </div>
        {tab === "costos" && (
          <div className="flex items-center gap-2 flex-wrap">
            {savedAt && <span className="text-xs text-gray-400">Guardado {savedAt}</span>}
            <button
              onClick={handleExportCostsPDF}
              disabled={loading || filteredProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Exportar listado a PDF"
            >
              <FileDown size={14} />
              PDF
            </button>
            <button
              onClick={handleExportCostsXLSX}
              disabled={loading || filteredProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              title="Exportar listado a Excel"
            >
              <FileSpreadsheet size={14} />
              Excel
            </button>
            <button
              onClick={handleExportCostsCSV}
              disabled={loading || filteredProducts.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Exportar listado a CSV"
            >
              <FileSpreadsheet size={14} />
              CSV
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar cambios
            </button>
            <button
              onClick={handleSavePriceList}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: "#49789d" }}
            >
              {savingHistory ? <Loader2 size={14} className="animate-spin" /> : <History size={14} />}
              Guardar lista de precios
            </button>
          </div>
        )}
        {tab === "insumos" && (
          <div className="flex items-center gap-2 flex-wrap">
            {savedMaterialsAt && <span className="text-xs text-gray-400">Guardado {savedMaterialsAt}</span>}
            <button
              onClick={handleExportMaterialsPDF}
              disabled={loading || filteredMaterials.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Exportar listado a PDF"
            >
              <FileDown size={14} />
              PDF
            </button>
            <button
              onClick={handleExportMaterialsXLSX}
              disabled={loading || filteredMaterials.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              title="Exportar listado a Excel"
            >
              <FileSpreadsheet size={14} />
              Excel
            </button>
            <button
              onClick={handleExportMaterialsCSV}
              disabled={loading || filteredMaterials.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              title="Exportar listado a CSV"
            >
              <FileSpreadsheet size={14} />
              CSV
            </button>
            <button
              onClick={handleSaveManualCosts}
              disabled={savingMaterials || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: "#49789d" }}
            >
              {savingMaterials ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar precios manuales
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        {([
          ["costos",    "Costos y Precios",  BookOpen],
          ["insumos",   "Precios de insumos", Package ],
          ["historial", "Historial",          History ],
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

      {/* ── COSTOS TAB ── */}
      {tab === "costos" && (
        <>
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar artículo…"
                value={costSearch}
                onChange={(e) => setCostSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {costSearch && (
                <button
                  onClick={() => setCostSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Limpiar"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowCostFilters((s) => !s)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                showCostFilters || costFiltersActive
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Filter size={14} />
              Filtros{costFiltersActive ? " activos" : ""}
            </button>
            {costFiltersActive && (
              <button
                onClick={clearCostFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <X size={14} /> Limpiar
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {filteredProducts.length} de {products.length}
            </span>
          </div>
          {showCostFilters && (
            <div className="px-4 pb-4 border-t border-gray-100 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
                <select
                  value={costStatus}
                  onChange={(e) => setCostStatus(e.target.value as typeof costStatus)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="all">Todos</option>
                  <option value="complete">Costos completos</option>
                  <option value="incomplete">Costos incompletos</option>
                  <option value="no_recipe">Sin receta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Margen %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Mín."
                    value={costMinMargin}
                    onChange={(e) => setCostMinMargin(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <input
                    type="number"
                    placeholder="Máx."
                    value={costMaxMargin}
                    onChange={(e) => setCostMaxMargin(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Precio minorista</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Mín."
                    value={costMinPrice}
                    onChange={(e) => setCostMinPrice(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <input
                    type="number"
                    placeholder="Máx."
                    value={costMaxPrice}
                    onChange={(e) => setCostMaxPrice(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calculator size={28} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No hay artículos activos</p>
              <p className="text-sm text-gray-400 mt-1">Activá artículos en el módulo de Artículos</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search size={28} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Sin resultados</p>
              <p className="text-sm text-gray-400 mt-1">Ningún artículo coincide con los filtros aplicados</p>
              <button
                onClick={clearCostFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                <X size={14} /> Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              {selectedCostIds.size > 0 && (
                <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">{selectedCostIds.size}</span> artículo{selectedCostIds.size !== 1 ? "s" : ""} seleccionado{selectedCostIds.size !== 1 ? "s" : ""}
                    <span className="text-blue-600 ml-2 text-xs">los exportes incluirán solo la selección</span>
                  </p>
                  <button
                    onClick={clearCostSelection}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                  >
                    <X size={12} /> Limpiar selección
                  </button>
                </div>
              )}
              {incompleteProducts.length > 0 && !costFiltersActive && (
                <div className="mx-4 mt-4 mb-1 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                    <p className="text-sm font-semibold text-amber-800">
                      {incompleteProducts.length} artículo{incompleteProducts.length !== 1 ? "s" : ""} con costos incompletos
                    </p>
                  </div>
                  <ul className="space-y-1">
                    {incompleteProducts.map((p) => (
                      <li key={p.id} className="text-xs text-amber-700">
                        <span className="font-medium">{p.name}:</span>{" "}
                        sin precio para{" "}
                        {p.ingredients.filter((i) => i.unit_cost === 0).map((i) => i.material_name).join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 uppercase tracking-wider">
                    <th className="px-3 py-3 w-8">
                      <button
                        type="button"
                        onClick={toggleSelectAllCosts}
                        className="text-gray-400 hover:text-blue-600 inline-flex items-center"
                        title={allFilteredCostsSelected ? "Deseleccionar todos los visibles" : "Seleccionar todos los visibles"}
                      >
                        {allFilteredCostsSelected
                          ? <CheckSquare size={14} className="text-blue-500" />
                          : <Square size={14} />}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 font-semibold min-w-[140px]">Artículo</th>
                    <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Costo dir.</th>
                    <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">M.O.</th>
                    <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Total</th>
                    <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Mg%</th>
                    <th className="text-right px-3 py-3 font-semibold min-w-[140px]">
                      <div>Precio min.</div>
                      <div className="text-gray-400 font-normal normal-case tracking-normal">sugerido / final</div>
                    </th>
                    <th className="text-right px-3 py-3 font-semibold whitespace-nowrap">Dto.%</th>
                    <th className="text-right px-3 py-3 font-semibold min-w-[140px]">
                      <div>Precio may.</div>
                      <div className="text-gray-400 font-normal normal-case tracking-normal">sugerido / final</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => {
                    const v = values[prod.id] ?? EMPTY_VALUES;
                    const { total, minSuggested, maySuggested } = computeDerived(prod.direct_cost, v);
                    const isExpanded = expandedId === prod.id;
                    const isFirst = prod.id === products[0]?.id;
                    const isSelected = selectedCostIds.has(prod.id);

                    return (
                      <React.Fragment key={prod.id}>
                        <tr className={`border-b border-gray-50 transition-colors ${isSelected ? "bg-blue-50/40" : "hover:bg-gray-50/50"}`}>
                          {/* Checkbox */}
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCostSelection(prod.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-200 cursor-pointer"
                            />
                          </td>
                          {/* Artículo */}
                          <td className="px-4 py-2.5">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : prod.id)}
                              className="flex items-center gap-1.5 text-left w-full"
                            >
                              {isExpanded
                                ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
                                : <ChevronRight size={13} className="text-gray-300 flex-shrink-0" />}
                              <span className="font-medium text-gray-900 text-sm">{prod.name}</span>
                              {!prod.has_recipe && (
                                <span title="Sin receta">
                                  <AlertCircle size={12} className="text-amber-400 flex-shrink-0" />
                                </span>
                              )}
                              {prod.has_recipe && prod.ingredients.some((i) => i.unit_cost === 0) && (
                                <span title={`Sin precio: ${prod.ingredients.filter((i) => i.unit_cost === 0).map((i) => i.material_name).join(", ")}`}>
                                  <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Costo directo */}
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700 whitespace-nowrap">
                            {fmt(prod.direct_cost)}
                          </td>

                          {/* Mano de obra */}
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              value={v.labor_cost}
                              onChange={(e) => updateValue(prod.id, "labor_cost", e.target.value)}
                              onBlur={(e) => updateValue(prod.id, "labor_cost", String(roundH(num(e.target.value))))}
                              min={0} step={100}
                              className={inputCls}
                            />
                          </td>

                          {/* Costo total */}
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                            {fmt(total)}
                          </td>

                          {/* Margen % */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <input
                                type="number"
                                value={v.margin_percentage}
                                onChange={(e) => updateMargin(prod.id, e.target.value, isFirst)}
                                min={0} step={0.5}
                                className={`${inputCls} ${!isFirst && manualMargin.has(prod.id) ? "border-amber-300" : ""}`}
                              />
                              {isFirst && (
                                <button
                                  type="button"
                                  onClick={applyMarginToAll}
                                  className="text-[10px] text-blue-400 hover:text-blue-600 whitespace-nowrap leading-none"
                                  title="Sobreescribe todos los márgenes"
                                >
                                  Aplicar a todos
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Precio minorista */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-gray-400 whitespace-nowrap">{fmt(minSuggested)}</span>
                              <input
                                type="number"
                                value={v.price_minorista}
                                onChange={(e) => updateValue(prod.id, "price_minorista", e.target.value)}
                                onBlur={(e) => updateValue(prod.id, "price_minorista", String(roundH(num(e.target.value))))}
                                min={0} step={100}
                                className={`${inputCls} border-blue-200 text-blue-700 font-semibold`}
                              />
                            </div>
                          </td>

                          {/* Descuento % */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <input
                                type="number"
                                value={v.discount_percentage}
                                onChange={(e) => updateDiscount(prod.id, e.target.value, isFirst)}
                                min={0} max={100} step={0.5}
                                className={`${inputCls} ${!isFirst && manualDiscount.has(prod.id) ? "border-amber-300" : ""}`}
                              />
                              {isFirst && (
                                <button
                                  type="button"
                                  onClick={applyDiscountToAll}
                                  className="text-[10px] text-blue-400 hover:text-blue-600 whitespace-nowrap leading-none"
                                  title="Sobreescribe todos los descuentos"
                                >
                                  Aplicar a todos
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Precio mayorista */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-gray-400 whitespace-nowrap">{fmt(maySuggested)}</span>
                              <input
                                type="number"
                                value={v.price_mayorista}
                                onChange={(e) => updateValue(prod.id, "price_mayorista", e.target.value)}
                                onBlur={(e) => updateValue(prod.id, "price_mayorista", String(roundH(num(e.target.value))))}
                                min={0} step={100}
                                className={`${inputCls} border-purple-200 text-purple-700 font-semibold`}
                              />
                            </div>
                          </td>
                        </tr>

                        {/* Expanded: ingredient breakdown */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-8 pb-4 pt-1 bg-blue-50/20">
                              {prod.ingredients.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">
                                  Sin receta. Definila en{" "}
                                  <a href="/recipes" className="text-blue-500 hover:underline">Recetas</a>.
                                </p>
                              ) : (
                                <>
                                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                    Desglose de insumos
                                  </p>
                                  <table className="text-xs">
                                    <thead>
                                      <tr className="text-gray-400">
                                        <th className="text-left pb-1 font-medium pr-8">Insumo</th>
                                        <th className="text-right pb-1 font-medium pr-6">Cantidad</th>
                                        <th className="text-right pb-1 font-medium pr-6">Costo unit.</th>
                                        <th className="text-right pb-1 font-medium">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {prod.ingredients.map((ing) => (
                                        <tr key={ing.material_id}>
                                          <td className="py-1 text-gray-700 pr-8">{ing.material_name}</td>
                                          <td className="py-1 text-right text-gray-600 pr-6">{ing.quantity} {ing.unit}</td>
                                          <td className="py-1 text-right pr-6">
                                            {ing.unit_cost === 0
                                              ? <span className="text-amber-500">Sin precio</span>
                                              : <span className="text-gray-600">{fmt(ing.unit_cost)}</span>}
                                          </td>
                                          <td className="py-1 text-right font-medium text-gray-800">
                                            {fmt(ing.quantity * ing.unit_cost)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t border-gray-200">
                                        <td colSpan={3} className="pt-1.5 font-semibold text-gray-600 pr-6">
                                          Total costo directo
                                        </td>
                                        <td className="pt-1.5 text-right font-bold text-gray-900">
                                          {fmt(prod.direct_cost)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}

          {!loading && products.length > 0 && filteredProducts.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-50 bg-gray-50/30 text-xs text-gray-400 flex justify-between">
              <span>
                {filteredProducts.length} artículo{filteredProducts.length !== 1 ? "s" : ""}
                {costFiltersActive && ` (de ${products.length})`}
              </span>
              <span>Hacé clic en el nombre para ver el desglose de insumos</span>
            </div>
          )}
        </div>
        </>
      )}

      {/* ── INSUMOS TAB ── */}
      {tab === "insumos" && (
        <>
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar insumo…"
                value={matSearch}
                onChange={(e) => setMatSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {matSearch && (
                <button
                  onClick={() => setMatSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <select
              value={matStatus}
              onChange={(e) => setMatStatus(e.target.value as typeof matStatus)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">Todos</option>
              <option value="manual">Con precio manual</option>
              <option value="no_price">Sin precio</option>
            </select>
            {matFiltersActive && (
              <button
                onClick={clearMatFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700"
              >
                <X size={14} /> Limpiar
              </button>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {filteredMaterials.length} de {materialsWithCosts.length}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
          ) : materialsWithCosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package size={28} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No hay insumos cargados</p>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search size={28} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Sin resultados</p>
              <button
                onClick={clearMatFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                <X size={14} /> Limpiar filtros
              </button>
            </div>
          ) : (
            <>
              {selectedMatIds.size > 0 && (
                <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-blue-800">
                    <span className="font-semibold">{selectedMatIds.size}</span> insumo{selectedMatIds.size !== 1 ? "s" : ""} seleccionado{selectedMatIds.size !== 1 ? "s" : ""}
                    <span className="text-blue-600 ml-2 text-xs">los exportes incluirán solo la selección</span>
                  </p>
                  <button
                    onClick={clearMatSelection}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                  >
                    <X size={12} /> Limpiar selección
                  </button>
                </div>
              )}
              <div className="px-5 py-3 bg-blue-50/50 border-b border-blue-100">
                <p className="text-xs text-blue-700">
                  El <strong>precio vigente</strong> es el que se usa para calcular costos de artículos.
                  Si hay precio manual, tiene prioridad sobre el último precio de compra.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-3 py-3 w-8">
                        <button
                          type="button"
                          onClick={toggleSelectAllMats}
                          className="text-gray-400 hover:text-blue-600 inline-flex items-center"
                          title={allFilteredMatsSelected ? "Deseleccionar todos los visibles" : "Seleccionar todos los visibles"}
                        >
                          {allFilteredMatsSelected
                            ? <CheckSquare size={14} className="text-blue-500" />
                            : <Square size={14} />}
                        </button>
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Insumo</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Unidad</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Último precio compra</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio manual</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Precio vigente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredMaterials.map((mat) => {
                      const editVal = manualCostEdits[mat.id] ?? "";
                      const parsedManual = editVal.trim() !== "" ? parseFloat(editVal) : null;
                      const isManualActive = parsedManual != null && !isNaN(parsedManual) && parsedManual > 0;
                      const effectiveCost = isManualActive
                        ? parsedManual
                        : mat.last_purchase_cost;
                      const isMatSelected = selectedMatIds.has(mat.id);
                      return (
                        <tr key={mat.id} className={`transition-colors ${isMatSelected ? "bg-blue-50/40" : "hover:bg-gray-50/40"}`}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isMatSelected}
                              onChange={() => toggleMatSelection(mat.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-200 cursor-pointer"
                            />
                          </td>
                          <td className="px-5 py-3 font-medium text-gray-900">{mat.name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{mat.unit}</td>
                          <td className="px-4 py-3 text-right text-gray-500 text-xs">
                            {mat.last_purchase_cost != null
                              ? fmt(mat.last_purchase_cost)
                              : <span className="text-gray-300">Sin compras</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isManualActive && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                                  <Tag size={9} /> Manual
                                </span>
                              )}
                              <input
                                type="number"
                                value={editVal}
                                onChange={(e) =>
                                  setManualCostEdits((prev) => ({ ...prev, [mat.id]: e.target.value }))
                                }
                                min={0}
                                step={1}
                                placeholder="—"
                                className="w-24 border border-gray-200 rounded px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-blue-200"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {effectiveCost != null && effectiveCost > 0 ? (
                              <span className={`font-semibold text-sm ${isManualActive ? "text-blue-700" : "text-gray-800"}`}>
                                {fmt(effectiveCost)}
                              </span>
                            ) : (
                              <span className="text-red-500 text-xs font-medium">Sin precio</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/30">
                <p className="text-xs text-gray-400">
                  {filteredMaterials.length} insumo{filteredMaterials.length !== 1 ? "s" : ""}
                  {matFiltersActive && ` (de ${materialsWithCosts.length})`} ·{" "}
                  {filteredMaterials.filter((m) => {
                    const v = manualCostEdits[m.id] ?? "";
                    return v.trim() !== "" && parseFloat(v) > 0;
                  }).length} con precio manual
                </p>
              </div>
            </>
          )}
        </div>
        </>
      )}

      {/* ── HISTORIAL TAB ── */}
      {tab === "historial" && (
        <>
        {/* Filters */}
        {history.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Desde</label>
                <input
                  type="date"
                  value={histDateFrom}
                  onChange={(e) => setHistDateFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Hasta</label>
                <input
                  type="date"
                  value={histDateTo}
                  onChange={(e) => setHistDateTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar artículo dentro de las listas…"
                  value={histItemSearch}
                  onChange={(e) => setHistItemSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {histItemSearch && (
                  <button
                    onClick={() => setHistItemSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {(histFiltersActive || histItemSearch) && (
                <button
                  onClick={clearHistFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  <X size={14} /> Limpiar
                </button>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {filteredHistory.length} de {history.length}
              </span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {historyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-gray-300" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History size={28} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">Sin historial todavía</p>
              <p className="text-sm text-gray-400 mt-1">
                Usá &quot;Guardar lista de precios&quot; para crear el primer registro.
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search size={28} className="text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Sin resultados</p>
              <p className="text-sm text-gray-400 mt-1">Ninguna lista coincide con el rango de fechas</p>
              <button
                onClick={clearHistFilters}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                <X size={14} /> Limpiar filtros
              </button>
            </div>
          ) : (
            <div>
              {filteredHistory.map((h, idx) => (
                <div key={h.id} className={idx > 0 ? "border-t border-gray-100" : ""}>
                  <button
                    onClick={() => toggleHistoryExpand(h.id)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expandedHistoryId === h.id
                        ? <ChevronDown size={14} className="text-gray-400" />
                        : <ChevronRight size={14} className="text-gray-300" />}
                      <span className="font-medium text-gray-900">{fmtDateTime(h.generated_date)}</span>
                    </div>
                    {loadingHistoryItems === h.id && (
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    )}
                  </button>

                  {expandedHistoryId === h.id && h.items && (() => {
                    const items = h.items;
                    const visibleItems = filterHistoryItems(items);
                    const visibleIdx = items
                      .map((it, idx) => ({ it, idx }))
                      .filter(({ it }) => visibleItems.includes(it))
                      .map(({ idx }) => idx);
                    const histSelected = selectedKeysForHistory(h);
                    const allVisibleSelected =
                      visibleIdx.length > 0 && visibleIdx.every((idx) => histSelected.has(histItemKey(h.id, idx)));
                    const selCount = histSelected.size;
                    return (
                    <div className="px-5 pb-5 overflow-x-auto">
                      {selCount > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between flex-wrap gap-2">
                          <p className="text-xs text-blue-800">
                            <span className="font-semibold">{selCount}</span> artículo{selCount !== 1 ? "s" : ""} seleccionado{selCount !== 1 ? "s" : ""}
                            <span className="text-blue-600 ml-2">los exportes incluirán solo la selección</span>
                          </p>
                          <button
                            onClick={() => clearHistSelection(h.id)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                          >
                            <X size={12} /> Limpiar selección
                          </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                        <p className="text-xs text-gray-400">
                          {histItemSearch
                            ? `${visibleItems.length} de ${items.length} artículo${items.length !== 1 ? "s" : ""}`
                            : `${items.length} artículo${items.length !== 1 ? "s" : ""}`}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleExportHistoryXLSX(h)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            title="Exportar lista a Excel"
                          >
                            <FileSpreadsheet size={12} />
                            Excel
                          </button>
                          <button
                            onClick={() => handleExportHistoryPDF(h)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            title="Exportar lista a PDF"
                          >
                            <FileDown size={12} />
                            PDF
                          </button>
                          <button
                            onClick={() => handleExportHistoryCSV(h)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            title="Exportar lista a CSV"
                          >
                            <FileSpreadsheet size={12} />
                            CSV
                          </button>
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 uppercase tracking-wider border-b border-gray-100">
                            <th className="py-2 pr-2 w-8">
                              <button
                                type="button"
                                onClick={() => toggleSelectAllHistItems(h)}
                                className="text-gray-400 hover:text-blue-600 inline-flex items-center"
                                title={allVisibleSelected ? "Deseleccionar todos los visibles" : "Seleccionar todos los visibles"}
                              >
                                {allVisibleSelected
                                  ? <CheckSquare size={14} className="text-blue-500" />
                                  : <Square size={14} />}
                              </button>
                            </th>
                            <th className="text-left py-2 pr-4 font-semibold">Artículo</th>
                            <th className="text-right py-2 pr-3 font-semibold whitespace-nowrap">Costo dir.</th>
                            <th className="text-right py-2 pr-3 font-semibold whitespace-nowrap">M.O.</th>
                            <th className="text-right py-2 pr-3 font-semibold whitespace-nowrap">Total</th>
                            <th className="text-right py-2 pr-3 font-semibold whitespace-nowrap">Mg%</th>
                            <th className="text-right py-2 pr-3 font-semibold whitespace-nowrap">Minorista</th>
                            <th className="text-right py-2 pr-3 font-semibold whitespace-nowrap">Dto%</th>
                            <th className="text-right py-2 font-semibold whitespace-nowrap">Mayorista</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {visibleIdx.map((idx) => {
                            const item = items[idx];
                            const k = histItemKey(h.id, idx);
                            const sel = histSelected.has(k);
                            return (
                            <tr key={idx} className={sel ? "bg-blue-50/40" : "hover:bg-gray-50/40"}>
                              <td className="py-2 pr-2">
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => toggleHistItemSelection(h.id, idx)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-200 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 pr-4 font-medium text-gray-900">{item.product_name}</td>
                              <td className="py-2 pr-3 text-right font-mono text-gray-600">{fmt(item.direct_cost)}</td>
                              <td className="py-2 pr-3 text-right font-mono text-gray-600">{fmt(item.labor_cost)}</td>
                              <td className="py-2 pr-3 text-right font-mono font-semibold text-gray-800">{fmt(item.total_cost)}</td>
                              <td className="py-2 pr-3 text-right text-gray-600">{item.margin_percentage.toFixed(1)}%</td>
                              <td className="py-2 pr-3 text-right font-semibold text-blue-700">{fmt(item.price_minorista)}</td>
                              <td className="py-2 pr-3 text-right text-gray-600">{item.discount_percentage.toFixed(1)}%</td>
                              <td className="py-2 text-right font-semibold text-purple-700">{fmt(item.price_mayorista)}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {items.length === 0 && (
                        <p className="text-center py-4 text-xs text-gray-400">Esta lista no tiene ítems.</p>
                      )}
                      {items.length > 0 && visibleItems.length === 0 && (
                        <p className="text-center py-4 text-xs text-gray-400">Sin coincidencias para la búsqueda.</p>
                      )}
                    </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
