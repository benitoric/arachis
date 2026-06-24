import QuoteForm from "@/components/quotes/QuoteForm";

export default function NewQuotePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo presupuesto</h1>
        <p className="text-gray-500 mt-0.5">Mesa dulce / evento</p>
      </div>
      <QuoteForm />
    </div>
  );
}
