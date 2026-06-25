"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle. The initial class is applied pre-paint by the inline
 * script in app/layout.tsx; this component keeps it in sync and persists the
 * choice to localStorage.
 */
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore storage errors */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-snow/50 hover:text-snow hover:bg-snow/10 transition-all duration-150"
    >
      {/* Render a stable icon until mounted to avoid hydration mismatch */}
      {mounted && dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{mounted && dark ? "Modo claro" : "Modo oscuro"}</span>
    </button>
  );
}
