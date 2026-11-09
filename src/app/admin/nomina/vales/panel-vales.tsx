"use client";
import { useState, type MouseEvent } from "react";
import { Ticket, Plus, X, Search, ArrowUpRight, Wallet, CheckCircle2, Clock3 } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { NavegacionNomina } from "../navegacion";
import { FormularioRegistroVale, type PropsRegistroVale } from "./formularios";
import { AccionesVale } from "./formularios-acciones";
import "../operaciones.css";

type Vale = { id: number; empleado: string; empleadoId: number; productoNombre: string; cantidad: number; precioUnitario: number; total: number; fecha: string; estado: string; observaciones: string | null; anuladoMotivo: string | null; autorizadoPor: string | null; ciclo: string };
const estados: Record<string,string> = { PENDIENTE:"Por autorizar", AUTORIZADO:"Por descontar", DESCONTADO:"Descontado", ANULADO:"Anulado" };
export function PanelVales({ vales, formulario }: { vales: Vale[]; formulario: PropsRegistroVale }) {
  const [buscar,setBuscar] = useState("");
  const [filtro,setFiltro] = useState("TODOS");
  const [modal,setModal] = useState<{ id: number | "nuevo"; origen: OrigenModal } | null>(null);
  const elegido = vales.find(v => v.id === modal?.id);
  function abrir(id: number | "nuevo", e: MouseEvent<HTMLButtonElement>) { const r=e.currentTarget.getBoundingClientRect(); setModal({ id, origen:{ x:r.x,y:r.y,w:r.width,h:r.height } }); }
  const visibles = vales.filter(v => `${v.empleado} ${v.productoNombre}`.toLocaleLowerCase("es").includes(buscar.toLocaleLowerCase("es")) && (filtro === "TODOS" || v.estado === filtro));
  return <div className="nomina-operations">
    <header className="nomina-operationHero"><div className="nomina-operationTitle"><span className="nomina-operationIcon"><Ticket /></span><div><p className="nomina-operationEyebrow">EQUIPO · A CUENTA DEL SUELDO</p><h1>Vales y consumos</h1><p>Dinero prestado y productos entregados, con su descuento a la vista.</p></div></div><button className="nomina-operationPrimary" type="button" onClick={e => abrir("nuevo",e)}><Plus size={18} />Registrar vale</button></header>
    <NavegacionNomina actual="/admin/nomina/vales" />
    <div className="nomina-operationStats">{[["PENDIENTE","Por autorizar",Clock3],["AUTORIZADO","Por descontar",Wallet],["DESCONTADO","Ya descontado",CheckCircle2]].map(([estado,titulo,Icon]) => { const I=Icon as typeof Clock3; return <article key={String(estado)}><I /><span>{String(titulo)}<strong>{formatCOP(vales.filter(v => v.estado === estado).reduce((s,v) => s+v.total,0))}</strong></span></article>; })}</div>
    <div className="nomina-operationToolbar"><label><Search size={18} /><input aria-label="Buscar vale" placeholder="Buscar empleado o consumo…" value={buscar} onChange={e => setBuscar(e.target.value)} /></label><div className="nomina-operationFilters">{[["TODOS","Todos"],...Object.entries(estados)].map(([v,t]) => <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{t}</button>)}</div></div>
    <div className="nomina-operationGrid">{visibles.map(v => <button className="nomina-operationTile" type="button" key={v.id} onClick={e => abrir(v.id,e)}><div className="nomina-tileHeading"><span className="nomina-operationAvatar"><Ticket size={20} /></span><span className="nomina-operationBadge">{estados[v.estado] ?? v.estado}</span><ArrowUpRight size={18} /></div><h2>{v.empleado}</h2><p>{v.productoNombre} · {v.cantidad} unidad{v.cantidad !== 1 ? "es" : ""}</p><p className="nomina-tilePeriod">{v.fecha} · Vale #{v.id}</p><footer><span>A cuenta del sueldo<strong>{formatCOP(v.total)}</strong></span><span>Ver detalle →</span></footer></button>)}</div>
    {!visibles.length && <div className="nomina-operationEmpty"><Ticket size={32} /><h2>No hay vales en esta vista</h2><p>Registra dinero o un producto con el botón Registrar vale.</p></div>}
    <p className="mt-4 text-xs text-texto-muted">Se muestran hasta 200 registros recientes que coinciden con los filtros de la consulta.</p>
    {modal && <ModalFlip origen={modal.origen} onClose={() => setModal(null)} ariaLabel={modal.id === "nuevo" ? "Registrar vale" : "Detalle del vale"} animacion="suave" panelClassName="nomina-operationModal">{cerrar => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">{modal.id === "nuevo" ? "NUEVO VALE" : `VALE #${elegido?.id}`}</p><h2>{modal.id === "nuevo" ? "Una entrega, un registro" : elegido?.empleado}</h2></div><button type="button" aria-label="Cerrar vale" onClick={cerrar}><X size={20} /></button></header><div className="nomina-operationModalBody">{modal.id === "nuevo" ? <FormularioRegistroVale {...formulario} onSuccess={cerrar} /> : elegido && <><div className="nomina-operationBox"><h3>{elegido.productoNombre}</h3><p>{elegido.cantidad} × {formatCOP(elegido.precioUnitario)} · {elegido.fecha}</p><div className="nomina-moneyPair"><strong>{formatCOP(elegido.total)}</strong><span>{estados[elegido.estado]}</span></div><p>{elegido.ciclo}</p>{elegido.observaciones && <p>{elegido.observaciones}</p>}{elegido.autorizadoPor && <p>Autorizado por {elegido.autorizadoPor}</p>}{elegido.anuladoMotivo && <p>Motivo: {elegido.anuladoMotivo}</p>}</div><AccionesVale valeId={elegido.id} estado={elegido.estado} /></>}</div></>}</ModalFlip>}
  </div>;
}
