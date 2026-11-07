// ═════════ Nómina · Empleados ═════════
import { UserRound } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";
import { FormularioNuevoEmpleado } from "./formularios";

export const metadata = { title: "Empleados · Nómina · El Buen Gusto" };

const MODALIDAD_LABEL: Record<string, string> = {
  LABORAL: "Contrato laboral",
  INDEPENDIENTE: "Prestación de servicios",
};

const REMUNERACION_LABEL: Record<string, string> = {
  MENSUAL: "mensual",
  DIARIO: "por día",
  HORARIO: "por hora",
};

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export default async function PaginaEmpleados() {
  await requerirRol("ADMIN");

  const empleados = await db.empleado.findMany({
    orderBy: [{ estado: "asc" }, { apellidos: "asc" }],
    include: {
      _count: { select: { liquidaciones: true, jornadas: true } },
    },
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Empleados"
        subtitulo="El personal de la casa: cambiar un salario nace una versión nueva de contrato, el pasado queda intacto"
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/empleados" />
      </div>

      <div className="mb-6">
        <FormularioNuevoEmpleado />
      </div>

      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-texto-app">
        <UserRound className="h-5 w-5 text-amber-brand" /> Personas registradas ({empleados.length})
      </h2>

      {empleados.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <UserRound className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">Sin personal por ahora</p>
          <p className="mt-1.5 max-w-md text-sm text-texto-muted/70">
            Registra a la primera persona con «Registrar empleado»: se crea el
            contrato inicial automáticamente.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {empleados.map((e) => (
            <article
              key={e.id}
              className={
                "rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app " +
                (e.estado === "INACTIVO" ? "opacity-70" : "")
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/admin/nomina/empleados/${e.id}`}
                    className="font-display text-lg text-texto-app underline-offset-4 hover:text-amber-brand hover:underline"
                  >
                    {e.nombre} {e.apellidos}
                  </Link>
                  <p className="mt-0.5 text-xs text-texto-muted/65">
                    {e.cargo} · {e.documentoTipo} {e.documentoNumero}
                    {e.telefono ? ` · ${e.telefono}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="rounded-full bg-fondo-app px-2 py-0.5 font-bold text-texto-muted/75 ring-1 ring-borde-app">
                      {MODALIDAD_LABEL[e.modalidad] ?? e.modalidad}
                    </span>
                    <span className="rounded-full bg-fondo-app px-2 py-0.5 font-bold text-texto-muted/75 ring-1 ring-borde-app">
                      {formatCOP(e.salarioMensual)}
                      {" "}
                      {REMUNERACION_LABEL[e.remuneracion] ?? e.remuneracion.toLowerCase()}
                    </span>
                    <span className="rounded-full bg-fondo-app px-2 py-0.5 font-bold text-texto-muted/75 ring-1 ring-borde-app">
                      {e.periodicidadPago === "MENSUAL" ? "pago mensual" : "pago quincenal"}
                    </span>
                    <span className="rounded-full bg-fondo-app px-2 py-0.5 font-bold text-texto-muted/75 ring-1 ring-borde-app">
                      descanso: {DIAS_SEMANA[e.diaDescanso] ?? "?"}
                    </span>
                    {e.auxilioTransporte ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 font-bold text-success-text ring-1 ring-success/20">
                        auxilio de transporte
                      </span>
                    ) : null}
                    {e.estado === "INACTIVO" ? (
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 font-bold text-danger-text ring-1 ring-danger/20">
                        inactivo{e.estadoMotivo ? ` · ${e.estadoMotivo}` : ""}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <Link
                    href={`/admin/nomina/empleados/${e.id}`}
                    className="rounded-xl bg-fondo-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
                  >
                    Ficha e historial
                  </Link>
                  <p className="text-[11px] text-texto-muted/55">
                    {e._count.liquidaciones} liquidaciones · {e._count.jornadas} jornadas
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
