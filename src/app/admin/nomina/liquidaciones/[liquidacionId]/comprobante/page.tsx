// ═════════ Nómina · Comprobante de liquidación (imprimible) ═════════
// Diseño limpio para impresión. Conserva los valores históricos de la foto,
// NUNCA recalcula. OJO: es un comprobante interno de pago de nómina; NO es
// el Documento Soporte de Pago de Nómina Electrónica de la DIAN (esa
// transmisión lleva software separado y certificado — no implementado).
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { ESTADO_PAGO_LABEL } from "@/lib/nomina/helpers";

export const metadata = { title: "Comprobante de nómina · El Buen Gusto" };

export default async function PaginaComprobante(
  props: PageProps<"/admin/nomina/liquidaciones/[liquidacionId]/comprobante">,
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
      aprobadoPor: true,
    },
  });
  if (!liq) {
    return <p className="p-8 text-center text-sm text-danger-text">No existe esa liquidación.</p>;
  }

  const ultimoPago = [...liq.pagos].filter((p) => p.metodo !== "").pop();
  const devengados = liq.conceptos.filter((c) => c.tipo === "DEVENGADO" && c.clave !== "AUSENCIAS");
  const deducciones = liq.conceptos.filter((c) => c.tipo === "DEDUCCION");
  const empresa = liq.conceptos.filter((c) => c.tipo === "EMPRESA");

  return (
    <div className="mx-auto max-w-3xl p-4 print:p-0">
      <p className="mb-4 print:hidden">
        <Link
          href={`/admin/nomina/liquidaciones/${liq.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-texto-muted/70 hover:text-texto-app"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la liquidación
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-3 rounded-xl bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950"
        >
          Imprimir
        </button>
      </p>

      <article className="rounded-2xl bg-panel-app p-6 ring-1 ring-borde-app print:rounded-none print:ring-none">
        {/* Encabezado */}
        <header className="mb-4 border-b-2 border-borde-app/60 pb-3 text-center">
          <h1 className="font-display text-2xl text-texto-app">EL BUEN GUSTO</h1>
          <p className="text-xs text-texto-muted/70">
            Comprobante de liquidación de nómina
          </p>
          <p className="text-xs text-texto-muted/70">
            Documento interno · NO es soporte de nómina electrónica DIAN
          </p>
        </header>

        {/* Empleado y período */}
        <section className="mb-4 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <p><strong>Empleado:</strong> {liq.empleado.nombre} {liq.empleado.apellidos}</p>
          <p><strong>Documento:</strong> {liq.empleado.documentoTipo} {liq.empleado.documentoNumero}</p>
          <p><strong>Cargo:</strong> {liq.empleado.cargo}</p>
          <p><strong>Período:</strong> {liq.periodo.fechaDesde} → {liq.periodo.fechaHasta}</p>
          <p><strong>Días trabajados:</strong> {liq.diasTrabajados}</p>
          <p>
            <strong>Liquidación:</strong> #{liq.id} — {liq.estado}
          </p>
        </section>

        {/* Devengados */}
        <section className="mb-3">
          <h2 className="border-b border-borde-app/50 pb-1 font-display text-sm font-bold uppercase text-texto-app">
            Devengados
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {devengados.map((c) => (
                <tr key={c.id}>
                  <td className="py-1">{c.etiqueta}</td>
                  <td className="py-1 text-right font-bold">{formatCOP(c.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-borde-app/50 font-bold">
                <td className="pt-1">Total devengado</td>
                <td className="pt-1 text-right">{formatCOP(liq.totalDevengado)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Deducciones */}
        <section className="mb-3">
          <h2 className="border-b border-borde-app/50 pb-1 font-display text-sm font-bold uppercase text-texto-app">
            Deducciones del trabajador
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {deducciones.map((c) => (
                <tr key={c.id}>
                  <td className="py-1">{c.etiqueta}</td>
                  <td className="py-1 text-right font-bold">− {formatCOP(c.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-borde-app/50 font-bold">
                <td className="pt-1">Total deducciones</td>
                <td className="pt-1 text-right">− {formatCOP(liq.totalDeducciones)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Aportes informativos */}
        <section className="mb-3">
          <h2 className="border-b border-borde-app/50 pb-1 font-display text-sm font-bold uppercase text-texto-app">
            Aportes del empleador (informativos — no se le pagan al trabajador)
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {empresa.map((c) => (
                <tr key={c.id}>
                  <td className="py-1">{c.etiqueta}</td>
                  <td className="py-1 text-right">{formatCOP(c.valor)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="pt-1">Costo del empleador</td>
                <td className="pt-1 text-right">{formatCOP(liq.costoEmpleador)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Neto */}
        <section className="mb-4 rounded-xl bg-fondo-app px-4 py-3 text-center ring-1 ring-borde-app">
          <p className="text-xs font-bold uppercase tracking-wide text-texto-muted/60">
            Neto a pagar
          </p>
          <p className="font-display text-3xl text-texto-app">{formatCOP(liq.netoAPagar)}</p>
          <p className="mt-1 text-xs text-texto-muted/70">
            Estado del pago: <strong>{ESTADO_PAGO_LABEL[liq.estadoPago] ?? liq.estadoPago}</strong> ·
            entregado: {formatCOP(liq.pagado)} · saldo: {formatCOP(Math.max(liq.netoAPagar - liq.pagado, 0))}
          </p>
          {liq.estadoPago !== "PENDIENTE" && liq.pagos.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-texto-muted/70">
              {liq.pagos.map((p) => (
                <li key={p.id}>
                  {new Date(p.fecha).toLocaleDateString("es-CO")} · {p.metodo}
                  {p.referencia ? ` · ${p.referencia}` : ""} · {formatCOP(p.monto)} ·{" "}
                  {p.registradoPor.nombre}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {/* Firmas + nota */}
        <section className="mt-6 grid gap-6 text-center text-xs text-texto-muted/70 sm:grid-cols-2">
          <div className="border-t border-borde-app/60 pt-2">
            {empleadoFirma(liq.empleado.nombre, liq.empleado.apellidos)}
            <br />
            Empleado — recibí conforme
          </div>
          <div className="border-t border-borde-app/60 pt-2">
            EL BUEN GUSTO
            <br />
            Empleador
          </div>
        </section>
        {liq.aprobadoPor ? (
          <p className="mt-4 text-center text-[10px] text-texto-muted/55">
            Aprobada por {liq.aprobadoPor.nombre}
            {liq.aprobadoAt ? ` el ${new Date(liq.aprobadoAt).toLocaleDateString("es-CO")}` : ""}.
            Los valores de este comprobante están congelados desde su aprobación.
          </p>
        ) : null}
        <p className="mt-1 text-center text-[10px] text-texto-muted/55">
          Generado por el POS El Buen Gusto · {new Date().toLocaleDateString("es-CO")}
          {ultimoPago && liq.pagos.length > 0 ? " · pagos registrados dentro del sistema" : ""}
        </p>
      </article>

      <style>{`@media print { body { background: white !important; } }`}</style>
    </div>
  );
}

function empleadoFirma(nombre: string, apellidos: string): string {
  return `${nombre} ${apellidos}`;
}
