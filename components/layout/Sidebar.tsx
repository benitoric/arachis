"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePortalCount } from "@/contexts/PortalCountContext";
import ThemeToggle from "@/components/layout/ThemeToggle";
import {
  LayoutDashboard,
  Users,
  ShoppingBag,
  ShoppingCart,
  Package,
  FlaskConical,
  BarChart3,
  BarChart2,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  Warehouse,
  DollarSign,
  Box,
  Calculator,
  Layers,
  Receipt,
  ClipboardList,
  Megaphone,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",        href: "/",                   icon: LayoutDashboard },
  { label: "Pedidos",          href: "/orders",             icon: ShoppingBag,    badge: true },
  { label: "Clientes",         href: "/clients",            icon: Users           },
  { label: "Artículos y Recetas", href: "/products",        icon: Box             },
  { label: "Insumos",          href: "/materials",          icon: Package         },
  { label: "Costos y Precios", href: "/costs",              icon: Calculator      },
  { label: "Presupuestos",     href: "/quotes",             icon: ClipboardList   },
  { label: "Promociones",      href: "/promos",             icon: Megaphone       },
  { label: "Compras",          href: "/purchases",          icon: ShoppingCart    },
  { label: "Producción",       href: "/production",         icon: FlaskConical    },
  { label: "Stock",            href: "/stock",              icon: Layers          },
  { label: "Inventario",       href: "/inventory",          icon: Warehouse       },
  { label: "Finanzas",         href: "/finances",           icon: DollarSign      },
  { label: "Estadísticas",     href: "/rankings",           icon: BarChart2       },
  { label: "Gastos",           href: "/expenses",           icon: Receipt         },
  { label: "Reportes",         href: "/reports",            icon: BarChart3       },
  { label: "Notificaciones",   href: "/notifications",      icon: Bell            },
  { label: "Configuración",    href: "/settings",           icon: Settings        },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { portalCount } = usePortalCount();
  const [open, setOpen] = useState(false);

  // Cerrar sidebar al navegar (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Bloquear scroll del body cuando el sidebar está abierto en mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Botón hamburguesa — solo mobile */}
      <button
        className="lg:hidden fixed top-3 left-3 z-50 w-10 h-10 flex items-center justify-center rounded-xl shadow-lg text-white"
        style={{ backgroundColor: "#1a1b1f" }}
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Overlay oscuro — solo mobile cuando está abierto */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-56 flex flex-col z-40 shadow-xl transition-transform duration-300
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        style={{ backgroundColor: "#1a1b1f" }}
      >
        {/* Logo + botón cerrar (mobile) */}
        <div className="flex items-center justify-between px-4 py-6 border-b border-white/10">
          <Image
            src="/logo.png"
            alt="Arachis"
            width={180}
            height={180}
            style={{ height: "7rem", width: "auto" }}
            className="object-contain"
            priority
          />
          <button
            className="lg:hidden text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              const showBadge = "badge" in item && item.badge && portalCount > 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-150 group
                      ${
                        active
                          ? "text-ink shadow-sm"
                          : "text-white/60 hover:text-white hover:bg-white/10"
                      }
                    `}
                    style={active ? { backgroundColor: "#F0B838" } : undefined}
                  >
                    <Icon
                      size={18}
                      className={`flex-shrink-0 ${
                        active ? "text-ink" : "text-white/40 group-hover:text-white"
                      }`}
                    />
                    <span className="flex-1">{item.label}</span>
                    {showBadge && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {portalCount > 99 ? "99+" : portalCount}
                      </span>
                    )}
                    {active && !showBadge && (
                      <ChevronRight size={14} className="text-ink/60" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Theme + Logout */}
        <div className="p-3 border-t border-white/10 space-y-0.5">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-all duration-150"
          >
            <LogOut size={18} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
