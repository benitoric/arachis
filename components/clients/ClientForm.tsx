"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Save, X, Loader2 } from "lucide-react";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

interface ClientFormProps {
  initialData?: ClientRow;
  mode: "create" | "edit";
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return "+549" + digits;
  }
  return phone;
}

export default function ClientForm({ initialData, mode }: ClientFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lastName, setLastName] = useState(initialData?.last_name ?? "");
  const [firstName, setFirstName] = useState(initialData?.first_name ?? "");
  const [phone, setPhone] = useState(initialData?.phone ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [address, setAddress] = useState(initialData?.address ?? "");
  const [city, setCity] = useState(initialData?.city ?? "");
  const [priceType, setPriceType] = useState<"minorista" | "mayorista" | "otra">(
    initialData?.price_type ?? "minorista"
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!lastName.trim()) {
      setError("El apellido es obligatorio.");
      setLoading(false);
      return;
    }
    if (!firstName.trim()) {
      setError("El nombre es obligatorio.");
      setLoading(false);
      return;
    }
    if (!phone.trim()) {
      setError("El teléfono es obligatorio.");
      setLoading(false);
      return;
    }

    const payload = {
      last_name: lastName.trim(),
      first_name: firstName.trim(),
      phone: normalizePhone(phone.trim()),
      email: email.trim() || null,
      address: address.trim() || null,
      city: city.trim() || null,
      price_type: priceType,
      notes: notes.trim() || null,
    };

    if (mode === "create") {
      const { error: err } = await supabase.from("clients").insert({ ...payload, status: "active" });
      if (err) {
        setError(err.message || "Error al crear el cliente. Intentá de nuevo.");
        setLoading(false);
        return;
      }
    } else if (mode === "edit" && initialData) {
      const { error: err } = await supabase
        .from("clients")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", initialData.id);
      if (err) {
        setError(err.message || "Error al actualizar el cliente. Intentá de nuevo.");
        setLoading(false);
        return;
      }
    }

    router.push("/clients");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-5">
        <h2 className="font-semibold text-gray-800 text-sm uppercase tracking-wider text-chocolate/70">
          Datos principales
        </h2>

        {/* Apellido + Nombre */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Apellido <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              placeholder="Ej: García"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              placeholder="Ej: María"
            />
          </div>
        </div>

        {/* Phone + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Teléfono <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              placeholder="+54 381 555 0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              placeholder="contacto@empresa.com"
            />
          </div>
        </div>

        {/* Address + City */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Dirección
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              placeholder="Av. Corrientes 1234"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ciudad
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all"
              placeholder="Buenos Aires"
            />
          </div>
        </div>

        {/* Price type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Tipo de precio
          </label>
          <select
            value={priceType}
            onChange={(e) => setPriceType(e.target.value as "minorista" | "mayorista" | "otra")}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold bg-white cursor-pointer"
          >
            <option value="minorista">Minorista</option>
            <option value="mayorista">Mayorista</option>
            <option value="otra">Otra</option>
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Notas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all resize-none"
            placeholder="Información adicional sobre el cliente..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-ink px-5 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {loading ? "Guardando..." : mode === "create" ? "Crear cliente" : "Guardar cambios"}
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
