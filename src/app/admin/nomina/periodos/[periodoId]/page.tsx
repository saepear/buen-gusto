// ═════════ Nómina · Detalle del período ═════════
// Liquidar a cada empleado (borrador), aprobar y cerrar. Una liquidación
// APROBADA no se recalcula: es foto. Los pagos viven en la liquidación.
import Link from "next/link";
import { ChevronRight, RefreshCw } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { pendienteDeLiquidacion } from "@/lib/nomina/helpers";
import { NavegacionNomina } from "../../navegacion";
import {
  BotonAbrirPeriodo,
  BotonAprobarLiquidacion,
  BotonCerrarPeriodo,
  BotonLiquidarEmpleado,
} from "../formularios";

export const metadata = { title: "Período · Nómina · El Buen Gusto" };

export default async function PaginaDetallePeriodo(
  props: PageProps<"/admin/nomina/periodos/[periodoId]">,
) {
  await requerirRol("ADMIN");
  const { periodoId } = await props.params;
  const id = Number.parseInt(periodoId, 10);
  if (!Number.isInteger(id)) {
    return <p className="p-8 text-center text-sm text-danger-text">Período inválido.</p>;
  }

  const periodo = await db.periodoNomina.findUnique({
    where: { id },
    include: {
      liquidaciones: { include: { empleado: true } },
    },
  });
  if (!periodo) {
    return <p className="p-8 text-center text-sm text-danger-text">No existe ese período.</p>;
  }

  // Empleados que corresponden al período: activos, ingresados antes de su
  // fin, sin retiro antes del inicio.
  const desde = new Date(`${periodo.fechaDesde}T12:00:00.000Z`);
  const hasta = new Date(`${periodo.fechaHasta}T12:00:00.000Z`);
  const candidatos = await db.empleado.findMany({
    where: {
      fechaIngreso: { lte: hasta },
      OR: [{ fechaRetiro: null }, { fechaRetiro: { gte: desde } }],
    },
    orderBy: { apellidos: "asc" },
  });

  const liquidadoPor = new Map(periodo.liquidaciones.map((l) => [l.empleadoId, l]));
  const totalDevengado = periodo.liquidaciones.reduce((s, l) => s + l.totalDevengado, 0);
  const totalNeto = periodo.liquidaciones.reduce((s, l) => s + l.netoAPagar, 0);
  const totalPagado = periodo.liquidaciones.reduce((s, l) => s + l.pagado, 0);
  const costoEmpleador = periodo.liquidaciones.reduce((s, l) => s + l.costoEmpleador, 0);

  return (
    <>
      <EncabezadoPagina
        titulo={`Período ${periodo.fechaDesde} → ${periodo.fechaHasta}`}
        subtitulo={`${periodo.tipo === "MENSUAL" ? "Mensual" : "Quincenal"} · ${periodo.estado}${periodo.fechaPagoPrevista ? ` · pago previsto ${periodo.fechaPagoPrevista}` : ""}`}
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/periodos" />
      </div>

      {/* Totales */}
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Pago base + extras
          </p>
          <p className="font-display text-2xl text-texto-app">{formatCOP(totalDevengado)}</p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Neto a pagar
          </p>
          <p className="font-display text-2xl text-amber-brand">{formatCOP(totalNeto)}</p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Pagado
          </p>
          <p className="font-display text-2xl text-success-text">{formatCOP(totalPagado)}</p>
          <p className="text-[11px] text-texto-muted/55">
            pendiente {formatCOP(totalNeto - totalPagado)}
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Costo empleador (aportes)
          </p>
          <p className="font-display text-2xl text-info-text">{formatCOP(costoEmpleador)}</p>
          <p className="text-[11px] text-texto-muted/55">
            informativo: no descuenta del neto
          </p>
        </div>
      </div>

      {/* Acciones del período */}
      <div className="mb-6 space-y-3">
        {periodo.estado === "ABIERTO" ? (
          <BotonCerrarPeriodo periodoId={periodo.id} />
        ) : (
          <BotonAbrirPeriodo periodoId={periodo.id} />
        )}
      </div>

      <h2 className="mb-3 font-display text-xl text-texto-app">
        Empleados del período
      </h2>

      <div className="space-y-2">
        {candidatos.map((e) => {
          const liq = liquidadoPor.get(e.id);
          return (
            <article key={e.id} className="rounded-2xl bg-panel-app p-3.5 ring-1 ring-borde-app">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-texto-app">
                    {e.nombre} {e.apellidos}{" "}
                    {e.estado === "INACTIVO" ? (
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger-text ring-1 ring-danger/20">
                        inactivo
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-texto-muted/60">
                    {liq
                      ? `${liq.estado} · neto ${formatCOP(liq.netoAPagar)} · pagado ${formatCOP(liq.pagado)}`
                      : "sin liquidar en este período"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {liq ? (
                    <>
                      <span
                        className={
                          "font-display text-lg " +
                          (pendienteDeLiquidacion(liq) > 0 ? "text-amber-brand" : "text-success-text")
                        }
                      >
                        {pendienteDeLiquidacion(liq) > 0
                          ? `${formatCOP(pendienteDeLiquidacion(liq))} por pagar`
                          : "pagada"}
                      </span>
                      {liq.estado === "BORRADOR" && periodo.estado === "ABIERTO" ? (
                        <BotonAprobarLiquidacion liquidacionId={liq.id} nombre={e.nombre} />
                      ) : null}
                      <Link
                        href={`/admin/nomina/pagos/${liq.id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-fondo-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app hover:bg-panel-hover"
                      >
                        Desglose <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  ) : null}
                  {periodo.estado === "ABIERTO" &&
                  (liq === undefined || liq.estado === "BORRADOR") ? (
                    <BotonLiquidarEmpleado periodoId={periodo.id} empleadoId={e.id} nombre={e.nombre} />
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {candidatos.length === 0 ? (
        <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-8 text-center">
          <RefreshCw className="h-8 w-8 text-texto-muted/40" />
          <p className="mt-3 font-display text-lg text-texto-app">
            No hay empleados que correspondan a este período
          </p>
        </div>
      ) : null}
    </>
  );
}
