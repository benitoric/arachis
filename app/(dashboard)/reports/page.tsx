import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-2xl bg-cream flex items-center justify-center mb-6">
        <BarChart3 size={36} className="text-gold" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Reportes</h1>
      <p className="text-gray-400 text-sm">Próximamente</p>
    </div>
  );
}
