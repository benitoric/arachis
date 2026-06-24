"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Save, X, Loader2, Trash2, Plus, FlaskConical, Search, Upload } from "lucide-react";
import NewMaterialModal from "@/components/materials/NewMaterialModal";
import type { Database } from "@/lib/types/database";
import { pName } from "@/lib/utils/product";

type Material = Database["public"]["Tables"]["materials"]["Row"];

export interface RecipeEntry {
  id?: string;
  material_id: string;
  quantity: number;
  material_name: string;
  material_unit: string;
}

export interface ExistingImage {
  id: string;
  url: string;
  storage_path: string | null;
}

interface Props {
  mode: "create" | "edit";
  initialData?: { id: string; name: string; presentation: number; active: boolean; show_in_portal: boolean; image_url?: string | null };
  initialRecipe?: RecipeEntry[];
  initialImages?: ExistingImage[];
}

const UNIT_LABELS: Record<string, string> = {
  gramos: "g",
  kg: "kg",
  litro: "litro",
  ml: "ml",
  unidad: "unidades",
  cm: "cm",
};

export default function ProductForm({ mode, initialData, initialRecipe = [], initialImages }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(initialData?.name ?? "");
  const [presentation, setPresentation] = useState(
    initialData?.presentation ? String(initialData.presentation) : ""
  );
  const [active, setActive] = useState(initialData?.active ?? true);
  const [showInPortal, setShowInPortal] = useState(initialData?.show_in_portal ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Recipe state
  const [recipeItems, setRecipeItems] = useState<RecipeEntry[]>(initialRecipe);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);

  // Add ingredient state
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIdx, setSearchActiveIdx] = useState(-1);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState("");
  const [addError, setAddError] = useState("");
  const [showNewMaterial, setShowNewMaterial] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);

  // Image upload state
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(initialImages ?? []);
  const [pendingFiles, setPendingFiles] = useState<{ localId: string; file: File; preview: string }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleRemoveExistingImage(img: ExistingImage) {
    if (mode === "edit" && initialData?.id) {
      await supabase.from("product_images").delete().eq("id", img.id);
      if (img.storage_path) {
        await supabase.storage.from("product-images").remove([img.storage_path]);
      }
      const remaining = existingImages.filter((i) => i.id !== img.id);
      setExistingImages(remaining);
      const newFirstUrl = remaining[0]?.url ?? null;
      await supabase.from("products").update({ image_url: newFirstUrl }).eq("id", initialData.id);
    }
  }

  function handleRemovePending(localId: string) {
    setPendingFiles((prev) => prev.filter((f) => f.localId !== localId));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPending = files.map((file) => ({
      localId: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Drag & drop reorder of existing images
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  async function handleImageDrop(toIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);
    if (from === null || from === toIndex) return;
    const reordered = [...existingImages];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(toIndex, 0, moved);
    setExistingImages(reordered);
    if (mode === "edit" && initialData?.id) {
      await Promise.all(
        reordered.map((img, i) =>
          supabase.from("product_images").update({ position: i }).eq("id", img.id)
        )
      );
      await supabase
        .from("products")
        .update({ image_url: reordered[0]?.url ?? null })
        .eq("id", initialData.id);
    }
  }

  useEffect(() => {
    supabase.from("materials").select("*").order("name").then(({ data }) => {
      setAllMaterials(data ?? []);
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const usedMaterialIds = new Set(recipeItems.map((r) => r.material_id));
  const filteredMaterials = allMaterials.filter(
    (m) =>
      !usedMaterialIds.has(m.id) &&
      m.name.toLowerCase().includes(search.toLowerCase())
  );

  function selectMaterial(mat: Material, focusQuantity = false) {
    setSelectedMaterial(mat);
    setSearch(mat.name);
    setSearchOpen(false);
    setSearchActiveIdx(-1);
    setAddError("");
    if (focusQuantity) {
      setTimeout(() => quantityRef.current?.focus(), 50);
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (!searchOpen || filteredMaterials.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSearchActiveIdx((i) => Math.min(i + 1, filteredMaterials.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSearchActiveIdx((i) => Math.max(i - 1, 0));
    } else if ((e.key === "Enter" || e.key === "Tab") && searchActiveIdx >= 0) {
      e.preventDefault();
      selectMaterial(filteredMaterials[searchActiveIdx], e.key === "Tab");
    } else if (e.key === "Escape") {
      setSearchOpen(false);
      setSearchActiveIdx(-1);
    }
  }

  function handleAdd() {
    if (!selectedMaterial) {
      setAddError("Seleccioná un insumo de la lista.");
      return;
    }
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setAddError("Ingresá una cantidad válida.");
      return;
    }
    if (usedMaterialIds.has(selectedMaterial.id)) {
      setAddError("Ese insumo ya está en la receta.");
      return;
    }
    setRecipeItems((prev) => [
      ...prev,
      {
        material_id: selectedMaterial.id,
        quantity: qty,
        material_name: selectedMaterial.name,
        material_unit: selectedMaterial.unit,
      },
    ]);
    setSelectedMaterial(null);
    setSearch("");
    setQuantity("");
    setAddError("");
  }

  function handleRemove(materialId: string) {
    setRecipeItems((prev) => prev.filter((r) => r.material_id !== materialId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("El sabor/variedad es requerido.");
      return;
    }
    const pres = parseInt(presentation, 10);
    if (!presentation || isNaN(pres) || pres <= 0) {
      setError("La presentación en gramos es requerida.");
      return;
    }
    setLoading(true);
    setError("");

    // Check for duplicate (same name + presentation)
    let dupeQuery = supabase
      .from("products")
      .select("id")
      .ilike("name", name.trim())
      .eq("presentation", pres);
    if (mode === "edit" && initialData) {
      dupeQuery = dupeQuery.neq("id", initialData.id);
    }
    const { data: existing } = await dupeQuery.maybeSingle();
    if (existing) {
      setError(`Ya existe el artículo "${pName({ name: name.trim(), presentation: pres })}".`);
      setLoading(false);
      return;
    }

    let productId = initialData?.id;

    if (mode === "create") {
      const { data, error: err } = await supabase
        .from("products")
        .insert({ name: name.trim(), presentation: pres, active, show_in_portal: showInPortal })
        .select("id")
        .single();
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      productId = data.id;
    } else {
      const { error: err } = await supabase
        .from("products")
        .update({ name: name.trim(), presentation: pres, active, show_in_portal: showInPortal })
        .eq("id", productId!);
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      // Delete existing recipes before re-inserting
      const { error: delErr } = await supabase
        .from("recipes")
        .delete()
        .eq("product_id", productId!);
      if (delErr) {
        setError(delErr.message);
        setLoading(false);
        return;
      }
    }

    if (recipeItems.length > 0) {
      const { error: recErr } = await supabase.from("recipes").insert(
        recipeItems.map((r) => ({
          product_id: productId!,
          material_id: r.material_id,
          quantity: r.quantity,
        }))
      );
      if (recErr) {
        setError(recErr.message);
        setLoading(false);
        return;
      }
    }

    // Upload pending images
    if (pendingFiles.length > 0 && productId) {
      setUploadingImage(true);
      const uploadedImages: ExistingImage[] = [];
      for (const pending of pendingFiles) {
        try {
          const ext = pending.file.name.split(".").pop() ?? "jpg";
          const imageId = crypto.randomUUID();
          const path = `${productId}/${imageId}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(path, pending.file, { contentType: pending.file.type });
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
          const nextPosition = existingImages.length + uploadedImages.length;
          const { data: imgData } = await supabase
            .from("product_images")
            .insert({ product_id: productId, url: publicUrl, storage_path: path, position: nextPosition })
            .select("id")
            .single();
          if (imgData) uploadedImages.push({ id: imgData.id, url: publicUrl, storage_path: path });
        } catch (err) {
          const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? JSON.stringify(err);
          setError("Error al subir imagen: " + msg);
          setLoading(false);
          setUploadingImage(false);
          return;
        }
      }
      // Keep image_url in sync with first image
      const allImages = [...existingImages, ...uploadedImages];
      if (allImages.length > 0) {
        await supabase.from("products").update({ image_url: allImages[0].url }).eq("id", productId);
      }
      setUploadingImage(false);
    }

    setLoading(false);
    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {showNewMaterial && (
        <NewMaterialModal
          onClose={() => setShowNewMaterial(false)}
          onCreated={(mat) => {
            setShowNewMaterial(false);
            setAllMaterials((prev) =>
              [...prev, mat].sort((a, b) => a.name.localeCompare(b.name))
            );
            selectMaterial(mat, true);
          }}
        />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Section 1: Product data */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
        <h2 className="font-semibold text-gray-500 text-xs uppercase tracking-wider">
          Datos del artículo
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Sabor / Variedad <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Marroc"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Presentación (gramos) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={presentation}
              onChange={(e) => setPresentation(e.target.value)}
              placeholder="Ej: 400"
              min="1"
              step="1"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
            />
          </div>
        </div>

        {name.trim() && presentation && parseInt(presentation, 10) > 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Vista previa del nombre</p>
            <p className="text-sm font-medium text-gray-800">
              {pName({ name: name.trim(), presentation: parseInt(presentation, 10) })}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                active ? "bg-green-500" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="text-sm text-gray-700">{active ? "Activo" : "Inactivo"}</span>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setShowInPortal(!showInPortal)}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                showInPortal ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 bg-white"
              }`}
            >
              {showInPortal && (
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <span className="text-sm text-gray-700">Visible en portal de pedidos</span>
          </label>
        </div>
      </div>

      {/* Section: Images */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-500 text-xs uppercase tracking-wider">
          Imágenes del artículo
        </h2>
        <div className="flex flex-wrap gap-3">
          {/* Existing images (draggable to reorder) */}
          {existingImages.map((img, index) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => { dragIndex.current = index; }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
              onDragLeave={() => setDragOverIndex((cur) => (cur === index ? null : cur))}
              onDrop={() => handleImageDrop(index)}
              onDragEnd={() => { dragIndex.current = null; setDragOverIndex(null); }}
              className={`relative group w-24 h-24 rounded-xl overflow-hidden border flex-shrink-0 cursor-move transition-all ${
                dragOverIndex === index ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-200"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="w-full h-full object-cover pointer-events-none" />
              {index === 0 && (
                <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                  Principal
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemoveExistingImage(img)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/70"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
          {/* Pending images (not yet saved) */}
          {pendingFiles.map((pf) => (
            <div key={pf.localId} className="relative group w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed border-blue-300 flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pf.preview} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemovePending(pf.localId)}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X size={18} className="text-white" />
              </button>
            </div>
          ))}
          {/* Add image button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
          >
            <Upload size={18} />
            <span className="text-xs">Agregar</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageChange}
          className="hidden"
        />
        {uploadingImage && (
          <p className="text-xs text-blue-500 flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> Subiendo imágenes…
          </p>
        )}
        <p className="text-xs text-gray-400">JPG, PNG o WebP. Las imágenes nuevas se suben al guardar. Arrastrá para reordenar; la primera es la principal.</p>
      </div>

      {/* Section 2: Recipe */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-500 text-xs uppercase tracking-wider">
          Receta / Ingredientes
        </h2>

        {/* Ingredient list */}
        {recipeItems.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase border-b border-gray-100">
                <th className="text-left pb-2 font-semibold">Insumo</th>
                <th className="text-left pb-2 font-semibold">Cantidad</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recipeItems.map((item) => (
                <tr key={item.material_id}>
                  <td className="py-2.5 font-medium text-gray-800">{item.material_name}</td>
                  <td className="py-2.5 text-gray-600">
                    {item.quantity} {UNIT_LABELS[item.material_unit] ?? item.material_unit}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(item.material_id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Quitar ingrediente"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400">Sin ingredientes todavía.</p>
        )}

        {/* Add ingredient */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Agregar ingrediente
          </p>
          <div className="flex flex-wrap gap-2 items-start">
            {/* Material autocomplete */}
            <div ref={searchRef} className="relative flex-1 min-w-48">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedMaterial(null);
                    setSearchOpen(true);
                    setSearchActiveIdx(-1);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => { setSearchOpen(false); setSearchActiveIdx(-1); }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Buscar insumo…"
                  className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {searchOpen && filteredMaterials.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredMaterials.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectMaterial(m); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                        idx === searchActiveIdx ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"
                      }`}
                    >
                      <span>{m.name}</span>
                      <span className={`text-xs ${idx === searchActiveIdx ? "text-blue-400" : "text-gray-400"}`}>
                        {UNIT_LABELS[m.unit] ?? m.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity + unit label */}
            <div className="flex items-center gap-1.5">
              <input
                ref={quantityRef}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Cant."
                min="0"
                step="0.001"
                className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {selectedMaterial && (
                <span className="text-xs text-gray-500 w-14 shrink-0">
                  {UNIT_LABELS[selectedMaterial.unit] ?? selectedMaterial.unit}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-white transition-colors"
              style={{ backgroundColor: "#49789d" }}
            >
              <Plus size={14} />
              Agregar
            </button>

            <button
              type="button"
              onClick={() => setShowNewMaterial(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FlaskConical size={14} />
              Nuevo insumo
            </button>
          </div>

          {addError && (
            <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-1.5">{addError}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-chocolate hover:bg-dark-red text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {loading ? "Guardando..." : mode === "create" ? "Crear artículo" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
        >
          <X size={15} />
          Cancelar
        </button>
      </div>
    </form>
  );
}
