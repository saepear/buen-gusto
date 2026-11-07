import Link from "next/link";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { formatCOP } from "@/lib/format";
import { EncabezadoPagina } from "@/components/encabezado";
import { NavegacionNomina } from "../navegacion";
export const metadata = { title: "Pagos · Nómina · El Buen Gusto" };
export default async function PaginaPagos() {
  await requerirRol("ADMIN");
  const [pendientes, pagos] = await Promise.all([
    db.liquidacionNomina.findMany({
      where: { estado: "APROBADA", estadoPago: { not: "PAGADO" } },
      include: { empleado: true, periodo: true },
      orderBy: { periodo: { fechaDesde: "desc" } },
    }),
    db.pagoNomina.findMany({
      include: { liquidacion: { include: { empleado: true } } },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
  ]);
  return (
    <>
      <EncabezadoPagina
        titulo="Pagos de nómina"
        subtitulo="Saldos aprobados y pagos efectivamente realizados"
      />
      <NavegacionNomina actual="/admin/nomina/pagos" />
      <div className="mb-6 rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app">
        <p className="text-xs text-texto-muted">
          Saldo aprobado pendiente de pago
        </p>
        <strong className="font-display text-3xl text-amber-brand">
          {formatCOP(
            pendientes.reduce(
              (s, l) => s + Math.max(l.netoAPagar - l.pagado, 0),
              0,
            ),
          )}
        </strong>
      </div>
      <h2 className="mb-3 font-display text-xl">Por pagar</h2>
      <div className="mb-8 space-y-2">
        {pendientes.map((l) => (
          <Link
            key={l.id}
            href={`/admin/nomina/liquidaciones/${l.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app"
          >
            <div>
              <strong>
                {l.empleado.nombre} {l.empleado.apellidos}
              </strong>
              <p className="text-xs text-texto-muted">
                {l.periodo.fechaDesde} → {l.periodo.fechaHasta} ·{" "}
                {l.pagado > 0 ? "Pago parcial" : "Pendiente"}
              </p>
            </div>
            <span className="font-bold text-amber-brand">
              {formatCOP(Math.max(l.netoAPagar - l.pagado, 0))} · Registrar pago
              →
            </span>
          </Link>
        ))}
        {!pendientes.length && (
          <p className="text-sm text-texto-muted">
            No hay liquidaciones aprobadas pendientes de pago.
          </p>
        )}
      </div>
      <h2 className="mb-3 font-display text-xl">
        Últimos pagos ({pagos.length})
      </h2>
      <div className="space-y-2">
        {pagos.map((p) => (
          <Link
            key={p.id}
            href={`/admin/nomina/liquidaciones/${p.liquidacionId}`}
            className="flex flex-wrap justify-between gap-3 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app"
          >
            <div>
              <strong>
                {p.liquidacion.empleado.nombre}{" "}
                {p.liquidacion.empleado.apellidos}
              </strong>
              <p className="text-xs text-texto-muted">
                {p.fecha.toLocaleString("es-CO", {
                  timeZone: "America/Bogota",
                })}{" "}
                · {p.metodo}
                {p.referencia ? ` · ${p.referencia}` : ""}
              </p>
            </div>
            <strong className="text-success-text">{formatCOP(p.monto)}</strong>
          </Link>
        ))}
        {!pagos.length && (
          <p className="text-sm text-texto-muted">
            Todavía no se han registrado pagos.
          </p>
        )}
      </div>
      <p className="mt-6 text-xs text-texto-muted">
        Solo los pagos en efectivo generan egreso de caja. Un vale o una
        liquidación pendiente no equivalen a un pago.
      </p>
    </>
  );
}
