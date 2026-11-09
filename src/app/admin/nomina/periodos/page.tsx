// ═════════ Nómina · Períodos ═════════
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";
import { TIPO_PERIODO_LABEL } from "@/lib/nomina/helpers";
import { PanelPeriodos } from "./panel-periodos";

export const metadata = { title: "Períodos · Nómina · El Buen Gusto" };

export default async function PaginaPeriodos() {
  await requerirRol("ADMIN");

  const periodos = await db.periodoNomina.findMany({
    orderBy: { fechaDesde: "desc" },
    take: 40,
    include: { _count: { select: { liquidaciones: true } } },
  });

  const totales = await db.liquidacionNomina.groupBy({
    by: ["periodoId"],
    _sum: { netoAPagar: true, pagado: true, totalDevengado: true },
    _count: { id: true },
  });
  const totalesPor = Object.fromEntries(totales.map((t) => [t.periodoId, t]));

  return (
    <>
      <EncabezadoPagina
        titulo="Ciclos de pago"
        subtitulo="Cortes del 7, 14, 21 y fin de mes: preparar y pagar al equipo"
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/periodos" />
      </div>

      <PanelPeriodos periodos={periodos.map(p => { const t = totalesPor[p.id]; return { id:p.id, desde:p.fechaDesde, hasta:p.fechaHasta, fechaPago:p.fechaPagoPrevista, tipo:p.tipo, etiqueta:TIPO_PERIODO_LABEL[p.tipo] ?? p.tipo, estado:p.estado, empleados:p._count.liquidaciones, devengado:t?._sum.totalDevengado ?? 0, neto:t?._sum.netoAPagar ?? 0, pagado:t?._sum.pagado ?? 0 }; })} />
    </>
  );
}
