"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2, Package } from "lucide-react";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];

interface Props {
  onClose: () => void;
  onCreated: (product: ProductRow) => void;
}

export default function NewProductModal({ onClose, onCreated }: Props) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [presentation, setPresentation] = useState("");
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
    if (!name.trim()) { setError("El sabor/variedad es obligatorio."); return; }
    const pres = parseInt(presentation, 10);
    if (!presentation || isNaN(pres) || pres <= 0) {
      setError("La presentación en gramos es obligatoria.");
      return;
    }
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("products")
      .insert({ name: name.trim(), presentation: pres, active: true })
      .select("*")
      .single();
    if (err) {
      setError(err.message || "Error al crear el artículo.");
      setSaving(false);
      return;
    }
    if (!data) { setError("No se pudo obtener el artículo creado."); setSaving(false); return; }
    onCreated(data);
  }

  const pres = parseInt(presentation, 10);
  const preview = name.trim() && pres > 0
    ? pName({ name: name.trim(), presentation: pres })
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Package size={18} style={{ color: "#a9760a" }} />
            <h2 className="font-semibold text-gray-900">Nuevo artículo</h2>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* div en lugar de form para evitar form anidado */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sabor / Variedad <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Marroc"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Presentación (gramos) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
              placeholder="Ej: 400"
              min="1"
              step="1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {preview && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-400 mb-0.5">Se mostrará como</p>
              <p className="text-sm font-medium text-gray-800">{preview}</p>
            </div>
          )}

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
              style={{ backgroundColor: "#a9760a" }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando…" : "Crear artículo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
