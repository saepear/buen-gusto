"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, Receipt } from "lucide-react";
import { formatCOP } from "@/lib/format";
import { FichaPago } from "./ficha-pago";
import { AjustePago } from "./ajustes";
import { FormularioPagoNomina } from "../liquidaciones/formularios-pago";
import type { DatosPago } from "./datos-pago";
import "../operaciones.css";

/** El mismo flujo completo en Resumen, Pagos y el detalle enlazable. */
export function ContenidoPago({ pago }: { pago: DatosPago }) {
  const borrador = pago.estado === "BORRADOR" && pago.periodo.estado !== "CERRADO" && pago.pagado === 0;
  const saldo = Math.max(pago.netoAPagar - pago.pagado, 0);
  return <div className="nomina-paymentContent">
    <div className="nomina-operationStatus"><span>{pago.estadoPago === "PAGADO" ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}{pago.estadoPago === "PAGADO" ? "Pagado" : borrador ? "En preparación" : pago.estado === "APROBADA" ? "Confirmado · pendiente de entrega" : pago.estado}</span></div>
    <div className="nomina-paymentLayout">
      <FichaPago pago={pago} editable={borrador && pago.interno} />
      <aside className="nomina-paymentAside">
        {borrador && <>
          {pago.interno ? <AjustePago pagoId={pago.id} /> : <p className="nomina-operationBox">Este borrador usa el cálculo anterior. Actualízalo para preparar base, extras y descuentos.</p>}
        </>}
        <section className="nomina-operationBox"><h3>Dinero entregado</h3><div className="nomina-moneyPair"><strong>{formatCOP(pago.pagado)}</strong><span>Pendiente <b>{formatCOP(saldo)}</b></span></div>
          {(saldo > 0 || pago.netoAPagar === 0 && pago.estadoPago !== "PAGADO") && pago.periodo.estado !== "CERRADO" && <FormularioPagoNomina key={`${pago.id}-${pago.pagado}`} liquidacionId={pago.id} netoAPagar={pago.netoAPagar} pagado={pago.pagado} metodoHabitual={pago.empleado.metodoPago} abiertoInicial />}
          {pago.estadoPago === "PAGADO" && <p className="text-success-text">Pago completo. La entrega quedó registrada.</p>}
          <Link className="nomina-operationLink" href={`/admin/nomina/pagos/${pago.id}/comprobante`} target="_blank" rel="noopener noreferrer"><Receipt size={16} />Ver / imprimir comprobante</Link>
        </section>
      </aside>
    </div>
    <section className="nomina-operationBox"><h3>Historial de entregas</h3>{!pago.pagos.length && <p>Aún no se ha registrado ninguna entrega.</p>}{pago.pagos.map(p => <article className="nomina-delivery" key={p.id}><div><strong>{p.metodo}</strong><p>{new Date(p.fecha).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · {p.registradoPor.nombre}</p>{p.referencia && <p>{p.referencia}</p>}{p.observaciones && <p>{p.observaciones}</p>}</div><strong>{formatCOP(p.monto)}</strong></article>)}</section>
  </div>;
}
