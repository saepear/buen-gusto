"use client";
/* eslint-disable @next/next/no-html-link-for-pages */

import { useState, type MouseEvent } from "react";
import { CalendarRange, CheckCircle2, Clock3, ArrowUpRight, Plus, X } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { FormularioCrearPeriodo } from "./formularios";
import "../operaciones.css";

type Periodo = {
  id: number;
  desde: string;
  hasta: string;
  fechaPago: string | null;
  tipo: string;
  etiqueta: string;
  estado: string;
  empleados: number;
  devengado: number;
  neto: number;
  pagado: number;
};

export function PanelPeriodos({ periodos }: { periodos: Periodo[] }) {
  const [modal, setModal] = useState<{ tipo: "nuevo" | "detalle"; id?: number; origen: OrigenModal } | null>(null);
  const seleccionado = periodos.find(p => p.id === modal?.id);
  function abrir(tipo: "nuevo" | "detalle", e: MouseEvent<HTMLButtonElement>, id?: number) {
    const r = e.currentTarget.getBoundingClientRect();
    setModal({ tipo, id, origen: { x: r.x, y: r.y, w: r.width, h: r.height } });
  }
  return <div className="nomina-periodsBoard">
    <div className="nomina-periodsToolbar">
      <div><p className="nomina-operationEyebrow">PAGOS CADA 7 DÍAS</p><h2><CalendarRange size={20} /> Períodos ({periodos.length})</h2></div>
      <button type="button" className="nomina-operationPrimary" onClick={e => abrir("nuevo", e)}><Plus size={18} />Crear ciclo de pago</button>
    </div>
    {periodos.length === 0 ? <div className="nomina-operationEmpty"><CalendarRange size={32} /><h2>Aún no hay períodos</h2><p>Crea el primer ciclo semanal desde el botón superior.</p></div> : <div className="nomina-periodsGrid">{periodos.map(p => { const saldo = Math.max(p.neto - p.pagado, 0); return <button type="button" className="nomina-periodTile" key={p.id} onClick={e => abrir("detalle", e, p.id)}><div className="nomina-periodTileTop"><span className={p.estado === "ABIERTO" ? "nomina-operationBadge is-open" : "nomina-operationBadge is-closed"}>{p.estado === "ABIERTO" ? "Abierto" : "Cerrado"}</span><ArrowUpRight size={17} /></div><h3>{p.desde} → {p.hasta}</h3><p>{p.etiqueta} · Pago {p.fechaPago ?? p.hasta}</p><div className="nomina-periodNumbers"><span>Empleados<strong>{p.empleados}</strong></span><span>Neto<strong>{formatCOP(p.neto)}</strong></span></div><footer><span>Pagado {formatCOP(p.pagado)}</span><strong>{saldo ? `${formatCOP(saldo)} pendiente` : "Al día"}</strong></footer></button>; })}</div>}
    {modal && <ModalFlip origen={modal.origen} onClose={() => setModal(null)} ariaLabel={modal.tipo === "nuevo" ? "Crear ciclo de pago" : "Detalle del período"} animacion="suave" panelClassName="nomina-operationModal nomina-periodModal">{cerrar => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">{modal.tipo === "nuevo" ? "NUEVO CICLO" : `PERÍODO #${seleccionado?.id}`}</p><h2>{modal.tipo === "nuevo" ? "Crear ciclo de pago" : `${seleccionado?.desde} → ${seleccionado?.hasta}`}</h2></div><button type="button" aria-label="Cerrar período" onClick={cerrar}><X size={20} /></button></header><div className="nomina-operationModalBody">{modal.tipo === "nuevo" ? <FormularioCrearPeriodo onSuccess={cerrar} /> : seleccionado && <><div className="nomina-periodDetailStatus"><span>{seleccionado.estado === "ABIERTO" ? <Clock3 size={17} /> : <CheckCircle2 size={17} />}{seleccionado.estado === "ABIERTO" ? "Ciclo abierto" : "Ciclo cerrado"}</span><small>Pago previsto {seleccionado.fechaPago ?? seleccionado.hasta}</small></div><div className="nomina-periodDetailStats"><div><span>Empleados</span><strong>{seleccionado.empleados}</strong></div><div><span>Pago base + extras</span><strong>{formatCOP(seleccionado.devengado)}</strong></div><div><span>Neto a pagar</span><strong>{formatCOP(seleccionado.neto)}</strong></div><div><span>Pagado</span><strong>{formatCOP(seleccionado.pagado)}</strong></div></div><div className="nomina-operationBox"><h3>Seguimiento del ciclo</h3><p>{seleccionado.neto - seleccionado.pagado > 0 ? `Queda ${formatCOP(seleccionado.neto - seleccionado.pagado)} por entregar al equipo.` : "Este ciclo está pagado al día."}</p><a className="nomina-operationPrimary" href="/admin/nomina/pagos">Abrir pagos <ArrowUpRight size={16} /></a></div></>}</div></>}</ModalFlip>}
  </div>;
}
