// ═════════ Nómina · Liquidación individual ═════════
// Desglose completo con la FOTO congelada (conceptos, contrato y parámetros
// usados en el cálculo) y registro de pagos con vínculo a caja.
import Link from "next/link";
import { Printer, Receipt } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { ESTADO_PAGO_LABEL, pendienteDeLiquidacion } from "@/lib/nomina/helpers";
import { NavegacionNomina } from "../../navegacion";
import { FormularioPagoNomina } from "../formularios-pago";

export const metadata = { title: "Liquidación · Nómina · El Buen Gusto" };

const GRUPOS = [
  { clave: "DEVENGADO", titulo: "Devengados" },
  { clave: "DEDUCCION", titulo: "Deducciones del trabajador" },
  { clave: "EMPRESA", titulo: "Aportes del empleador (informativo)" },
  { clave: "PRESTACION", titulo: "Prestaciones causadas" },
] as const;

export default async function PaginaLiquidacion(
  props: PageProps<"/admin/nomina/liquidaciones/[liquidacionId]">,
) {
  await requerirRol("ADMIN");
  const { liquidacionId } = await props.params;
  const id = Number.parseInt(liquidacionId, 10);
  if (!Number.isInteger(id)) {
    return <p className="p-8 text-center text-sm text-danger-text">Liquidación inválida.</p>;
  }

  const liq = await db.liquidacionNomina.findUnique({
    where: { id },
    include: {
      empleado: true,
      periodo: true,
      conceptos: { orderBy: [{ tipo: "asc" }, { id: "asc" }] },
      pagos: { orderBy: { fecha: "asc" }, include: { registradoPor: true } },
      creadoPor: true,
      aprobadoPor: true,
    },
  });
  if (!liq) {
    return <p className="p-8 text-center text-sm text-danger-text">No existe esa liquidación.</p>;
  }

  const pendiente = pendienteDeLiquidacion(liq);

  return (
    <>
      <EncabezadoPagina
        titulo={`${liq.empleado.nombre} ${liq.empleado.apellidos}`}
        subtitulo={`Período ${liq.periodo.fechaDesde} → ${liq.periodo.fechaHasta} · ${liq.estado} · pago: ${ESTADO_PAGO_LABEL[liq.estadoPago] ?? liq.estadoPago}`}
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/periodos" />
      </div>

      {/* Acciones */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {liq.estado === "APROBADA" ? (
          <FormularioPagoNomina liquidacionId={liq.id} netoAPagar={liq.netoAPagar} pagado={liq.pagado} metodoHabitual={liq.empleado.metodoPago} />
        ) : (
          <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm font-bold text-warning-text ring-1 ring-warning/20">
            Aprueba la liquidación desde el período antes de registrar pagos: los valores deben quedar congelados.
          </p>
        )}
        <Link
          href={`/admin/nomina/liquidaciones/${liq.id}/comprobante`}
          className="inline-flex items-center gap-2 rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
        >
          <Printer className="h-4 w-4" /> Comprobante para imprimir
        </Link>
      </div>

      {/* Totales */}
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Total devengado
          </p>
          <p className="font-display text-2xl text-texto-app">{formatCOP(liq.totalDevengado)}</p>
          <p className="text-[11px] text-texto-muted/55">
            {liq.diasTrabajados} días trabajados
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Deducciones
          </p>
          <p className="font-display text-2xl text-danger-text">{formatCOP(liq.totalDeducciones)}</p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Neto a pagar
          </p>
          <p className="font-display text-2xl text-amber-brand">{formatCOP(liq.netoAPagar)}</p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Pagado / pendiente
          </p>
          <p className="font-display text-2xl text-success-text">{formatCOP(liq.pagado)}</p>
          <p className="text-[11px] font-bold text-texto-muted/60">
            saldo {formatCOP(pendiente)}
          </p>
        </div>
      </div>

      {/* Desglose por grupos */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {GRUPOS.map((grupo) => {
          const conceptos = liq.conceptos.filter((c) => c.tipo === grupo.clave);
          if (conceptos.length === 0) return null;
          return (
            <section key={grupo.clave} className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
              <h2 className="mb-2 font-display text-lg text-texto-app">{grupo.titulo}</h2>
              <table className="w-full text-sm">
                <tbody>
                  {conceptos.map((c) => (
                    <tr key={c.id} className="border-t border-borde-app/40 first:border-none">
                      <td className="py-1.5 text-texto-app">
                        {c.etiqueta}
                        {c.detalle ? (
                          <span className="block text-[11px] text-texto-muted/55">{c.detalle}</span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-right font-bold text-texto-app">
                        {formatCOP(c.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {grupo.clave === "DEDUCCION" ? (
                <p className="mt-2 border-t border-borde-app/40 pt-2 text-right font-bold text-danger-text">
                  Total deducciones: {formatCOP(liq.totalDeducciones)}
                </p>
              ) : null}
              {grupo.clave === "EMPRESA" ? (
                <p className="mt-2 text-[11px] text-texto-muted/60">
                  Costo del empleador {formatCOP(liq.costoEmpleador)}: informativo, jamás se
                  descuenta del salario del trabajador.
                </p>
              ) : null}
              {grupo.clave === "PRESTACION" ? (
                <p className="mt-2 text-[11px] text-texto-muted/60">
                  Se acumulan a la persona: entran en «Obligaciones», no en el neto de esta nómina.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      {/* Foto del cálculo */}
      <section className="mb-6 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
        <h2 className="mb-2 font-display text-lg text-texto-app">
          <Receipt className="mr-1 inline h-4 w-4" /> Cómo se calculó (foto congelada)
        </h2>
        <p className="text-sm text-texto-muted/70">
          Contrato del cálculo:{" "}
          <DetalleContrato foto={liq.contratoFoto} /> — liquidada el{" "}
          {new Date(liq.createdAt).toLocaleString("es-CO")} por{" "}
          <strong>{liq.creadoPor.nombre}</strong>
          {liq.aprobadoPor ? (
            <>
              {" "}· aprobada el {liq.aprobadoAt ? new Date(liq.aprobadoAt).toLocaleString("es-CO") : ""} por {liq.aprobadoPor.nombre}
            </>
          ) : null}
        </p>
        {liq.notas ? (
          <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning-text ring-1 ring-warning/20">
            Notas: {liq.notas}
          </p>
        ) : null}
        <DetallesParametros foto={liq.parametrosFoto} />
      </section>

      {/* Pagos */}
      <section className="mb-6 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
        <h2 className="mb-2 font-display text-lg text-texto-app">
          Pagos registrados ({liq.pagos.length})
        </h2>
        {liq.pagos.length === 0 ? (
          <p className="text-sm text-texto-muted/70">Aún no se registra ningún pago.</p>
        ) : (
          <div className="space-y-1.5">
            {liq.pagos.map((p) => (
              <article key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-fondo-app px-3 py-2 ring-1 ring-borde-app/60">
                <p className="text-sm text-texto-app">
                  {new Date(p.fecha).toLocaleString("es-CO")} ·{" "}
                  <strong>{p.metodo}</strong>
                  {p.referencia ? ` · ${p.referencia}` : ""}
                  <span className="ml-2 text-[11px] text-texto-muted/55">
                    {p.registradoPor.nombre}
                  </span>
                </p>
                <div className="flex items-center gap-2 text-right">
                  <strong className="font-display text-texto-app">{formatCOP(p.monto)}</strong>
                  {p.gastoId ? (
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning-text ring-1 ring-warning/20">
                      egreso caja #{p.gastoId}
                    </span>
                  ) : (
                    <span className="rounded-full bg-fondo-app px-2 py-0.5 text-[10px] font-bold text-texto-muted/70 ring-1 ring-borde-app">
                      sin egreso de caja
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

/** Foto de contrato en texto corto */
function DetalleContrato({ foto }: { foto: string }) {
  let datos: {
    modalidad?: string;
    remuneracion?: string;
    salarioMensual?: number;
    salarioDiario?: number;
    valorHora?: number;
    jornadaSemanalMinutos?: number;
    vigenteDesde?: string;
  } = {};
  try {
    datos = JSON.parse(foto);
  } catch {
    datos = {};
  }
  const salario =
    datos.remuneracion === "MENSUAL"
      ? `${formatCOP(datos.salarioMensual ?? 0)} al mes`
      : datos.remuneracion === "DIARIO"
        ? `${formatCOP(datos.salarioDiario ?? 0)} por día`
        : `${formatCOP(datos.valorHora ?? 0)} por hora`;
  return (
    <span>
      {datos.modalidad === "INDEPENDIENTE" ? "Prestación de servicios" : "Contrato laboral"} ·{" "}
      {salario} · jornada {Math.round((datos.jornadaSemanalMinutos ?? 0) / 60)} h · vigente desde{" "}
      {datos.vigenteDesde ?? "—"}
    </span>
  );
}

/** Parámetros usados, resumidos (leídos de la foto, no de la tabla) */
function DetallesParametros({ foto }: { foto: string }) {
  let param: { clave: string; valor: number; unidad: string }[] = [];
  try {
    param = JSON.parse(foto);
  } catch {
    param = [];
  }
  const clavesMostradas = [
    "SALARIO_MINIMO",
    "AUXILIO_TRANSPORTE",
    "JORNADA_SEMANAL_MIN",
    "HORA_INICIO_NOCTURNO",
    "RECARGO_NOCTURNO",
    "RECARGO_DOMINICAL",
    "RECARGO_EXTRA_DIURNA",
    "RECARGO_EXTRA_NOCTURNA",
    "APOS_SALUD_TRABAJADOR",
    "APOS_PENSION_TRABAJADOR",
    "APOS_SALUD_EMPRESA",
    "APOS_PENSION_EMPRESA",
    "APOS_CAJA_EMPRESA",
  ];
  const usados = param.filter((p) => clavesMostradas.includes(p.clave));
  if (usados.length === 0) return null;
  return (
    <p className="mt-2 text-[11px] text-texto-muted/60">
      Parámetros de la foto:{" "}
      {usados
        .map((p) =>
          p.unidad === "PORCENTAJE"
            ? `${p.clave}=${(p.valor / 10000).toFixed(2)} %`
            : p.clave + "=" + p.valor.toLocaleString("es-CO"),
        )
        .join(" · ")}
    </p>
  );
}
