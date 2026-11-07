// ═════════ Nómina · Reportes ═════════
// Consulta por rango y empleado: nómina, deducciones, aportes, prestaciones,
// pagos y asistencia. La MISMA consulta alimenta el Excel (no duplicada:
// se resuelve en `datos-reporte.ts` y aquí solo se pinta).
import { BarChart3, Download } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { requerirRol } from "@/lib/session";
import { formatCOP } from "@/lib/format";
import { datosReporteNomina } from "./datos-reporte";
import { NavegacionNomina } from "../navegacion";

export const metadata = { title: "Reportes de nómina · El Buen Gusto" };

export default async function PaginaReportesNomina(
  props: PageProps<"/admin/nomina/reportes">,
) {
  await requerirRol("ADMIN");
  const { desde, hasta, empleadoId } = await props.searchParams;

  const ahora = new Date();
  const defDesde =
    typeof desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(desde)
      ? desde
      : `${ahora.getFullYear()}-01-01`;
  const defHasta =
    typeof hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hasta)
      ? hasta
      : new Date(ahora.getFullYear(), 11, 31).toISOString().slice(0, 10);
  const empFiltro =
    typeof empleadoId === "string" && /^\d+$/.test(empleadoId)
      ? Number.parseInt(empleadoId, 10)
      : null;

  const [datos, opcionesEmpleados] = await Promise.all([
    datosReporteNomina(defDesde, defHasta, empFiltro),
    (async () => {
      const { db } = await import("@/lib/db");
      return db.empleado.findMany({
        orderBy: { apellidos: "asc" },
        select: { id: true, nombre: true, apellidos: true },
      });
    })(),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes de nómina"
        subtitulo="Nómina, pagos, aportes y prestaciones por rango de fechas y empleado"
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/reportes" />
      </div>

      {/* Filtros */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
        <label className="text-xs font-bold text-texto-muted/60">
          DESDE
          <input type="date" name="desde" defaultValue={defDesde} className="ml-2 rounded-xl bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app" />
        </label>
        <label className="text-xs font-bold text-texto-muted/60">
          HASTA
          <input type="date" name="hasta" defaultValue={defHasta} className="ml-2 rounded-xl bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app" />
        </label>
        <label className="text-xs font-bold text-texto-muted/60">
          EMPLEADO
          <select name="empleadoId" defaultValue={empFiltro ? String(empFiltro) : ""} className="ml-2 rounded-xl bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app">
            <option value="">Todos</option>
            {opcionesEmpleados.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover">
          Consultar
        </button>
        <a
          href={`/admin/nomina/reportes/exportar?desde=${defDesde}&hasta=${defHasta}${empFiltro ? `&empleadoId=${empFiltro}` : ""}`}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 text-sm font-bold text-brown-950 transition hover:bg-orange-brand"
        >
          <Download className="h-4 w-4" /> Exportar Excel
        </a>
      </form>

      {/* Resumen */}
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Total devengado
          </p>
          <p className="font-display text-2xl text-texto-app">{formatCOP(datos.resumen.totalDevengado)}</p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Neto pagado
          </p>
          <p className="font-display text-2xl text-success-text">{formatCOP(datos.resumen.totalPagado)}</p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Neto pendiente
          </p>
          <p className="font-display text-2xl text-amber-brand">{formatCOP(datos.resumen.totalPendiente)}</p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Aportes empleador
          </p>
          <p className="font-display text-2xl text-info-text">{formatCOP(datos.resumen.totalAportes)}</p>
        </div>
      </div>

      {/* Por empleado */}
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-texto-app">
        <BarChart3 className="h-5 w-5 text-amber-brand" /> Por empleado ({datos.porEmpleado.length})
      </h2>
      <div className="mb-8 overflow-x-auto rounded-2xl bg-panel-app p-1 ring-1 ring-borde-app">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-texto-muted/55">
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2 text-right">Devengado</th>
              <th className="px-3 py-2 text-right">Extras/recargos</th>
              <th className="px-3 py-2 text-right">Deducciones</th>
              <th className="px-3 py-2 text-right">Neto</th>
              <th className="px-3 py-2 text-right">Pagado</th>
              <th className="px-3 py-2 text-right">Pendiente</th>
              <th className="px-3 py-2 text-right">Aportes emp.</th>
              <th className="px-3 py-2 text-right">Prestaciones</th>
            </tr>
          </thead>
          <tbody>
            {datos.porEmpleado.map((f) => (
              <tr key={f.empleadoId} className="border-t border-borde-app/40">
                <td className="px-3 py-1.5 font-bold text-texto-app">{f.nombre}</td>
                <td className="px-3 py-1.5 text-right text-texto-muted/80">{formatCOP(f.totalDevengado)}</td>
                <td className="px-3 py-1.5 text-right text-texto-muted/80">{formatCOP(f.horasExtras)}</td>
                <td className="px-3 py-1.5 text-right text-danger-text">{formatCOP(f.deducciones)}</td>
                <td className="px-3 py-1.5 text-right font-bold text-texto-app">{formatCOP(f.neto)}</td>
                <td className="px-3 py-1.5 text-right text-success-text">{formatCOP(f.pagado)}</td>
                <td className="px-3 py-1.5 text-right text-amber-brand">{formatCOP(f.pendiente)}</td>
                <td className="px-3 py-1.5 text-right text-info-text">{formatCOP(f.aportesEmpleador)}</td>
                <td className="px-3 py-1.5 text-right text-texto-muted/70">{formatCOP(f.prestaciones)}</td>
              </tr>
            ))}
            {datos.porEmpleado.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-texto-muted/60">
                  Sin liquidaciones en ese rango.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Asistencia y ausencias */}
      <h2 className="mb-3 font-display text-xl text-texto-app">Asistencia y ausencias en el rango</h2>
      <div className="mb-8 overflow-x-auto rounded-2xl bg-panel-app p-1 ring-1 ring-borde-app">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-texto-muted/55">
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2 text-right">Jornadas</th>
              <th className="px-3 py-2 text-right">Horas trabajadas</th>
              <th className="px-3 py-2 text-right">Nocturnas</th>
              <th className="px-3 py-2 text-right">Extras</th>
              <th className="px-3 py-2 text-right">Festivo/dominical</th>
              <th className="px-3 py-2 text-right">Ausencias (días)</th>
            </tr>
          </thead>
          <tbody>
            {datos.asistencia.map((a) => (
              <tr key={a.empleadoId} className="border-t border-borde-app/40">
                <td className="px-3 py-1.5 font-bold text-texto-app">{a.nombre}</td>
                <td className="px-3 py-1.5 text-right">{a.jornadas}</td>
                <td className="px-3 py-1.5 text-right">{(a.minutos / 60).toFixed(1)} h</td>
                <td className="px-3 py-1.5 text-right">{(a.nocturnos / 60).toFixed(1)} h</td>
                <td className="px-3 py-1.5 text-right">{(a.extras / 60).toFixed(1)} h</td>
                <td className="px-3 py-1.5 text-right">{(a.festivos / 60).toFixed(1)} h</td>
                <td className="px-3 py-1.5 text-right text-danger-text">{a.diasAusencia}</td>
              </tr>
            ))}
            {datos.asistencia.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-texto-muted/60">
                  Sin jornadas registradas en ese rango.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pagos */}
      <h2 className="mb-3 font-display text-xl text-texto-app">
        Últimos pagos del rango ({datos.pagos.length})
      </h2>
      <div className="overflow-x-auto rounded-2xl bg-panel-app p-1 ring-1 ring-borde-app">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-texto-muted/55">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Empleado</th>
              <th className="px-3 py-2">Método</th>
              <th className="px-3 py-2">Referencia</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-right">Caja</th>
            </tr>
          </thead>
          <tbody>
            {datos.pagos.map((p) => (
              <tr key={p.id} className="border-t border-borde-app/40">
                <td className="px-3 py-1.5">{p.fecha}</td>
                <td className="px-3 py-1.5 text-texto-app">{p.empleado}</td>
                <td className="px-3 py-1.5">{p.metodo}</td>
                <td className="px-3 py-1.5 text-texto-muted/70">{p.referencia ?? "—"}</td>
                <td className="px-3 py-1.5 text-right font-bold text-texto-app">{formatCOP(p.monto)}</td>
                <td className="px-3 py-1.5 text-right">
                  {p.gastoId ? (
                    <Link href={`/admin/caja`} className="text-info-text underline-offset-2 hover:underline">
                      egreso #{p.gastoId}
                    </Link>
                  ) : (
                    <span className="text-texto-muted/50">—</span>
                  )}
                </td>
              </tr>
            ))}
            {datos.pagos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-texto-muted/60">
                  Sin pagos registrados en ese rango.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
