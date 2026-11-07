// Navegación compartida de las pantallas de Nómina + chips de estado
import Link from "next/link";

const SECCIONES = [
  { href: "/admin/nomina/empleados", etiqueta: "Empleados" },
  { href: "/admin/nomina/asistencia", etiqueta: "Asistencia" },
  { href: "/admin/nomina/novedades", etiqueta: "Novedades" },
  { href: "/admin/nomina/periodos", etiqueta: "Períodos y liquidaciones" },
  { href: "/admin/nomina/obligaciones", etiqueta: "Obligaciones" },
  { href: "/admin/nomina/reportes", etiqueta: "Reportes" },
  { href: "/admin/nomina/parametros", etiqueta: "Parámetros" },
];

export function NavegacionNomina({ actual }: { actual: string }) {
  return (
    <nav
      aria-label="Secciones de nómina"
      className="mb-6 flex flex-wrap gap-2"
    >
      {SECCIONES.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.href === actual ? "page" : undefined}
          className={
            "rounded-xl px-3.5 py-2 text-sm font-bold ring-1 transition " +
            (s.href === actual
              ? "bg-amber-brand text-brown-950 ring-amber-brand"
              : "bg-panel-app text-texto-app ring-borde-app hover:bg-panel-hover")
          }
        >
          {s.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
