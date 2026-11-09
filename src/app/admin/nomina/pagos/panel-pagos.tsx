"use client";
import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { Banknote, Search, ArrowUpRight, X, CheckCircle2, Wallet, Clock3 } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { NavegacionNomina } from "../navegacion";
import { ContenidoPago } from "./contenido-pago";
import type { DatosPago } from "./datos-pago";
import "../operaciones.css";

export function PanelPagos({ pagos }: { pagos: DatosPago[] }) {
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("PENDIENTES");
  const [seleccion, setSeleccion] = useState<{ id: number; origen: OrigenModal } | null>(null);
  const seleccionado = pagos.find(p => p.id === seleccion?.id);
  // El estado BORRADOR describe la preparación de la liquidación, no si falta
  // dinero. La vista de pagos debe usar el saldo real para no mostrar como
  // pendientes liquidaciones que ya fueron entregadas completas.
  const pendientes = pagos.filter(p => p.netoAPagar > p.pagado);
  const completos = pagos.filter(p => p.netoAPagar > 0 && p.pagado >= p.netoAPagar);
  const visibles = pagos.filter(p => `${p.empleado.nombre} ${p.empleado.apellidos} ${p.empleado.cargo} ${p.periodo.fechaDesde} ${p.periodo.fechaHasta}`.toLocaleLowerCase("es").includes(buscar.toLocaleLowerCase("es")) && (filtro === "TODOS" || (filtro === "PENDIENTES" ? pendientes.includes(p) : completos.includes(p))));
  function abrir(id: number, e: MouseEvent<HTMLButtonElement>) { const r = e.currentTarget.getBoundingClientRect(); setSeleccion({ id, origen: { x: r.x, y: r.y, w: r.width, h: r.height } }); }
  return <div className="nomina-operations">
    <header className="nomina-operationHero"><div className="nomina-operationTitle"><span className="nomina-operationIcon"><Banknote /></span><div><p className="nomina-operationEyebrow">EQUIPO · PAGOS SEMANALES</p><h1>Pagos del equipo</h1><p>Revisa, ajusta y entrega el pago desde la ficha de cada empleado.</p></div></div><Link href="/admin/nomina" className="nomina-operationSecondary">Preparar un pago <ArrowUpRight size={16} /></Link></header>
    <NavegacionNomina actual="/admin/nomina/pagos" />
    <div className="nomina-operationStats"><article><Wallet /><span>Por entregar<strong>{formatCOP(pendientes.reduce((s,p) => s + Math.max(p.netoAPagar - p.pagado, 0), 0))}</strong></span></article><article><Clock3 /><span>Pagos pendientes<strong>{pendientes.length}</strong></span></article><article><CheckCircle2 /><span>Pagos completos<strong>{completos.length}</strong></span></article></div>
    <div className="nomina-operationToolbar"><label><Search size={18} /><input aria-label="Buscar pago" placeholder="Buscar empleado, cargo o fecha…" value={buscar} onChange={e => setBuscar(e.target.value)} /></label><div className="nomina-operationFilters">{[["PENDIENTES","Por pagar"],["PAGADOS","Pagados"],["TODOS","Todos"]].map(([v,t]) => <button type="button" key={v} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{t}</button>)}</div></div>
    <div className="nomina-operationGrid">{visibles.map(p => { const completo = p.netoAPagar > 0 && p.pagado >= p.netoAPagar; return <button className="nomina-operationTile" type="button" key={p.id} onClick={e => abrir(p.id,e)}><div className="nomina-tileHeading"><span className="nomina-operationAvatar">{p.empleado.nombre[0]}{p.empleado.apellidos[0]}</span><span className="nomina-operationBadge">{completo ? "Pagado" : p.pagado > 0 ? "Pago parcial" : p.estado === "BORRADOR" ? "En preparación" : "Por entregar"}</span><ArrowUpRight size={18} /></div><h2>{p.empleado.nombre} {p.empleado.apellidos}</h2><p>{p.empleado.cargo}</p><p className="nomina-tilePeriod">{p.periodo.fechaDesde} → {p.periodo.fechaHasta}</p><footer><span>{completo ? "Total entregado" : "Pendiente"}<strong>{formatCOP(completo ? p.pagado : Math.max(p.netoAPagar-p.pagado,0))}</strong></span><span>Abrir pago →</span></footer></button>; })}</div>
    {!visibles.length && <div className="nomina-operationEmpty"><CheckCircle2 size={32} /><h2>No hay pagos en esta vista</h2><p>Cambia el filtro o prepara un pago desde el resumen de Nómina.</p></div>}
    {seleccion && seleccionado && <ModalFlip origen={seleccion.origen} onClose={() => setSeleccion(null)} ariaLabel={`Pago de ${seleccionado.empleado.nombre}`} animacion="suave" panelClassName="nomina-operationModal nomina-paymentModal">{cerrar => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">PAGO SEMANAL</p><h2>{seleccionado.empleado.nombre} {seleccionado.empleado.apellidos}</h2></div><button type="button" aria-label="Cerrar pago" onClick={cerrar}><X size={20} /></button></header><div className="nomina-operationModalBody"><ContenidoPago pago={seleccionado} /></div></>}</ModalFlip>}
  </div>;
}
