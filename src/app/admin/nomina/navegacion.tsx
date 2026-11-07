// Navegación compartida de las pantallas de Nómina + chips de estado
import Link from "next/link";
import { LayoutDashboard, UsersRound, Ticket, ClipboardList, CalendarDays, Banknote, Settings2 } from "lucide-react";

const SECCIONES = [
  { href: "/admin/nomina", etiqueta: "Resumen", icono: LayoutDashboard },
  { href: "/admin/nomina/empleados", etiqueta: "Empleados", icono: UsersRound },
  { href: "/admin/nomina/vales", etiqueta: "Vales y consumos", icono: Ticket },
  { href: "/admin/nomina/novedades", etiqueta: "Novedades", icono: ClipboardList },
  { href: "/admin/nomina/periodos", etiqueta: "Ciclos de pago", icono: CalendarDays },
  { href: "/admin/nomina/pagos", etiqueta: "Pagos", icono: Banknote },
  { href: "/admin/nomina/configuracion", etiqueta: "Configuración", icono: Settings2 },
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
            "inline-flex items-center gap-2 rounded-full px-3.5 py-2.5 text-xs font-bold ring-1 transition " +
            (s.href === actual
              ? "bg-amber-brand text-brown-950 ring-amber-brand"
              : "bg-panel-app text-texto-app ring-borde-app hover:bg-panel-hover")
          }
        >
          <s.icono className="h-4 w-4" aria-hidden="true" />{s.etiqueta}
        </Link>
      ))}
    </nav>
  );
}
