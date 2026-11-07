// ═════════ Nómina · Ficha del empleado ═════════
// Historial completo: versiones de contrato, liquidaciones y pagos.
// El pasado se muestra con sus fotos, no recalculado.
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP, formatFecha } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { pendienteDeLiquidacion } from "@/lib/nomina/helpers";
import { NavegacionNomina } from "../../navegacion";
import {
  AccionActualizarContrato,
  AccionDesactivarEmpleado,
  AccionEditarEmpleado,
} from "../formularios";

export const metadata = { title: "Ficha de empleado · Nómina · El Buen Gusto" };

const MODALIDAD_LABEL: Record<string, string> = {
  LABORAL: "Contrato laboral",
  INDEPENDIENTE: "Prestación de servicios",
};

export default async function PaginaFichaEmpleado(
  props: PageProps<"/admin/nomina/empleados/[empleadoId]">,
) {
  await requerirRol("ADMIN");
  const { empleadoId } = await props.params;
  const id = Number.parseInt(empleadoId, 10);
  if (!Number.isInteger(id)) {
    return <p className="p-8 text-center text-sm text-danger-text">Empleado inválido.</p>;
  }

  const empleado = await db.empleado.findUnique({
    where: { id },
    include: {
      contratoVersiones: { orderBy: { desde: "desc" } },
      liquidaciones: {
        orderBy: { createdAt: "desc" },
        include: { periodo: true },
      },
      pagosPrestaciones: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!empleado) {
    return <p className="p-8 text-center text-sm text-danger-text">No existe ese empleado.</p>;
  }

  const pagosNomina = await db.pagoNomina.findMany({
    where: { liquidacion: { empleadoId: id } },
    orderBy: { fecha: "desc" },
    take: 20,
    include: { registradoPor: true },
  });

  return (
    <>
      <EncabezadoPagina
        titulo={`${empleado.nombre} ${empleado.apellidos}`}
        subtitulo={`${empleado.cargo} · ${MODALIDAD_LABEL[empleado.modalidad] ?? empleado.modalidad} · ${empleado.documentoTipo} ${empleado.documentoNumero}`}
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/empleados" />
      </div>

      {/* Acciones */}
      <div className="mb-6 space-y-3">
        <AccionEditarEmpleado empleado={empleado} />
        <AccionActualizarContrato empleado={empleado} />
        {empleado.estado === "ACTIVO" ? (
          <AccionDesactivarEmpleado empleadoId={empleado.id} nombre={empleado.nombre} />
        ) : (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger-text ring-1 ring-danger/20">
            Desactivo. Motivo: {empleado.estadoMotivo ?? "—"}. Historial conservado.
          </p>
        )}
      </div>

      {/* Contrato actual */}
      <section className="mb-6">
        <h2 className="mb-2 font-display text-xl text-texto-app">Contrato vigente</h2>
        <div className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
          <p className="grid gap-x-6 gap-y-1 text-sm text-texto-app sm:grid-cols-2">
            <span>
              <strong>Salario:</strong>{" "}
              {empleado.remuneracion === "MENSUAL"
                ? formatCOP(empleado.salarioMensual) + " al mes"
                : empleado.remuneracion === "DIARIO"
                  ? formatCOP(empleado.salarioDiario) + " por día"
                  : formatCOP(empleado.valorHora) + " por hora"}
            </span>
            <span>
              <strong>Jornada semanal:</strong>{" "}
              {Math.round(empleado.jornadaSemanalMinutos / 60)} h
            </span>
            <span>
              <strong>Periodicidad:</strong>{" "}
              {empleado.periodicidadPago === "MENSUAL" ? "Mensual" : "Quincenal"}
            </span>
            <span>
              <strong>Ingreso:</strong>{" "}
              {formatFecha(empleado.fechaIngreso)}
            </span>
            <span>
              <strong>Auxilio de transporte:</strong>{" "}
              {empleado.auxilioTransporte ? "Sí (≤ 2 SMMLV)" : "No"}
            </span>
            <span>
              <strong>EPS / pensión:</strong>{" "}
              {empleado.epsNombre ?? "—"} · {empleado.fondoPensionName ?? "—"}
            </span>
          </p>
        </div>
      </section>

      {/* Versiones de contrato */}
      <section className="mb-6">
        <h2 className="mb-2 font-display text-xl text-texto-app">
          Historial de contrato ({empleado.contratoVersiones.length})
        </h2>
        <div className="space-y-1.5">
          {empleado.contratoVersiones.map((v) => (
            <article key={v.id} className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
              <p className="text-sm text-texto-app">
                <strong>{v.desde.toISOString().slice(0, 10)}</strong>
                {" → "}
                {v.hasta ? v.hasta.toISOString().slice(0, 10) : "vigente"}
                {" · "}
                {MODALIDAD_LABEL[v.modalidad] ?? v.modalidad} ·{" "}
                {formatCOP(
                  v.remuneracion === "MENSUAL"
                    ? v.salarioMensual
                    : v.remuneracion === "DIARIO"
                      ? v.salarioDiario
                      : v.valorHora,
                )}{" "}
                {v.remuneracion === "MENSUAL" ? "al mes" : v.remuneracion === "DIARIO" ? "por día" : "por hora"}
              </p>
              <p className="mt-0.5 text-[11px] text-texto-muted/60">
                {v.motivo}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Liquidaciones */}
      <section className="mb-6">
        <h2 className="mb-2 font-display text-xl text-texto-app">
          Liquidaciones ({empleado.liquidaciones.length})
        </h2>
        {empleado.liquidaciones.length === 0 ? (
          <p className="rounded-2xl bg-panel-app p-4 text-sm text-texto-muted/70 ring-1 ring-borde-app">
            Sin liquidaciones todavía.
          </p>
        ) : (
          <div className="space-y-1.5">
            {empleado.liquidaciones.map((l) => (
              <article key={l.id} className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-texto-app">
                      {l.periodo.fechaDesde} → {l.periodo.fechaHasta}
                    </p>
                    <p className="text-[11px] text-texto-muted/60">
                      {l.estado} · {l.estadoPago} · neto {formatCOP(l.netoAPagar)} · pagado{" "}
                      {formatCOP(l.pagado)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-display text-lg ${pendienteDeLiquidacion(l) > 0 ? "text-amber-brand" : "text-success-text"}`}>
                      {pendienteDeLiquidacion(l) > 0
                        ? `${formatCOP(pendienteDeLiquidacion(l))} por pagar`
                        : "pagada"}
                    </span>
                    <Link
                      href={`/admin/nomina/pagos/${l.id}`}
                      className="rounded-xl bg-fondo-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app hover:bg-panel-hover"
                    >
                      Detalle
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Pagos */}
      <section className="mb-6">
        <h2 className="mb-2 font-display text-xl text-texto-app">
          Últimos pagos ({pagosNomina.length})
        </h2>
        {pagosNomina.length === 0 ? (
          <p className="rounded-2xl bg-panel-app p-4 text-sm text-texto-muted/70 ring-1 ring-borde-app">
            Sin pagos todavía.
          </p>
        ) : (
          <div className="space-y-1.5">
            {pagosNomina.map((p) => (
              <article key={p.id} className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-texto-app">
                    {new Date(p.fecha).toLocaleDateString("es-CO")} · {p.metodo}
                    {p.referencia ? ` · ${p.referencia}` : ""}
                    <span className="ml-2 text-[11px] text-texto-muted/55">
                      {p.registradoPor.nombre}
                    </span>
                  </p>
                  <strong className="font-display">{formatCOP(p.monto)}</strong>
                </div>
                {p.observaciones ? (
                  <p className="mt-0.5 text-[11px] italic text-texto-muted/55">«{p.observaciones}»</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Pagos de prestaciones */}
      <section className="mb-4">
        <h2 className="mb-2 font-display text-xl text-texto-app">Pagos de prestaciones</h2>
        {empleado.pagosPrestaciones.length === 0 ? (
          <p className="rounded-2xl bg-panel-app p-4 text-sm text-texto-muted/70 ring-1 ring-borde-app">
            Sin pagos de prestaciones.
          </p>
        ) : (
          <div className="space-y-1.5">
            {empleado.pagosPrestaciones.map((p) => (
              <article key={p.id} className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-texto-app">
                    {p.concepto} · {new Date(p.fecha).toLocaleDateString("es-CO")} · {p.metodo}
                  </p>
                  <strong>{formatCOP(p.monto)}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
