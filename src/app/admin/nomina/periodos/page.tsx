// ═════════ Nómina · Períodos ═════════
import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";
import { FormularioCrearPeriodo } from "./formularios";
import { TIPO_PERIODO_LABEL } from "@/lib/nomina/helpers";

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

      <div className="mb-6">
        <FormularioCrearPeriodo />
      </div>

      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-texto-app">
        <CalendarRange className="h-5 w-5 text-amber-brand" /> Períodos ({periodos.length})
      </h2>

      {periodos.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <CalendarRange className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">Aún no hay períodos</p>
          <p className="mt-1.5 max-w-md text-sm text-texto-muted/70">
            Crea un ciclo de pago: luego pagas a cada empleado desde el módulo de Pagos.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {periodos.map((p) => {
            const t = totalesPor[p.id];
            const neto = t?._sum.netoAPagar ?? 0;
            const pagado = t?._sum.pagado ?? 0;
            return (
              <Link
                key={p.id}
                href={`/admin/nomina/periodos/${p.id}`}
                className="block rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app transition hover:bg-panel-hover"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-texto-app">
                      {p.fechaDesde} → {p.fechaHasta}{" "}
                      <span className="text-xs font-normal text-texto-muted/60">
                        ({TIPO_PERIODO_LABEL[p.tipo] ?? p.tipo})
                      </span>
                    </p>
                    <p className="text-[11px] text-texto-muted/60">
                      {p._count.liquidaciones} liquidaciones · devengado{" "}
                      {formatCOP(t?._sum.totalDevengado ?? 0)} · neto {formatCOP(neto)} ·
                      pagado {formatCOP(pagado)}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-xs font-bold ring-1 " +
                      (p.estado === "ABIERTO"
                        ? "bg-warning/10 text-warning-text ring-warning/20"
                        : "bg-success/10 text-success-text ring-success/20")
                    }
                  >
                    {p.estado}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
