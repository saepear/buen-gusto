"use client";

import {
  BarChart3,
  Bike,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Home,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Package,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type Ref } from "react";
import { cerrarSesion } from "@/app/login/actions";
import gsap from "gsap";

type ItemNav = { href: string; etiqueta: string; Icono: LucideIcon };

/**
 * "WhatsApp · Pegar y armar" es una subcarpeta de Domicilios: solo se ve
 * cuando el módulo está desplegado. Al clickear el padre navega al tablero
 * y al desplegarse; el chevron alterna a mano.
 */
const NAV_ITEMS: ItemNav[] = [
  { href: "/admin", etiqueta: "Inicio", Icono: Home },
  { href: "/admin/mesas", etiqueta: "Mesas", Icono: LayoutGrid },
  { href: "/admin/domicilios", etiqueta: "Domicilios", Icono: Bike },
  { href: "/admin/menu-dia", etiqueta: "Menú del día", Icono: CalendarDays },
  { href: "/admin/productos", etiqueta: "Productos", Icono: Package },
  // Órdenes: tablero de comandas en vivo del salón
  { href: "/ordenes", etiqueta: "Órdenes", Icono: ClipboardList },
  { href: "/admin/caja", etiqueta: "Caja y recibos", Icono: Wallet },
  { href: "/admin/reportes", etiqueta: "Reportes", Icono: BarChart3 },
  { href: "/admin/configuracion", etiqueta: "Configuración", Icono: Settings },
];

