// ═════════ Nómina · Panel general ═════════
// Foto del estado del personal y del pendiente de pago. Cada carta lleva
// a su sección con la navegación compartida.
import { UserRound } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "./navegacion";

export const metadata = { title: "Nómina · El Buen Gusto" };

export default async function PaginaNomina() {
  await requerirRol("ADMIN");

  const [activos, inactivos, periodosAbiertos, pendientes, prestaciones] = await Promise.all([
    db.empleado.count({ where: { estado: "ACTIVO" } }),
    db.empleado.count({ where: { estado: "INACTIVO" } }),
    db.periodoNomina.findMany({ where: { estado: "ABIERTO" }, orderBy: { fechaDesde: "desc" }, take: 3, include: { _count: { select: { liquidaciones: true } } } }),
    db.liquidacionNomina.aggregate({
      where: { estado: "APROBADA", estadoPago: { not: "PAGADO" } },
      _sum: { netoAPagar: true, pagado: true },
    }),
    db.liquidacionNomina.aggregate({
      _sum: {
        prestacionPrima: true,
        prestacionCesantias: true,
        prestacionIntereses: true,
        prestacionVacaciones: true,
      },
    }),
  ]);

  // Prestaciones pagadas (por concepto) para mostrar el pendiente real
  const pagosPrestaciones = await db.pagoPrestacion.groupBy({
    by: ["concepto"],
    _sum: { monto: true },
  });
  const pagadoPor = Object.fromEntries(
    pagosPrestaciones.map((p) => [p.concepto, p._sum.monto ?? 0]),
  );

  const totalCausado =
    (prestaciones._sum.prestacionPrima ?? 0) +
    (prestaciones._sum.prestacionCesantias ?? 0) +
    (prestaciones._sum.prestacionIntereses ?? 0) +
    (prestaciones._sum.prestacionVacaciones ?? 0);
  const totalPagadoPrestaciones = pagosPrestaciones.reduce((s, p) => s + (p._sum.monto ?? 0), 0);
  const pendientePrestaciones = totalCausado - totalPagadoPrestaciones;

  const netoPendiente =
    Math.max((pendientes._sum.netoAPagar ?? 0) - (pendientes._sum.pagado ?? 0), 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Nómina"
        subtitulo="Quién trabaja, cuánto debe recibir, cómo se calculó y qué se ha pagado"
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina" />
      </div>

      {/* Resumen */}
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Personal
          </p>
          <p className="font-display text-2xl text-texto-app">
            {activos} activos
            {inactivos > 0 ? ` · ${inactivos} inactivos` : ""}
          </p>
          <p className="text-[11px] text-texto-muted/55">
            El historial se conserva aunque se desactive
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Neto por pagar (aprobado)
          </p>
          <p className="font-display text-2xl text-amber-brand">
            {formatCOP(netoPendiente)}
          </p>
          <p className="text-[11px] text-texto-muted/55">
            Los períodos abiertos aún no tocan caja
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Prestaciones causadas
          </p>
          <p className="font-display text-2xl text-info-text">
            {formatCOP(pendientePrestaciones)}
          </p>
          <p className="text-[11px] text-texto-muted/55">
            prima · cesantías · intereses · vacaciones
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Períodos abiertos
          </p>
          <p className="font-display text-2xl text-texto-app">
            {periodosAbiertos.length}
          </p>
          {periodosAbiertos.map((p) => (
            <p key={p.id} className="text-[11px] text-texto-muted/55">
              {p.fechaDesde} → {p.fechaHasta} ({p._count.liquidaciones} liqu.)
            </p>
          ))}
        </div>
      </div>

      {/* Qué se hace aquí */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {[
          {
            href: "/admin/nomina/empleados",
            titulo: "Empleados",
            texto: "Registrar personal, cambiar salarios con historial de contrato, desactivar y consultar fichas.",
          },
          {
            href: "/admin/nomina/asistencia",
            titulo: "Asistencia",
            texto: "Jornadas con entrada/salida y descanso: el sistema clasifica ordinarias, nocturnas, festivos y extras.",
          },
          {
            href: "/admin/nomina/novedades",
            titulo: "Novedades",
            texto: "Comisiones, bonos, ausencias, permisos, incapacidades, vacaciones y descuentos (se aprueban para liquidar).",
          },
          {
            href: "/admin/nomina/periodos",
            titulo: "Períodos y liquidaciones",
            texto: "Crear quincena o mes, liquidar, aprobar y cerrar: cada liquidación queda congelada con su foto.",
          },
          {
            href: "/admin/nomina/obligaciones",
            titulo: "Obligaciones",
            texto: "Prima, cesantías, intereses y vacaciones: causado, pagado y pendiente por empleado.",
          },
          {
            href: "/admin/nomina/reportes",
            titulo: "Reportes",
            texto: "Nómina por período o empleado, pagos y aportes con exportación a Excel.",
          },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app transition hover:bg-panel-hover"
          >
            <p className="font-display text-lg text-texto-app">{c.titulo}</p>
            <p className="mt-1 text-sm text-texto-muted/70">{c.texto}</p>
          </Link>
        ))}
      </div>

      {activos === 0 ? (
        <div className="mt-8 flex min-h-[180px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-8 text-center">
          <UserRound className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">
            Aún no hay empleados registrados
          </p>
          <p className="mt-1.5 max-w-md text-sm text-texto-muted/70">
            Empieza en «Empleados»: registra a tu personal con su contrato
            inicial y la información de seguridad social.
          </p>
        </div>
      ) : null}
    </>
  );
}
