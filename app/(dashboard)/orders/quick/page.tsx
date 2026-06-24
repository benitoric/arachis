import QuickSaleForm from "@/components/orders/QuickSaleForm";

export default function QuickSalePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Venta rápida</h1>
        <p className="text-gray-500 mt-0.5">Venta en el momento: entrega inmediata, cobro ahora o pendiente</p>
      </div>
      <QuickSaleForm />
    </div>
  );
}
