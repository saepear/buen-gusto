import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { formatCOP } from "@/lib/format";
import { NavegacionNomina } from "../../navegacion";
import { BotonAprobarLiquidacion, BotonLiquidarEmpleado } from "../../periodos/formularios";
import { FormularioPagoNomina } from "../../liquidaciones/formularios-pago";
import { AjustePago } from "../ajustes";
import { FichaPago } from "../ficha-pago";
export const metadata = { title: "Pago del empleado · El Buen Gusto" };
export default async function PaginaPago({ params }: { params: Promise<{ pagoId: string }> }) {
  await requerirRol("ADMIN");
  const id = Number((await params).pagoId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const pago = await db.liquidacionNomina.findUnique({ where: { id }, include: { empleado: true, periodo: true, conceptos: { orderBy: { id: "asc" } }, pagos: { orderBy: { fecha: "desc" }, include: { registradoPor: true } }, creadoPor: true } });
  if (!pago) notFound();
  const interno = JSON.parse(pago.contratoFoto).esquemaPago === "INTERNO_V1";
  const borrador = pago.estado === "BORRADOR" && pago.periodo.estado !== "CERRADO" && pago.pagado === 0;
  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-texto-muted">Nómina / Pagos</p><h1 className="text-3xl font-bold">Pago del empleado</h1></div><Link className="rounded-xl bg-panel-app px-4 py-3 ring-1 ring-borde-app" href="/admin/nomina/pagos">← Todos los pagos</Link></div>
    <NavegacionNomina actual="/admin/nomina/pagos" />
    {!interno && <p className="mb-5 rounded-xl bg-panel-app p-4 text-sm">Registro del cálculo anterior: conserva sus importes originales.{borrador ? " Recalcula el borrador para usar base + extras − deducciones." : " Sus conceptos históricos se muestran sin modificarlos."}</p>}
    <div className="pago-layout">
      <FichaPago pago={pago} editable={borrador && interno} />
      <aside className="space-y-5">
        <section className="rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app"><h2 className="mb-3 text-lg font-bold">{borrador ? "1. Revisa y confirma" : "Pago confirmado"}</h2>
          {borrador ? <><p className="mb-4 text-sm text-texto-muted">Agrega los extras y deducciones. Al confirmar se fija el total; después registra el dinero entregado.</p>{interno ? <BotonAprobarLiquidacion liquidacionId={id} nombre={pago.empleado.nombre} /> : <BotonLiquidarEmpleado periodoId={pago.periodoId} empleadoId={pago.empleadoId} nombre={pago.empleado.nombre} />}</> : <p className="text-sm text-texto-muted">Los importes confirmados se conservan en el historial.</p>}
        </section>
        {borrador && interno && <AjustePago pagoId={id} />}
        <section className="rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app"><h2 className="text-lg font-bold">Dinero entregado</h2><p className="my-3 text-2xl font-bold text-success-text">{formatCOP(pago.pagado)}</p><p className="mb-4 text-sm">Pendiente: {formatCOP(Math.max(pago.netoAPagar - pago.pagado, 0))}</p>
          {pago.estado === "APROBADA" && <FormularioPagoNomina liquidacionId={id} netoAPagar={pago.netoAPagar} pagado={pago.pagado} metodoHabitual={pago.empleado.metodoPago} />}
          <Link className="mt-5 block text-sm font-bold text-amber-brand underline" href={`/admin/nomina/pagos/${id}/comprobante`}>Ver / imprimir comprobante</Link>
        </section>
      </aside>
    </div>
    <section className="mt-6 rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app"><h2 className="mb-3 text-lg font-bold">Historial de entregas</h2>{!pago.pagos.length && <p className="text-sm text-texto-muted">Todavía no se ha entregado dinero.</p>}{pago.pagos.map(p => <div key={p.id} className="flex flex-wrap justify-between gap-3 border-b border-borde-app py-3 text-sm"><span>{p.fecha.toLocaleString("es-CO", { timeZone: "America/Bogota" })} · {p.metodo} · {p.registradoPor.nombre}{p.referencia ? ` · ${p.referencia}` : ""}</span><strong>{formatCOP(p.monto)}</strong></div>)}</section>
    <p className="mt-4 text-xs text-texto-muted">Preparado por {pago.creadoPor.nombre}. Registro interno del dinero a entregar.</p>
  </>;
}
