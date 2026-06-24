import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-app-bg">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-chocolate mb-4">404</h1>
        <p className="text-gray-500 mb-6">La página que buscás no existe.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-chocolate hover:bg-dark-red text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
