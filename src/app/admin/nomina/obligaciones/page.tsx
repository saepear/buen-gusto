// ═════════ Nómina · Obligaciones laborales ═════════
// Prestaciones por empleado: causado (ferretas de las liquidaciones),
// pagado (pagoPrestacion) y PENDIENTE — lo calculado no significa pagado.
import { Landmark } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";
import { FormularioPagoPrestacion } from "./formularios";

export const metadata = { title: "Obligaciones laborales · Nómina · El Buen Gusto" };

const CONCEPTO_LABEL: Record<string, string> = {
  PRIMA: "Prima de servicios",
  CESANTIAS: "Cesantías",
  INTERESES_CESANTIAS: "Intereses a las cesantías",
  VACACIONES: "Vacaciones",
};

export default async function PaginaObligaciones() {
  await requerirRol("ADMIN");

  const [empleados, causado, pagado] = await Promise.all([
    db.empleado.findMany({ orderBy: [{ estado: "asc" }, { apellidos: "asc" }] }),
    db.liquidacionNomina.groupBy({
      by: ["empleadoId"],
      _sum: {
        prestacionPrima: true,
        prestacionCesantias: true,
        prestacionIntereses: true,
        prestacionVacaciones: true,
      },
    }),
    db.pagoPrestacion.groupBy({
      by: ["empleadoId", "concepto"],
      _sum: { monto: true },
    }),
  ]);

  const causadoPor = Object.fromEntries(causado.map((c) => [c.empleadoId, c._sum]));
  const pagadoPor = new Map<string, number>();
  for (const p of pagado) {
    pagadoPor.set(`${p.empleadoId}_${p.concepto}`, p._sum.monto ?? 0);
  }

  const CONCEPTOS = ["PRIMA", "CESANTIAS", "INTERESES_CESANTIAS", "VACACIONES"] as const;
  const CAMPOS = {
    PRIMA: "prestacionPrima",
    CESANTIAS: "prestacionCesantias",
    INTERESES_CESANTIAS: "prestacionIntereses",
    VACACIONES: "prestacionVacaciones",
  } as const;

  return (
    <>
      <EncabezadoPagina
        titulo="Obligaciones laborales"
        subtitulo="Prima, cesantías, intereses y vacaciones: causado ≠ pagado ≠ pendiente. Lo calculado NO se paga solo."
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/obligaciones" />
      </div>

      {empleados.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <Landmark className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">Sin empleados aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {empleados.map((e) => {
            const sumas = causadoPor[e.id] ?? {
              prestacionPrima: 0,
              prestacionCesantias: 0,
              prestacionIntereses: 0,
              prestacionVacaciones: 0,
            };
            const filas = CONCEPTOS.map((c) => {
              const causadoValor = sumas[CAMPOS[c]] ?? 0;
              const pagadoValor = pagadoPor.get(`${e.id}_${c}`) ?? 0;
              return { concepto: c, causado: causadoValor, pagado: pagadoValor, pendiente: Math.max(causadoValor - pagadoValor, 0) };
            });
            const totalPendiente = filas.reduce((s, f) => s + f.pendiente, 0);

            return (
              <article key={e.id} className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg text-texto-app">
                    {e.nombre} {e.apellidos}
                    {e.estado === "INACTIVO" ? (
                      <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger-text ring-1 ring-danger/20">
                        inactivo
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-sm font-bold text-amber-brand">
                    Pendiente total: {formatCOP(totalPendiente)}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-texto-muted/55">
                        <th className="py-1">Concepto</th>
                        <th className="py-1 text-right">Causado</th>
                        <th className="py-1 text-right">Pagado</th>
                        <th className="py-1 text-right">Pendiente</th>
                        <th className="py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((f) => (
                        <tr key={f.concepto} className="border-t border-borde-app/40">
                          <td className="py-1.5 text-texto-app">{CONCEPTO_LABEL[f.concepto]}</td>
                          <td className="py-1.5 text-right text-texto-muted/80">{formatCOP(f.causado)}</td>
                          <td className="py-1.5 text-right text-success-text">{formatCOP(f.pagado)}</td>
                          <td className={"py-1.5 text-right font-bold " + (f.pendiente > 0 ? "text-amber-brand" : "text-texto-muted/60")}>
                            {formatCOP(f.pendiente)}
                          </td>
                          <td className="py-1.5 pl-2">
                            {f.pendiente > 0 ? (
                              <FormularioPagoPrestacion
                                empleadoId={e.id}
                                nombre={`${e.nombre} ${e.apellidos}`}
                                concepto={f.concepto}
                                pendiente={f.pendiente}
                              />
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
