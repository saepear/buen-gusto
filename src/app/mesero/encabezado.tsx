import { ArrowLeft, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cerrarSesion } from "@/app/login/actions";

/**
 * Encabezado táctil del mesero: barra oscura con esquinas suaves.
 * Con `volver` muestra una píldora de regreso y el título al centro.
 */
export function EncabezadoMesero({
  usuario,
  titulo,
  volver,
}: {
  usuario: string;
  /** Título central (opcional: en el inicio el logo ya lo dice) */
  titulo?: string;
  volver?: { href: string; texto: string };
}) {
  return (
    <header className="sticky top-0 z-30 rounded-b-[1.75rem] border-b border-white/5 bg-fondo-kds/80 px-4 pb-3.5 cabeza-seguro shadow-flotante backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg sm:max-w-2xl items-center justify-between gap-3">
        {volver ? (
          <Link
            href={volver.href}
            className="flex items-center gap-1.5 rounded-full bg-white/5 ring-1 ring-white/10 px-3.5 py-2.5 text-xs font-bold text-cream-100 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {volver.texto}
          </Link>
        ) : (
          <Link href="/mesero" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-brand/15 ring-1 ring-amber-brand/30">
              <Image src="/logo.png" alt="El Buen Gusto" width={26} height={26} unoptimized />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm leading-none text-amber-brand">
                El Buen Gusto
              </span>
              <span className="mt-1 block truncate text-[11px] text-cream-200/70">
                Mesero · {usuario}
              </span>
            </span>
          </Link>
        )}

        {titulo ? (
          <p className="min-w-0 flex-1 truncate text-center font-display text-lg text-cream-100">
            {titulo}
          </p>
        ) : (
          <span className="flex-1" />
        )}

        <form action={cerrarSesion}>
          <button
            type="submit"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 text-cream-100 transition hover:bg-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
