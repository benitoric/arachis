"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, XCircle, Upload } from "lucide-react";

const MAPPINGS = [
  { file: "marroc-130.jpg",                            name: "Marroc",                            presentation: 130 },
  { file: "marroc-400.jpg",                            name: "Marroc",                            presentation: 400 },
  { file: "chocolate-semiamargo-almendras-130.jpg",    name: "Chocolate semiamargo y almendras",  presentation: 130 },
  { file: "chocolate-semiamargo-almendras-400.jpg",    name: "Chocolate semiamargo y almendras",  presentation: 400 },
  { file: "chocolate-leche-mani-130.jpg",              name: "Chocolate con leche y maní",        presentation: 130 },
  { file: "chocolate-leche-mani-400.jpg",              name: "Chocolate con leche y maní",        presentation: 400 },
  { file: "chocolate-blanco-pistachos-130.jpg",        name: "Chocolate blanco y pistachos",      presentation: 130 },
  { file: "chocolate-blanco-pistachos-400.jpg",        name: "Chocolate blanco y pistachos",      presentation: 400 },
  { file: "chocolate-leche-pistachos-130.jpg",         name: "Chocolate con leche y pistachos",   presentation: 130 },
  { file: "chocolate-leche-pistachos-400.jpg",         name: "Chocolate con leche y pistachos",   presentation: 400 },
  { file: "chocolate-semiamargo-pistachos-130.jpg",    name: "Chocolate semiamargo y pistachos",  presentation: 130 },
  { file: "chocolate-semiamargo-pistachos-400.jpg",    name: "Chocolate semiamargo y pistachos",  presentation: 400 },
];

type RowStatus = "idle" | "uploading" | "ok" | "error";

interface RowState {
  status: RowStatus;
  message: string;
  publicUrl?: string;
}

export default function UploadImagesPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<RowState[]>(MAPPINGS.map(() => ({ status: "idle", message: "" })));
  const [running, setRunning] = useState(false);

  function setRow(index: number, update: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...update } : r)));
  }

  async function uploadOne(index: number) {
    const mapping = MAPPINGS[index];
    setRow(index, { status: "uploading", message: "Subiendo…" });

    try {
      // 1. Fetch image from /public/products/
      const res = await fetch(`/products/${mapping.file}`);
      if (!res.ok) throw new Error(`No se encontró /products/${mapping.file} (HTTP ${res.status})`);
      const blob = await res.blob();

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(mapping.file, blob, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

      // 3. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(mapping.file);

      // 4. Find matching product
      const { data: product, error: findErr } = await supabase
        .from("products")
        .select("id")
        .ilike("name", mapping.name)
        .eq("presentation", mapping.presentation)
        .maybeSingle();
      if (findErr) throw new Error(`DB búsqueda: ${findErr.message}`);
      if (!product) throw new Error(`Producto no encontrado: "${mapping.name}" (${mapping.presentation}g)`);

      // 5. Update image_url
      const { error: updateErr } = await supabase
        .from("products")
        .update({ image_url: publicUrl })
        .eq("id", product.id);
      if (updateErr) throw new Error(`DB update: ${updateErr.message}`);

      setRow(index, { status: "ok", message: "Listo", publicUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setRow(index, { status: "error", message: msg });
    }
  }

  async function uploadAll() {
    setRunning(true);
    for (let i = 0; i < MAPPINGS.length; i++) {
      await uploadOne(i);
    }
    setRunning(false);
  }

  const doneCount = rows.filter((r) => r.status === "ok").length;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subir imágenes de productos</h1>
        <p className="text-gray-500 mt-0.5 text-sm">
          Lee las imágenes de <code className="bg-gray-100 px-1 rounded">/public/products/</code>, las sube al
          bucket <code className="bg-gray-100 px-1 rounded">product-images</code> de Supabase Storage y actualiza{" "}
          <code className="bg-gray-100 px-1 rounded">image_url</code> en cada producto.
        </p>
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 space-y-1">
          <p>
            <strong>Prerrequisito:</strong> El bucket{" "}
            <code className="bg-amber-100 px-1 rounded">product-images</code> debe existir en
            Supabase Storage con acceso <strong>público</strong>.
          </p>
          <p className="text-amber-700">
            Supabase → Storage → New bucket → nombre:{" "}
            <code className="bg-amber-100 px-1 rounded">product-images</code> → marcar &quot;Public bucket&quot;.
          </p>
          <p className="text-amber-700">
            También debe estar ejecutada la migración SQL{" "}
            <code className="bg-amber-100 px-1 rounded">023_product_image_url.sql</code> en Supabase.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={uploadAll}
          disabled={running}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: "#49789d" }}
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {running ? "Subiendo…" : "Subir todas las imágenes"}
        </button>
        <span className="text-sm text-gray-500">
          {doneCount} / {MAPPINGS.length} completados
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Archivo
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Producto
              </th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">
                Estado
              </th>
              <th className="px-4 py-3 w-16 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {MAPPINGS.map((m, i) => {
              const row = rows[i];
              return (
                <tr key={m.file} className="hover:bg-gray-50/40 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500 max-w-[200px] truncate">
                    {m.file}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{m.name}</span>
                    <span className="text-gray-400 ml-1">({m.presentation}g)</span>
                    {row.publicUrl && (
                      <div className="mt-1.5">
                        <img
                          src={row.publicUrl}
                          alt={m.name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-100"
                        />
                      </div>
                    )}
                    {row.status === "error" && (
                      <p className="text-xs text-red-500 mt-1 max-w-xs">{row.message}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {row.status === "idle" && <span className="text-gray-300 text-sm">—</span>}
                    {row.status === "uploading" && (
                      <div className="flex items-center justify-center gap-1.5 text-blue-500">
                        <Loader2 size={13} className="animate-spin" />
                        <span className="text-xs">Subiendo</span>
                      </div>
                    )}
                    {row.status === "ok" && (
                      <div className="flex items-center justify-center gap-1.5 text-green-600">
                        <CheckCircle2 size={13} />
                        <span className="text-xs font-medium">Listo</span>
                      </div>
                    )}
                    {row.status === "error" && (
                      <div className="flex items-center justify-center gap-1.5 text-red-500">
                        <XCircle size={13} />
                        <span className="text-xs">Error</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => uploadOne(i)}
                      disabled={running || row.status === "uploading"}
                      className="text-xs font-medium text-gray-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
                    >
                      Subir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
