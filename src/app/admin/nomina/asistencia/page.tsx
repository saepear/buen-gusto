// ═════════ Nómina · Asistencia y jornadas ═════════
// Registro administrativo manual: entrada, salida y descanso. Al guardar, el
// sistema CLASIFICA por minuto (ordinarias, nocturnas, festivo, extras) y
// congela esos números: las liquidaciones los leen tal cual.
import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";
import { FormularioJornada } from "./formularios";

export const metadata = { title: "Asistencia · Nómina · El Buen Gusto" };

/**;padding minutos → «14:30» */
function horaDe(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default async function PaginaAsistencia(
  props: PageProps<"/admin/nomina/asistencia">,
) {
  await requerirRol("ADMIN");
  const { fecha, empleadoId } = await props.searchParams;

  const fechaFiltro =
    typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? fecha
      : claveDia(new Date());
  const empleadoFiltro =
    typeof empleadoId === "string" && /^\d+$/.test(empleadoId)
      ? Number.parseInt(empleadoId, 10)
      : null;

  const [empleados, jornadas] = await Promise.all([
    db.empleado.findMany({
      where: { estado: "ACTIVO" },
      orderBy: { apellidos: "asc" },
      select: { id: true, nombre: true, apellidos: true, diaDescanso: true },
    }),
    db.jornadaLaboral.findMany({
      where: {
        fecha: fechaFiltro,
        ...(empleadoFiltro ? { empleadoId: empleadoFiltro } : {}),
      },
      orderBy: { empleadoId: "asc" },
      include: { empleado: true, modificadoPor: true },
    }),
  ]);

  const registradosHoy = new Set(jornadas.map((j) => j.empleadoId));

  return (
    <>
      <EncabezadoPagina
        titulo="Asistencia y jornadas"
        subtitulo="Entrada, salida y descanso por día: el sistema clasifica los minutos y los congela para la liquidación"
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/asistencia" />
      </div>

      <div className="mb-6">
        <FormularioJornada
          empleados={empleados.map((e) => ({
            id: e.id,
            nombre: `${e.nombre} ${e.apellidos}`,
            diaDescanso: e.diaDescanso,
          }))}
        />
      </div>

      {/* Filtro */}
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
        <label className="text-xs font-bold text-texto-muted/60">
          DÍA
          <input
            type="date"
            name="fecha"
            defaultValue={fechaFiltro}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app"
          />
        </label>
        <label className="text-xs font-bold text-texto-muted/60">
          EMPLEADO
          <select
            name="empleadoId"
            defaultValue={String(empleadoFiltro ?? "")}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app"
          >
            <option value="">Todos</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} {e.apellidos}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover">
          Filtrar
        </button>
      </form>

      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-texto-app">
        <CalendarCheck className="h-5 w-5 text-amber-brand" /> Jornadas del {fechaFiltro} ({jornadas.length})
      </h2>

      {/* Quien falta por registrar */}
      <p className="mb-3 text-sm text-texto-muted/70">
        Sin registrar ese día:{" "}
        {empleados.filter((e) => !registradosHoy.has(e.id)).length > 0
          ? empleados
              .filter((e) => !registradosHoy.has(e.id))
              .map((e) => e.nombre)
              .join(", ")
          : "— están todos —"}
      </p>

      {jornadas.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <CalendarCheck className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">Sin jornadas ese día</p>
          <p className="mt-1.5 max-w-md text-sm text-texto-muted/70">
            Regístralas con «Registrar jornada»: horario HH:MM, y los minutos
            que estuvieron de descanso no remunerado.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {jornadas.map((j) => {
            const extra = j.minutosExtraDiurnas + j.minutosExtraNocturnas + j.minutosExtraFestivasDiurnas + j.minutosExtraFestivasNocturnas;
            return (
              <article key={j.id} className="rounded-2xl bg-panel-app p-3.5 ring-1 ring-borde-app">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/nomina/empleados/${j.empleadoId}`}
                      className="text-sm font-bold text-texto-app underline-offset-4 hover:text-amber-brand hover:underline"
                    >
                      {j.empleado.nombre} {j.empleado.apellidos}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11px] text-texto-muted/60">
                      <span className="rounded-full bg-fondo-app px-2 py-0.5 font-bold text-texto-muted/75 ring-1 ring-borde-app">
                        {horaDe(j.entradaMinutos)} → {horaDe(j.salidaMinutos)}
                      </span>
                      <span>
                        ordinarias {Math.floor(j.minutosOrdinarios / 60)}h
                      </span>
                      {j.minutosNocturnos > 0 ? <span>nocturnas {Math.round(j.minutosNocturnos / 60)}h</span> : null}
                      {j.minutosFestivos > 0 ? <span>festivo/dominical {Math.round(j.minutosFestivos / 60)}h</span> : null}
                      {extra > 0 ? <span className="font-bold text-amber-brand">extra {Math.round(extra / 60)}h</span> : null}
                      {j.esFestivo || j.esDiaDescanso ? <span>día con recargo</span> : null}
                    </p>
                    {j.modificadoAt ? (
                      <p className="mt-1 text-[11px] text-warning-text">
                        Corregida {new Date(j.modificadoAt).toLocaleDateString("es-CO")} · {j.modificadoMotivo}
                        {j.modificadoPor ? ` · por ${j.modificadoPor.nombre}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <strong className="font-display text-lg text-texto-app">
                    {Math.floor(j.minutosTrabajados / 60)}h {j.minutosTrabajados % 60}m
                  </strong>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
