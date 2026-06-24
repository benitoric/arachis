"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, BookOpen, Loader2 } from "lucide-react";
import type { Database } from "@/lib/types/database";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface ProductWithCount extends Product {
  ingredient_count: number;
}

export default function RecipesPage() {
  const [products, setProducts] = useState<ProductWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: prods } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("name");

      if (!prods || prods.length === 0) {
        setLoading(false);
        return;
      }

      const productIds = prods.map((p) => p.id);
      const { data: recipes } = await supabase
        .from("recipes")
        .select("product_id")
        .in("product_id", productIds);

      const countMap: Record<string, number> = {};
      (recipes ?? []).forEach((r) => {
        countMap[r.product_id] = (countMap[r.product_id] ?? 0) + 1;
      });

      setProducts(
        prods.map((p) => ({ ...p, ingredient_count: countMap[p.id] ?? 0 }))
      );
      setLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recetas</h1>
        <p className="text-gray-500 mt-0.5">Definí los ingredientes de cada artículo</p>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-gold" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-cream flex items-center justify-center mb-4">
              <BookOpen size={24} className="text-gold" />
            </div>
            <p className="text-gray-500 font-medium">No hay artículos activos</p>
            <p className="text-sm text-gray-400 mt-1">
              <Link href="/products" className="text-chocolate hover:underline">
                Creá un artículo primero
              </Link>
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/recipes/${product.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 group-hover:text-chocolate transition-colors">
                      {product.name}
                    </p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {product.ingredient_count === 0
                        ? "Sin ingredientes definidos"
                        : `${product.ingredient_count} ingrediente${product.ingredient_count !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.ingredient_count > 0
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {product.ingredient_count > 0 ? "Completa" : "Pendiente"}
                  </span>
                  <ChevronRight
                    size={16}
                    className="flex-shrink-0 text-gray-300 group-hover:text-chocolate transition-colors"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
