"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2, FlaskConical } from "lucide-react";
import type { Database } from "@/lib/types/database";

type MaterialRow = Database["public"]["Tables"]["materials"]["Row"];

interface Props {
  onClose: () => void;
  onCreated: (material: MaterialRow) => void;
  initialName?: string;
}

const UNIT_OPTIONS = [
  { value: "gramos", label: "gramos" },
  { value: "kg",     label: "kg" },
  { value: "litro",  label: "litro" },
  { value: "ml",     label: "ml" },
  { value: "unidad", label: "unidades" },
  { value: "cm",     label: "cm" },
];

export default function NewMaterialModal({ onClose, onCreated, initialName = "" }: Props) {
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState("kg");
  const [criticalStock, setCriticalStock] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleCrear(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("materials")
      .insert({
        name: name.trim(),
        unit,
        critical_stock: criticalStock ? parseFloat(criticalStock) : null,
      })
      .select("*")
      .single();
    if (err) {
      console.error("Error al crear insumo:", err);
      setError(err.message || "Error al crear el insumo. Intentá de nuevo.");
      setSaving(false);
      return;
    }
    if (!data) {
      setError("No se pudo obtener el insumo creado. Intentá de nuevo.");
      setSaving(false);
      return;
    }
    onCreated(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FlaskConical size={18} style={{ color: "#49789d" }} />
            <h2 className="font-semibold text-gray-900">Nuevo insumo</h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* div en lugar de form para evitar form anidado dentro de ProductForm */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Harina 000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unidad <span className="text-red-500">*</span>
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
            >
              {UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stock crítico (opcional)
            </label>
            <input
              type="number"
              value={criticalStock}
              onChange={(e) => setCriticalStock(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleCrear}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: "#49789d" }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando…" : "Crear insumo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
