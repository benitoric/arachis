"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Loader2, ShoppingCart, ArrowRight, ArrowLeft, CheckCircle2, Plus, Minus, Image as ImageIcon, X } from "lucide-react";

interface ProductItem {
  id: string;
  name: string;
  price_minorista: number;
  image_url: string | null;
  images: string[];
}

interface CartEntry {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

type Step = 1 | 2 | 3;

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n);

const today = new Date().toISOString().slice(0, 10);

const PHONE_DIGITS_EXPECTED = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function countDigits(s: string) {
  return (s.match(/\d/g) ?? []).length;
}

export default function PortalPage() {
  const [step, setStep] = useState<Step>(1);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Cart: product_id → quantity
  const [cart, setCart] = useState<Record<string, number>>({});

  // Step 2 fields
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [cityOption, setCityOption] = useState<"" | "San Miguel de Tucumán" | "Yerba Buena" | "Otra">("");
  const [guestCity, setGuestCity] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [desiredDate, setDesiredDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"efectivo" | "transferencia" | "">("");
  const [deliveryMethod, setDeliveryMethod] = useState<"retiro" | "cadeteria" | "">("");
  const [notes, setNotes] = useState("");

  // Step 2 validation error (lifted from inline component)
  const [localError, setLocalError] = useState("");

  // Step 3
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [orderNumber, setOrderNumber] = useState<number | null>(null);

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch("/api/portal/catalog", { cache: "no-store" });
        const json = await res.json();
        if (res.ok && json.ok && Array.isArray(json.items)) {
          setProducts(json.items);
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error("[portal] Catalog load error:", err);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    }
    loadProducts();
  }, []);

  function setQty(productId: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: qty };
    });
  }

  const cartEntries: CartEntry[] = products
    .filter((p) => (cart[p.id] ?? 0) > 0)
    .map((p) => ({
      product_id: p.id,
      product_name: p.name,
      quantity: cart[p.id],
      unit_price: p.price_minorista,
    }));

  const total = cartEntries.reduce((acc, it) => acc + it.quantity * it.unit_price, 0);
  const hasItems = cartEntries.length > 0;

  const phoneDigits = countDigits(guestPhone);
  const phoneComplete = phoneDigits === PHONE_DIGITS_EXPECTED;

  function validate() {
    if (!guestFirstName.trim()) return "Ingresá tu nombre.";
    if (!guestLastName.trim()) return "Ingresá tu apellido.";
    if (!guestPhone.trim()) return "Ingresá tu teléfono.";
    if (phoneDigits < PHONE_DIGITS_EXPECTED) return `Faltan ${PHONE_DIGITS_EXPECTED - phoneDigits} dígito${PHONE_DIGITS_EXPECTED - phoneDigits === 1 ? "" : "s"} en el teléfono.`;
    if (phoneDigits > PHONE_DIGITS_EXPECTED) return `El teléfono tiene ${phoneDigits - PHONE_DIGITS_EXPECTED} dígito${phoneDigits - PHONE_DIGITS_EXPECTED === 1 ? "" : "s"} de más.`;
    if (!cityOption) return "Seleccioná tu ciudad.";
    if (cityOption === "Otra" && !guestCity.trim()) return "Ingresá tu ciudad.";
    if (!guestEmail.trim()) return "Ingresá tu email.";
    if (!EMAIL_RE.test(guestEmail.trim())) return "El email ingresado no es válido.";
    if (!desiredDate) return "Seleccioná una fecha de entrega.";
    if (desiredDate < today) return "La fecha de entrega no puede ser en el pasado.";
    if (!paymentMethod) return "Seleccioná una modalidad de pago.";
    if (!deliveryMethod) return "Seleccioná una modalidad de entrega.";
    return "";
  }

  function handleNext() {
    const err = validate();
    if (err) { setLocalError(err); return; }
    setLocalError("");
    handleConfirm();
  }

  async function handleConfirm() {
    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/portal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestFirstName: guestFirstName.trim(),
          guestLastName: guestLastName.trim(),
          guestPhone: guestPhone.trim(),
          guestCity: guestCity.trim(),
          guestEmail: guestEmail.trim(),
          desiredDate,
          paymentMethod,
          deliveryMethod,
          notes: notes.trim(),
          items: cartEntries.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
          })),
        }),
      });

      let json: { ok?: boolean; error?: string; orderNumber?: number } = {};
      try {
        json = await res.json();
      } catch {
        // Server returned a non-JSON response (rare).
      }

      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "No se pudo confirmar el pedido. Intentá nuevamente.");
      }

      setOrderNumber(json.orderNumber ?? null);
      setStep(3);
    } catch (err: unknown) {
      console.error("Portal order error:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Error al enviar el pedido. Intentá nuevamente en unos minutos.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f0f6fb" }}>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
            onClick={() => setLightbox(null)}
          >
            <X size={28} />
          </button>

          {/* Prev */}
          {lightbox.images.length > 1 && lightbox.index > 0 && (
            <button
              className="absolute left-4 text-white/80 hover:text-white transition-colors z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50"
              onClick={(e) => { e.stopPropagation(); setLightbox((lb) => lb && { ...lb, index: lb.index - 1 }); }}
            >
              <ArrowLeft size={22} />
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.images[lightbox.index]}
            alt="Imagen del artículo"
            className="rounded-2xl shadow-2xl"
            style={{ maxWidth: "500px", maxHeight: "78vh", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightbox.images.length > 1 && lightbox.index < lightbox.images.length - 1 && (
            <button
              className="absolute right-4 text-white/80 hover:text-white transition-colors z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/30 hover:bg-black/50"
              onClick={(e) => { e.stopPropagation(); setLightbox((lb) => lb && { ...lb, index: lb.index + 1 }); }}
            >
              <ArrowRight size={22} />
            </button>
          )}

          {/* Dot indicators */}
          {lightbox.images.length > 1 && (
            <div className="absolute bottom-6 flex gap-2" onClick={(e) => e.stopPropagation()}>
              {lightbox.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightbox((lb) => lb && { ...lb, index: i })}
                  className={`w-2 h-2 rounded-full transition-all ${i === lightbox.index ? "bg-white scale-125" : "bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center gap-4">
          <Image
            src="/logo.png"
            alt="Arachis"
            width={180}
            height={180}
            style={{ height: "5rem", width: "auto" }}
            className="object-contain"
            priority
          />
          <div>
            <p className="font-bold text-gray-900 leading-tight">Arachis</p>
            <p className="text-xs text-gray-500">Portal de pedidos</p>
          </div>
        </div>
      </header>

      {/* Step indicator */}
      {step < 3 && (
        <div className="max-w-2xl mx-auto px-5 pt-6">
          <div className="flex items-center gap-2 mb-6">
            {[
              { n: 1, label: "Catálogo" },
              { n: 2, label: "Tus datos" },
            ].map(({ n, label }, idx) => (
              <div key={n} className="flex items-center gap-2">
                {idx > 0 && <div className="w-6 h-px bg-gray-200" />}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                      step >= n ? "text-white" : "bg-gray-100 text-gray-400"
                    }`}
                    style={step >= n ? { backgroundColor: "#49789d" } : undefined}
                  >
                    {n}
                  </span>
                  <span className={`text-sm font-medium ${step >= n ? "text-gray-800" : "text-gray-400"}`}>
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-2xl mx-auto px-5 pb-16">
        {step < 3 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={16} className="text-gray-400" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                {step === 1 ? "Seleccioná tus artículos" : "Completá tus datos"}
              </span>
            </div>
          </div>
        )}

        <div className={step < 3 ? "bg-white rounded-b-2xl shadow-sm border border-t-0 border-gray-100 p-6 -mt-px" : ""}>

          {/* ── STEP 1: Catalog ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">¿Qué querés pedir?</h2>
                <p className="text-gray-500 text-sm mt-1">Seleccioná los artículos y las cantidades.</p>
              </div>

              {loadingProducts ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="animate-spin text-gray-300" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No hay artículos disponibles en este momento.
                </div>
              ) : (
                <div className="space-y-3">
                  {products.map((p) => {
                    const qty = cart[p.id] ?? 0;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center p-4 rounded-xl border transition-colors gap-3 ${
                          qty > 0 ? "border-blue-200 bg-blue-50/40" : "border-gray-100 bg-white"
                        }`}
                      >
                        {/* Thumbnail */}
                        <button
                          type="button"
                          onClick={() => p.images.length > 0 && setLightbox({ images: p.images, index: 0 })}
                          className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-100 relative ${
                            p.images.length > 0 ? "cursor-pointer hover:opacity-90 transition-opacity" : "cursor-default"
                          }`}
                          disabled={p.images.length === 0}
                          title={p.images.length > 0 ? "Ver fotos" : undefined}
                        >
                          {p.images.length > 0 ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                              {p.images.length > 1 && (
                                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded leading-4">
                                  {p.images.length}
                                </span>
                              )}
                            </>
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <ImageIcon size={20} className="text-gray-300" />
                            </div>
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-sm font-semibold mt-0.5" style={{ color: "#49789d" }}>
                            {fmt(p.price_minorista)} / u.
                          </p>
                          {qty > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">Subtotal: {fmt(qty * p.price_minorista)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setQty(p.id, qty - 1)}
                            disabled={qty === 0}
                            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 disabled:opacity-30 transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className={`w-8 text-center font-semibold text-sm ${qty > 0 ? "text-gray-900" : "text-gray-300"}`}>
                            {qty}
                          </span>
                          <button
                            onClick={() => setQty(p.id, qty + 1)}
                            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-gray-300 transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasItems && (
                <div className="sticky bottom-4 mt-6">
                  <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-gray-500">{cartEntries.length} artículo{cartEntries.length !== 1 ? "s" : ""}</p>
                      <p className="font-bold text-gray-900 text-lg">{fmt(total)}</p>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                      style={{ backgroundColor: "#49789d" }}
                    >
                      Continuar <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Customer data ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="mb-2">
                <h2 className="text-xl font-bold text-gray-800">Tus datos</h2>
                <p className="text-gray-500 text-sm mt-1">Completá tus datos para confirmar el pedido.</p>
              </div>

              {/* Order summary */}
              <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resumen de tu pedido</p>
                {cartEntries.map((it) => (
                  <div key={it.product_id} className="flex justify-between text-sm py-1">
                    <span className="text-gray-700">{it.product_name} × {it.quantity}</span>
                    <span className="font-medium text-gray-900">{fmt(it.quantity * it.unit_price)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t border-blue-100 pt-2 mt-2">
                  <span className="text-gray-800">Total</span>
                  <span style={{ color: "#49789d" }}>{fmt(total)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={guestFirstName}
                      onChange={(e) => setGuestFirstName(e.target.value)}
                      placeholder="Ej: María"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apellido <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={guestLastName}
                      onChange={(e) => setGuestLastName(e.target.value)}
                      placeholder="Ej: García"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono (sin 0 y sin 15) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="381 555 0000"
                        maxLength={14}
                        aria-invalid={phoneDigits > 0 && !phoneComplete}
                        className={`w-full border rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 ${
                          phoneDigits === 0
                            ? "border-gray-200 focus:ring-blue-200"
                            : phoneComplete
                              ? "border-green-300 focus:ring-green-200"
                              : "border-red-300 focus:ring-red-200"
                        }`}
                      />
                      {phoneComplete && (
                        <CheckCircle2
                          size={18}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    {phoneDigits > 0 && !phoneComplete && (
                      <p className="mt-1 text-xs text-red-600">
                        {phoneDigits < PHONE_DIGITS_EXPECTED
                          ? `Faltan ${PHONE_DIGITS_EXPECTED - phoneDigits} dígito${PHONE_DIGITS_EXPECTED - phoneDigits === 1 ? "" : "s"}.`
                          : `Tiene ${phoneDigits - PHONE_DIGITS_EXPECTED} dígito${phoneDigits - PHONE_DIGITS_EXPECTED === 1 ? "" : "s"} de más.`}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ciudad <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={cityOption}
                      onChange={(e) => {
                        const value = e.target.value as typeof cityOption;
                        setCityOption(value);
                        if (value === "San Miguel de Tucumán" || value === "Yerba Buena") {
                          setGuestCity(value);
                        } else {
                          setGuestCity("");
                        }
                      }}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                    >
                      <option value="">Seleccioná una ciudad</option>
                      <option value="San Miguel de Tucumán">San Miguel de Tucumán</option>
                      <option value="Yerba Buena">Yerba Buena</option>
                      <option value="Otra">Otra</option>
                    </select>
                    {cityOption === "Otra" && (
                      <input
                        type="text"
                        value={guestCity}
                        onChange={(e) => setGuestCity(e.target.value)}
                        placeholder="Ingresá tu ciudad"
                        className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha deseada de entrega <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={desiredDate}
                    onChange={(e) => setDesiredDate(e.target.value)}
                    min={today}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modalidad de pago <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["efectivo", "transferencia"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-3 rounded-xl border text-sm font-medium capitalize transition-colors ${
                          paymentMethod === m
                            ? "text-white border-transparent"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        style={paymentMethod === m ? { backgroundColor: "#49789d" } : undefined}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Modalidad de entrega <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["retiro", "cadeteria"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDeliveryMethod(m)}
                        className={`py-3 rounded-xl border text-sm font-medium capitalize transition-colors ${
                          deliveryMethod === m
                            ? "text-white border-transparent"
                            : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                        style={deliveryMethod === m ? { backgroundColor: "#49789d" } : undefined}
                      >
                        {m === "retiro" ? "Retiro en local" : "Cadetería"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas o pedidos especiales (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Dedicatoria, sabores preferidos, indicaciones de entrega…"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  />
                </div>
              </div>

              {(localError || submitError) && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
                  {localError || submitError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft size={15} /> Volver
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={submitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                  style={{ backgroundColor: "#49789d" }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                  {submitting ? "Enviando…" : "Confirmar pedido"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Confirmation ── */}
          {step === 3 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="text-center py-8 space-y-6">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={40} className="text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">¡Pedido recibido!</h2>
                  {orderNumber && (
                    <p className="text-gray-500 mt-1">
                      Pedido N° <span className="font-bold text-gray-700">#{String(orderNumber).padStart(4, "0")}</span>
                    </p>
                  )}
                  <p className="text-gray-600 mt-3 max-w-sm mx-auto">
                    ¡Gracias por tu pedido! Nos comunicaremos a la brevedad para confirmar los detalles.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-2xl p-5 text-left max-w-sm mx-auto">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Resumen</p>
                  <div className="space-y-1.5 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Nombre</span>
                      <span className="font-medium text-gray-800">{guestFirstName} {guestLastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Teléfono</span>
                      <span className="font-medium text-gray-800">{guestPhone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ciudad</span>
                      <span className="font-medium text-gray-800">{guestCity}</span>
                    </div>
                    {guestEmail && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email</span>
                        <span className="font-medium text-gray-800 text-xs">{guestEmail}</span>
                      </div>
                    )}
                    {desiredDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Entrega</span>
                        <span className="font-medium text-gray-800">
                          {new Date(desiredDate + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pago</span>
                      <span className="font-medium text-gray-800 capitalize">{paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Entrega</span>
                      <span className="font-medium text-gray-800 capitalize">
                        {deliveryMethod === "retiro" ? "Retiro en local" : "Cadetería"}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 pt-3 space-y-1">
                    {cartEntries.map((it) => (
                      <div key={it.product_id} className="flex justify-between text-sm">
                        <span className="text-gray-600">{it.product_name} × {it.quantity}</span>
                        <span className="font-medium text-gray-800">{fmt(it.quantity * it.unit_price)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100 mt-1">
                      <span>Total</span>
                      <span style={{ color: "#49789d" }}>{fmt(total)}</span>
                    </div>
                  </div>
                  {notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notas</p>
                      <p className="text-sm text-gray-600">{notes}</p>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-400">Podés cerrar esta ventana.</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