export function SidebarAdmin({
  nombre,
  ref,
}: {
  nombre: string;
  ref?: Ref<HTMLElement>;
}) {
  const ruta = usePathname();

  // ¿La ruta vive dentro del módulo de domicilios (tablero, nuevo, WhatsApp)?
  const dentro = ruta.startsWith("/admin/domicilios");
  const [abierto, setAbierto] = useState(dentro);
  const [prevDentro, setPrevDentro] = useState(dentro);
  // Ajuste en render (patrón recomendado por React para estado derivado de la
  // ruta): al entrar o salir del módulo el despliegue acompaña la ruta. El
  // chevron alterna a mano mientras sigas en la misma página.
  if (dentro !== prevDentro) {
    setPrevDentro(dentro);
    setAbierto(dentro);
  }
  const alternarDomicilios = () => setAbierto(!abierto);

  // Despliegue GSAP de la subcarpeta: la altura anima 0 ↔ auto (medida por
  // GSAP), con desvanecido del contenido. Sin animación en la primera
  // hidratación: el submenú ya nace desplegado o cerrado según la ruta.
  const subcarpetaRef = useRef<HTMLDivElement>(null);
  const primerMontaje = useRef(true);
  useEffect(() => {
    const sub = subcarpetaRef.current;
    if (!sub) return;
    const primera = primerMontaje.current;
    primerMontaje.current = false;
    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (abierto) {
      gsap.set(sub, { height: "auto" });
      if (primera || reducido) return;
      gsap.from(
        sub,
        { height: 0, opacity: 0, duration: 0.45, ease: "power3.inOut", clearProps: "height" },
      );
    } else if (primera || reducido) {
      gsap.set(sub, { height: 0 });
    } else {
      gsap.to(sub, { height: 0, opacity: 0, duration: 0.38, ease: "power3.inOut", overwrite: "auto" });
    }
  }, [abierto]);

  return (
    <>
      {/* Escritorio: sidebar fijo */}
      <aside
        ref={ref}
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-borde-app/50 bg-fondo-app lg:flex"
      >
        <div className="flex items-center gap-2.5 border-b border-borde-app/50 pb-5 pl-[4.75rem] pr-3 pt-6">
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
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
              Sistema POS
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map(({ href, etiqueta, Icono }) => {
            if (href === "/admin/domicilios") {
              // Carpetilla de Domicilios: el enlace abre el tablero y el
              // chevron despliega la subcarpeta WhatsApp.
              const enTablero = ruta === href;
              const dentroModulo = ruta.startsWith(href);
              return (
                <div key={href}>
                  <div
                    className={
                      "flex items-center gap-1 rounded-xl transition " +
                      (enTablero
                        ? "bg-amber-brand text-brown-950"
                        : dentroModulo
                          ? "bg-panel-app text-texto-app"
                          : "text-texto-muted/70 hover:bg-panel-app hover:text-texto-app")
                    }
                  >
                    <Link
                      href={href}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-sm font-semibold"
                    >
                      <Icono className="h-5 w-5 shrink-0" /> {etiqueta}
                    </Link>
                    <button
                      type="button"
                      onClick={alternarDomicilios}
                      aria-label={
                        abierto
                          ? "Contraer la carpeta de domicilios"
                          : "Desplegar la carpeta de domicilios"
                      }
                      className="mr-1.5 rounded-lg p-1.5 transition hover:bg-brown-950/10"
                    >
                      <ChevronDown
                        aria-hidden
                        className={
                          "h-4 w-4 transition-transform duration-300 " +
                          (abierto ? "rotate-0" : "-rotate-90")
                        }
                      />
                    </button>
                  </div>
                  {/* Siempre montado: GSAP maneja su altura y opacidad. La clase
                      contraída existe solo para el estado de parseo (SSR), sin
                      se pelear con los estilos inline que anima GSAP */}
                  <div
                    ref={subcarpetaRef}
                    className={
                      "overflow-hidden " + (abierto ? "" : "contraido-subcarpeta")
                    }
                  >
                    <div className="mt-1 ml-8 space-y-1 border-l border-borde-app/60 pl-2.5">
                      <Link
                        href="/admin/domicilios/whatsapp"
                        className={
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition " +
                          (ruta === "/admin/domicilios/whatsapp"
                            ? "bg-panel-app text-amber-brand ring-1 ring-amber-brand/40"
                            : "text-texto-muted/60 hover:bg-panel-app hover:text-texto-app")
                        }
                      >
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" /> Pegar y armar
                      </Link>
                    </div>
                  </div>
                </div>
              );
            }

            const activo = href === "/admin" ? ruta === href : ruta.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition " +
                  (activo
                    ? "bg-amber-brand text-brown-950"
                    : "text-texto-muted/70 hover:bg-panel-app hover:text-texto-app")
                }
              >
                <Icono className="h-5 w-5 shrink-0" />
                {etiqueta}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-borde-app/50 p-3">
          <p className="px-3 pb-2 text-sm font-bold text-texto-app">{nombre}</p>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-texto-muted/70 transition hover:bg-danger/15 hover:text-danger-text"
            >
              <LogOut className="h-5 w-5" /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Móvil: barra superior + navegación horizontal */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-borde-app/50 bg-fondo-app/80 px-4 pb-3 cabeza-seguro backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Logo" width={38} height={38} unoptimized />
          <strong className="font-display text-amber-brand">El Buen Gusto</strong>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="rounded-lg p-2 text-texto-muted/70 transition hover:text-danger-text"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </header>
      {/* En móvil es una tira plana: la bandeja solo aparece dentro del módulo,
          igual que en el escritorio como subcarpeta */}
      <nav className="flex gap-1 overflow-x-auto border-b border-borde-app/50 bg-fondo-app px-2 py-2 lg:hidden">
        {NAV_ITEMS.map(({ href, etiqueta, Icono }) => {
          const activo = href === "/admin" ? ruta === href : ruta.startsWith(href);
          return (
            <Fragment key={href}>
              <Link
                href={href}
                className={
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                  (activo
                    ? "bg-amber-brand text-brown-950"
                    : "text-texto-muted/70 hover:bg-panel-app hover:text-texto-app")
                }
              >
                <Icono className="h-4 w-4" /> {etiqueta}
              </Link>
              {href === "/admin/domicilios" && dentro ? (
                <Link
                  href="/admin/domicilios/whatsapp"
                  className={
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition " +
                    (ruta === "/admin/domicilios/whatsapp"
                      ? "bg-amber-brand text-brown-950"
                      : "text-texto-muted/70 hover:bg-panel-app hover:text-texto-app")
                  }
                >
                  <MessageCircle className="h-4 w-4" /> Pegar y armar
                </Link>
              ) : null}
            </Fragment>
          );
        })}
      </nav>
    </>
  );
}
