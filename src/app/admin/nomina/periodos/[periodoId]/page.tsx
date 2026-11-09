// ═════════ Nómina · Detalle del período ═════════
// Consulta del corte y control de apertura/cierre. El pago se registra desde
// la ficha de Pagos, sin una aprobación intermedia.
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../../navegacion";
import {
  BotonAbrirPeriodo,
  BotonCerrarPeriodo,
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

  const totalDevengado = periodo.liquidaciones.reduce((s, l) => s + l.totalDevengado, 0);
  const totalNeto = periodo.liquidaciones.reduce((s, l) => s + l.netoAPagar, 0);
  const totalPagado = periodo.liquidaciones.reduce((s, l) => s + l.pagado, 0);

  return (
    <>
      <EncabezadoPagina
        titulo={`Período ${periodo.fechaDesde} → ${periodo.fechaHasta}`}
        subtitulo={`${periodo.tipo === "CICLOS" ? "Pago semanal" : periodo.tipo === "MENSUAL" ? "Mensual" : "Quincenal"} · ${periodo.estado}${periodo.fechaPagoPrevista ? ` · pago previsto ${periodo.fechaPagoPrevista}` : ""}`}
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/periodos" />
      </div>

      {/* Totales */}
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
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
      </div>

      {/* Acciones del período */}
      <div className="mb-6 space-y-3">
        {periodo.estado === "ABIERTO" ? (
          <BotonCerrarPeriodo periodoId={periodo.id} />
        ) : (
          <BotonAbrirPeriodo periodoId={periodo.id} />
        )}
      </div>

      <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-8 text-center">
        <RefreshCw className="h-8 w-8 text-texto-muted/40" />
        <p className="mt-3 font-display text-lg text-texto-app">El pago se gestiona desde Pagos</p>
        <p className="mt-1 max-w-md text-sm text-texto-muted">Abre Nómina → Pagos para elegir un empleado, revisar su corte y registrar la entrega directamente.</p>
        <Link href="/admin/nomina/pagos" className="mt-4 rounded-xl bg-amber-brand px-4 py-2.5 text-sm font-bold text-brown-950">Ir a pagos</Link>
      </div>
    </>
  );
}
