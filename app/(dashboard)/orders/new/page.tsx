import OrderForm from "@/components/orders/OrderForm";

export default function NewOrderPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo pedido</h1>
        <p className="text-gray-500 mt-0.5">Carga manual de pedido</p>
      </div>
      <OrderForm />
    </div>
  );
}
