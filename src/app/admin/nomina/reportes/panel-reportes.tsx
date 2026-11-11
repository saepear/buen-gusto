"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, ChartNoAxesCombined, Download, Search, Wallet, Clock3, Receipt, X } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { NavegacionNomina } from "../navegacion";
import { FormularioPagoNomina } from "../liquidaciones/formularios-pago";
import type { DatosReporteNomina } from "./datos-reporte";
import "../operaciones.css";
import "../directorio-reportes.css";

export function PanelReportesNomina({ datos, empleados, desde, hasta, empleadoId }: {
  datos: DatosReporteNomina; empleados: { id: number; nombre: string; apellidos: string }[];
  desde: string; hasta: string; empleadoId: number | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [modal, setModal] = useState<{ id: number; origen: OrigenModal } | null>(null);
  const elegido = datos.porEmpleado.find(e => e.empleadoId === modal?.id);
  const [tab, setTab] = useState("Equipo");
  const [error, setError] = useState<string | null>(null);
  const exportar = `/admin/nomina/reportes/exportar?${new URLSearchParams({ desde, hasta, ...(empleadoId ? { empleadoId: String(empleadoId) } : {}) })}`;
  const totalNeto = datos.porEmpleado.reduce((s, e) => s + e.neto, 0);
  const avance = totalNeto > 0 ? Math.min(100, Math.round(datos.resumen.totalPagado / totalNeto * 100)) : 0;
  const pendientesPorPagar = datos.porEmpleado
    .filter((empleado) => empleado.pendiente > 0)
    .sort((a, b) => b.pendiente - a.pendiente);
  function abrir(id: number, event: MouseEvent<HTMLButtonElement>) {
    const r = event.currentTarget.getBoundingClientRect();
    setModal({ id, origen: { x: r.x, y: r.y, w: r.width, h: r.height } });
  }
  return <div className="nomina-operations">
    <header className="nomina-operationHero"><div className="nomina-operationTitle"><span className="nomina-operationIcon"><ChartNoAxesCombined /></span><div><p className="nomina-operationEyebrow">VISIÓN DEL EQUIPO · REPORTE</p><h1>Las cuentas, claras</h1><p>Consulta lo calculado, lo entregado y lo que falta pagar.</p></div></div><a href={exportar} className="nomina-operationPrimary"><Download size={17} /> Descargar Excel</a></header>
    <NavegacionNomina actual="/admin/nomina/reportes" />
    <form className="nomina-reportFilters" key={`${desde}-${hasta}-${empleadoId}`} action={form => {
      if (String(form.get("desde")) > String(form.get("hasta"))) { setError("La fecha inicial debe ser anterior o igual a la fecha final."); return; }
      setError(null);
      const query = new URLSearchParams({ desde: String(form.get("desde")), hasta: String(form.get("hasta")), empleadoId: String(form.get("empleadoId") ?? "") });
      iniciar(() => router.push(`/admin/nomina/reportes?${query}`));
    }}>
      <label>Desde<input type="date" name="desde" required defaultValue={desde} /></label>
      <label>Hasta<input type="date" name="hasta" required defaultValue={hasta} /></label>
      <label>Empleado<select name="empleadoId" defaultValue={empleadoId ?? ""}><option value="">Todo el equipo</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellidos}</option>)}</select></label>
      <button className="nomina-operationPrimary" disabled={pendiente}><Search size={16} />{pendiente ? "Consultando…" : "Consultar"}</button>
    </form>
    {error && <p role="alert" className="mb-4 text-sm text-danger-text">{error}</p>}
    <div aria-busy={pendiente} className={pendiente ? "nomina-reportResults is-loading" : "nomina-reportResults"}>
      <div className="nomina-reportStats">{[[Wallet, "Dinero entregado", datos.resumen.totalPagado, "Entregas de los ciclos consultados"], [Clock3, "Saldo por entregar", datos.resumen.totalPendiente, "Neto menos dinero registrado"], [Receipt, "Deducciones", datos.resumen.totalDeducciones, "Incluidas en los pagos del rango"]].map(([Icon, label, valor, nota]) => { const I = Icon as typeof Wallet; return <article key={String(label)}><I size={21} /><span>{String(label)}</span><strong>{formatCOP(Number(valor))}</strong><p>{String(nota)}</p></article>; })}</div>
      <section className="nomina-reportProgress"><div><strong>{avance}% del neto entregado</strong><span>{datos.porEmpleado.length} empleados · Base + extras {formatCOP(datos.resumen.totalDevengado)}</span></div><progress value={avance} max={100} aria-label="Porcentaje del neto entregado" /><p>Los totales corresponden a ciclos que se cruzan con {desde} — {hasta}. Las entregas de abajo se filtran por la fecha en que se registraron.</p></section>
      <section className={pendientesPorPagar.length ? "nomina-pendingPayroll" : "nomina-pendingPayroll is-clear"}>
        <div className="nomina-pendingPayroll-head">
          <div><span className="nomina-operationEyebrow">SEGUIMIENTO DE PAGOS</span><h2>{pendientesPorPagar.length ? "Hace falta pagar a" : "El equipo está al día"}</h2><p>{pendientesPorPagar.length ? `${pendientesPorPagar.length} ${pendientesPorPagar.length === 1 ? "persona tiene" : "personas tienen"} saldo pendiente en el rango consultado.` : "No hay saldos pendientes en el rango consultado."}</p></div>
          <strong>{formatCOP(datos.resumen.totalPendiente)}</strong>
        </div>
        {pendientesPorPagar.length ? <div className="nomina-pendingPayroll-list">{pendientesPorPagar.map((empleado) => <button key={empleado.empleadoId} type="button" onClick={(event) => abrir(empleado.empleadoId, event)}><span className="nomina-operationAvatar">{empleado.nombre.split(" ").slice(0, 2).map(p => p[0]).join("")}</span><span className="nomina-pendingPayroll-copy"><b>{empleado.nombre}</b><small>Entregado {formatCOP(empleado.pagado)} de {formatCOP(empleado.neto)}</small></span><span className="nomina-pendingPayroll-money"><small>Falta</small><b>{formatCOP(empleado.pendiente)}</b></span><ArrowUpRight size={17} /></button>)}</div> : null}
      </section>
      <div className="nomina-reportSectionHeader"><h2>{tab === "Equipo" ? "Resumen por persona" : "Entregas registradas"}</h2><div className="nomina-operationFilters">{["Equipo", "Entregas"].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div></div>
      {tab === "Equipo" ? <div className="nomina-operationGrid">{datos.porEmpleado.map(e => <button key={e.empleadoId} className="nomina-operationTile" onClick={event => abrir(e.empleadoId, event)}><div className="nomina-tileHeading"><span className="nomina-operationAvatar">{e.nombre.split(" ").slice(0, 2).map(p => p[0]).join("")}</span><span className="nomina-operationBadge">{e.pendiente > 0 ? "Con saldo" : "Al día"}</span><ArrowUpRight size={17} /></div><h2>{e.nombre}</h2><p>Neto del rango {formatCOP(e.neto)}</p><div className="nomina-reportCardAmounts"><span>Entregado<strong>{formatCOP(e.pagado)}</strong></span><span>Pendiente<strong>{formatCOP(e.pendiente)}</strong></span></div><footer><span>Descuentos {formatCOP(e.deducciones)}</span><span>Ver desglose →</span></footer></button>)}</div> : <section className="nomina-reportDeliveries">{datos.pagos.map(p => <article key={p.id}><span className="nomina-operationIcon"><Receipt size={19} /></span><div><strong>{p.empleado}</strong><p>{p.fecha} · {p.metodo}{p.referencia ? ` · ${p.referencia}` : ""}</p></div><b>{formatCOP(p.monto)}</b>{p.gastoId && <Link href="/admin/caja" className="nomina-operationLink">Ver egreso <ArrowUpRight size={14} /></Link>}</article>)}{datos.pagos.length > 0 && <p className="nomina-reportFootnote">Hasta las 100 entregas más recientes del rango.</p>}</section>}
      {(tab === "Equipo" ? !datos.porEmpleado.length : !datos.pagos.length) && <div className="nomina-operationEmpty"><ChartNoAxesCombined size={32} /><h2>Sin movimientos en esta consulta</h2><p>Cambia las fechas o selecciona otro empleado.</p></div>}
    </div>
    {modal && elegido && <ModalFlip origen={modal.origen} onClose={() => setModal(null)} ariaLabel={`Reporte de ${elegido.nombre}`} animacion="suave" panelClassName="nomina-operationModal nomina-paymentModal">{cerrar => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">DESGLOSE DEL RANGO</p><h2>{elegido.nombre}</h2></div><button aria-label="Cerrar reporte" onClick={cerrar}><X size={20} /></button></header><div className="nomina-operationModalBody"><p className="nomina-reportFootnote">{desde} — {hasta}</p>{[["Base + extras", elegido.totalDevengado], ["Deducciones", elegido.deducciones], ["Neto a entregar", elegido.neto], ["Dinero entregado", elegido.pagado], ["Saldo pendiente", elegido.pendiente]].map(([label, valor]) => <div className="nomina-profileVersion" key={String(label)}><span>{String(label)}</span><b>{formatCOP(Number(valor))}</b></div>)}{elegido.pagosPendientes.length ? <section className="nomina-reportPayNow"><div><span className="nomina-operationEyebrow">PAGO DIRECTO</span><h3>Registrar lo pendiente</h3><p>Elige el período y registra la entrega sin salir del reporte.</p></div>{elegido.pagosPendientes.map((pago) => <article key={pago.liquidacionId}><div className="nomina-reportPayPeriod"><span>{pago.desde} → {pago.hasta}</span><b>Pendiente {formatCOP(pago.pendiente)}</b></div>{pago.periodoCerrado ? <p className="nomina-reportFootnote">Este período está cerrado; su saldo solo queda disponible como referencia histórica.</p> : <FormularioPagoNomina key={`${pago.liquidacionId}-${pago.pagado}`} liquidacionId={pago.liquidacionId} netoAPagar={pago.netoAPagar} pagado={pago.pagado} metodoHabitual={pago.metodoHabitual} abiertoInicial />}</article>)}</section> : <p className="nomina-reportPaidState">No hay pagos pendientes para registrar en este rango.</p>}{(elegido.aportesEmpleador > 0 || elegido.prestaciones > 0) && <details className="nomina-reportLegacy"><summary>Otros valores históricos</summary><p>Aportes registrados {formatCOP(elegido.aportesEmpleador)}</p><p>Prestaciones registradas {formatCOP(elegido.prestaciones)}</p></details>}<p className="nomina-reportFootnote">Este resumen agrupa los ciclos incluidos en la consulta. Descarga el Excel para conservar el detalle.</p></div></>}</ModalFlip>}
  </div>;
}
