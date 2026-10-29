"use client";

import {
  BarChart3,
  CalendarDays,
  ChefHat,
  Home,
  LayoutGrid,
  LogOut,
  Package,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/app/login/actions";

const NAV: { href: string; etiqueta: string; Icono: LucideIcon }[] = [
  { href: "/admin", etiqueta: "Inicio", Icono: Home },
  { href: "/admin/mesas", etiqueta: "Mesas", Icono: LayoutGrid },
  { href: "/admin/menu-dia", etiqueta: "Menú del día", Icono: CalendarDays },
  { href: "/admin/productos", etiqueta: "Productos", Icono: Package },
  // El admin ve el KDS de cocina en modo seguimiento (solo lectura)
  { href: "/cocina", etiqueta: "Cocina (en vivo)", Icono: ChefHat },
  { href: "/admin/caja", etiqueta: "Caja y recibos", Icono: Wallet },
  { href: "/admin/reportes", etiqueta: "Reportes", Icono: BarChart3 },
  { href: "/admin/configuracion", etiqueta: "Configuración", Icono: Settings },
];

export function SidebarAdmin({ nombre }: { nombre: string }) {
  const ruta = usePathname();

  return (
    <>
      {/* Escritorio: sidebar fijo */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/5 bg-fondo-kds lg:flex">
        <div className="flex items-center gap-3 px-5 pb-4 pt-6">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 rounded-full bg-amber-brand/20 blur-sm"></div>
            <Image
              src="/logo.png"
              alt="El Buen Gusto"
              width={48}
              height={48}
              unoptimized
              priority
              className="relative rounded-full"
            />
          </div>
          <div>
            <p className="font-display text-lg leading-tight text-amber-brand">
              El Buen Gusto
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
              Sistema POS
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV.map(({ href, etiqueta, Icono }) => {
            const activo =
              href === "/admin" ? ruta === href : ruta.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition " +
                  (activo
                    ? "bg-amber-brand text-brown-950"
                    : "text-cream-200/70 hover:bg-white/5 hover:text-white")
                }
              >
                <Icono className="h-5 w-5 shrink-0" />
                {etiqueta}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-3">
          <p className="px-3 pb-2 text-sm font-bold text-cream-100">{nombre}</p>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-cream-200/70 transition hover:bg-danger/15 hover:text-danger"
            >
              <LogOut className="h-5 w-5" /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Móvil: barra superior + navegación horizontal */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-fondo-kds/80 px-4 pb-3 cabeza-seguro backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Logo" width={38} height={38} unoptimized />
          <strong className="font-display text-amber-brand">El Buen Gusto</strong>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="rounded-lg p-2 text-cream-200/70 transition hover:text-danger"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-white/5 bg-fondo-kds px-2 py-2 lg:hidden">
        {NAV.map(({ href, etiqueta, Icono }) => {
          const activo =
            href === "/admin" ? ruta === href : ruta.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={
                "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                (activo
                  ? "bg-amber-brand text-brown-950"
                  : "text-cream-200/70 hover:bg-white/5 hover:text-white")
              }
            >
              <Icono className="h-4 w-4" /> {etiqueta}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
