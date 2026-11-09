"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { ArrowUpRight, CalendarRange, CheckCircle2, Clock3, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { BotonAbrirPeriodo, BotonCerrarPeriodo, FormularioCrearPeriodo } from "./formularios";
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

type FiltroPeriodo = "TODOS" | "ABIERTOS" | "CERRADOS";

export function PanelPeriodos({ periodos }: { periodos: Periodo[] }) {
  const [modal, setModal] = useState<{ tipo: "nuevo" | "detalle"; id?: number; origen: OrigenModal } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroPeriodo>("TODOS");
  const seleccionado = periodos.find((periodo) => periodo.id === modal?.id);
  const termino = busqueda.trim().toLowerCase();
  const visibles = periodos.filter((periodo) => {
    const coincideEstado = filtro === "TODOS" || (filtro === "ABIERTOS" ? periodo.estado === "ABIERTO" : periodo.estado !== "ABIERTO");
    if (!coincideEstado) return false;
    if (!termino) return true;
    return [periodo.desde, periodo.hasta, periodo.fechaPago ?? "", periodo.tipo, periodo.etiqueta, periodo.estado].join(" ").toLowerCase().includes(termino);
  });

  function abrir(tipo: "nuevo" | "detalle", event: MouseEvent<HTMLButtonElement>, id?: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    setModal({ tipo, id, origen: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
  }

  return (
    <div className="nomina-periodsBoard">
      <div className="nomina-periodsToolbar">
        <div><p className="nomina-operationEyebrow">PAGOS CADA 7 DÍAS · HISTORIAL PERMANENTE</p><h2><CalendarRange size={20} /> Períodos ({periodos.length})</h2></div>
        <button type="button" className="nomina-operationPrimary" onClick={(event) => abrir("nuevo", event)}><Plus size={18} /> Crear ciclo de pago</button>
      </div>
      <div className="nomina-periodsFilters" aria-label="Filtrar ciclos de pago">
        <label><Search size={17} /><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por año, fechas o tipo…" /></label>
        <div className="nomina-operationFilters"><SlidersHorizontal size={16} aria-hidden="true" />{(["TODOS", "ABIERTOS", "CERRADOS"] as FiltroPeriodo[]).map((opcion) => <button key={opcion} type="button" aria-pressed={filtro === opcion} onClick={() => setFiltro(opcion)}>{opcion === "TODOS" ? "Todos" : opcion === "ABIERTOS" ? "Abiertos" : "Cerrados"}</button>)}</div>
      </div>
      {periodos.length === 0 ? <div className="nomina-operationEmpty"><CalendarRange size={32} /><h2>Aún no hay períodos</h2><p>Crea el primer ciclo semanal desde el botón superior.</p></div> : visibles.length === 0 ? <div className="nomina-operationEmpty"><Search size={32} /><h2>No encontramos ciclos</h2><p>Prueba con otro año, fecha o estado.</p></div> : <div className="nomina-periodsGrid">{visibles.map((periodo) => { const saldo = Math.max(periodo.neto - periodo.pagado, 0); return <button type="button" className="nomina-periodTile" key={periodo.id} onClick={(event) => abrir("detalle", event, periodo.id)}><div className="nomina-periodTileTop"><span className={periodo.estado === "ABIERTO" ? "nomina-operationBadge is-open" : "nomina-operationBadge is-closed"}>{periodo.estado === "ABIERTO" ? "Abierto" : "Cerrado"}</span><ArrowUpRight size={17} /></div><h3>{periodo.desde} → {periodo.hasta}</h3><p>{periodo.etiqueta} · Pago {periodo.fechaPago ?? periodo.hasta}</p><div className="nomina-periodNumbers"><span>Empleados<strong>{periodo.empleados}</strong></span><span>Neto<strong>{formatCOP(periodo.neto)}</strong></span></div><footer><span>Pagado {formatCOP(periodo.pagado)}</span><strong>{saldo ? `${formatCOP(saldo)} pendiente` : "Al día"}</strong></footer></button>; })}</div>}
      {modal ? <ModalFlip origen={modal.origen} onClose={() => setModal(null)} ariaLabel={modal.tipo === "nuevo" ? "Crear ciclo de pago" : "Detalle del período"} animacion="suave" panelClassName="nomina-operationModal nomina-periodModal">{(cerrar) => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">{modal.tipo === "nuevo" ? "NUEVO CICLO" : `PERÍODO #${seleccionado?.id}`}</p><h2>{modal.tipo === "nuevo" ? "Crear ciclo de pago" : `${seleccionado?.desde} → ${seleccionado?.hasta}`}</h2></div><button type="button" aria-label="Cerrar detalle" onClick={cerrar}><X size={20} /></button></header><div className="nomina-operationModalBody">{modal.tipo === "nuevo" ? <FormularioCrearPeriodo onSuccess={cerrar} /> : seleccionado ? <><div className="nomina-periodDetailStatus"><span>{seleccionado.estado === "ABIERTO" ? <Clock3 size={17} /> : <CheckCircle2 size={17} />}{seleccionado.estado === "ABIERTO" ? "Ciclo abierto" : "Ciclo cerrado"}</span><small>Pago previsto {seleccionado.fechaPago ?? seleccionado.hasta}</small></div><div className="nomina-periodDetailStats"><div><span>Empleados</span><strong>{seleccionado.empleados}</strong></div><div><span>Pago base + extras</span><strong>{formatCOP(seleccionado.devengado)}</strong></div><div><span>Neto a pagar</span><strong>{formatCOP(seleccionado.neto)}</strong></div><div><span>Pagado</span><strong>{formatCOP(seleccionado.pagado)}</strong></div></div><div className="nomina-operationBox"><h3>Seguimiento del ciclo</h3><p>{seleccionado.neto - seleccionado.pagado > 0 ? `Queda ${formatCOP(seleccionado.neto - seleccionado.pagado)} por entregar al equipo.` : "Este ciclo está pagado al día."}</p><div className="nomina-periodDetailActions">{seleccionado.estado === "ABIERTO" ? <BotonCerrarPeriodo periodoId={seleccionado.id} onSuccess={cerrar} /> : <BotonAbrirPeriodo periodoId={seleccionado.id} onSuccess={cerrar} />}<Link className="nomina-operationPrimary" href="/admin/nomina/pagos">Abrir pagos <ArrowUpRight size={16} /></Link></div></div></> : null}</div></>}</ModalFlip> : null}
    </div>
  );
}
