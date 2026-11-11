"use client";

import Link from "next/link";
import { CheckCircle2, ChevronDown, Clock3, Receipt } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { FormularioPagoNomina } from "../liquidaciones/formularios-pago";
import { FichaPago } from "./ficha-pago";
import type { DatosPago } from "./datos-pago";
import "../operaciones.css";

function estaCompleto(pago: DatosPago) {
  return pago.estadoPago === "PAGADO";
}

export function ContenidoEmpleadoPagos({ pagos }: { pagos: DatosPago[] }) {
  const ordenados = [...pagos].sort((a, b) => b.periodo.fechaDesde.localeCompare(a.periodo.fechaDesde));
  const entregado = ordenados.reduce((total, pago) => total + pago.pagado, 0);
  const pendiente = ordenados.reduce((total, pago) => total + Math.max(pago.netoAPagar - pago.pagado, 0), 0);
  const empleado = ordenados[0]?.empleado;
  if (!empleado) return <p className="nomina-operationEmpty">Esta persona aún no tiene pagos registrados.</p>;

  return <div className="nomina-employeePaymentContent">
    <div className="nomina-employeePaymentSummary">
      <div><span>Historial de pagos</span><strong>{ordenados.length} {ordenados.length === 1 ? "pago" : "pagos"}</strong></div>
      <div><span>Total entregado</span><strong>{formatCOP(entregado)}</strong></div>
      <div><span>Saldo pendiente</span><strong className={pendiente ? "is-pending" : "is-paid"}>{formatCOP(pendiente)}</strong></div>
    </div>
    <div className="nomina-employeeCycleList">
      {ordenados.map((pago, index) => {
        const completo = estaCompleto(pago);
        const saldo = Math.max(pago.netoAPagar - pago.pagado, 0);
        const borrador = pago.estado === "BORRADOR" && pago.periodo.estado !== "CERRADO" && pago.pagado === 0;
        return <details key={pago.id} className="nomina-employeeCycle" open={index === 0 && !completo}>
          <summary>
            <div><strong>{pago.periodo.fechaDesde} → {pago.periodo.fechaHasta}</strong><span>{completo ? <><CheckCircle2 size={14} /> Pagado</> : <><Clock3 size={14} /> {pago.pagado > 0 ? "Pago parcial" : "Pendiente"}</>}</span></div>
            <b>{formatCOP(pago.netoAPagar)}</b>
            <ChevronDown size={18} />
          </summary>
          <div className="nomina-employeeCycleBody">
            <FichaPago pago={pago} editable={borrador && pago.interno} />
            <aside className="nomina-paymentAside">
              <section className="nomina-operationBox"><h3>Entrega del pago</h3><div className="nomina-moneyPair"><strong>{formatCOP(pago.pagado)}</strong><span>Pendiente <b>{formatCOP(saldo)}</b></span></div>{!completo && pago.periodo.estado !== "CERRADO" ? <FormularioPagoNomina key={`${pago.id}-${pago.pagado}`} liquidacionId={pago.id} netoAPagar={pago.netoAPagar} pagado={pago.pagado} metodoHabitual={pago.empleado.metodoPago} abiertoInicial /> : <p className={completo ? "text-success-text" : "text-texto-muted"}>{completo ? "Pago completo. La entrega quedó registrada." : "Registro histórico cerrado con saldo pendiente."}</p>}<Link className="nomina-operationLink" href={`/admin/nomina/pagos/${pago.id}/comprobante`} target="_blank" rel="noopener noreferrer"><Receipt size={16} /> Ver comprobante</Link></section>
              <section className="nomina-operationBox"><h3>Entregas registradas</h3>{!pago.pagos.length ? <p>Aún no se ha registrado ninguna entrega.</p> : pago.pagos.map((entrega) => <article className="nomina-delivery" key={entrega.id}><div><strong>{entrega.metodo}</strong><p>{new Date(entrega.fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · {entrega.registradoPor.nombre}</p>{entrega.referencia && <p>{entrega.referencia}</p>}</div><strong>{formatCOP(entrega.monto)}</strong></article>)}</section>
            </aside>
          </div>
        </details>;
      })}
    </div>
  </div>;
}
