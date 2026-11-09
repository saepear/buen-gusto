"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import { Banknote, Search, ArrowUpRight, X, CheckCircle2, Wallet, Clock3 } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { NavegacionNomina } from "../navegacion";
import { ContenidoEmpleadoPagos } from "./contenido-empleado";
import type { DatosPago } from "./datos-pago";
import "../operaciones.css";

type GrupoEmpleado = { empleadoId: number; empleado: DatosPago["empleado"]; pagos: DatosPago[] };

function estaCompleto(pago: DatosPago) {
  return pago.netoAPagar > 0 && pago.pagado >= pago.netoAPagar;
}

export function PanelPagos({ pagos }: { pagos: DatosPago[] }) {
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("PENDIENTES");
  const [seleccion, setSeleccion] = useState<{ empleadoId: number; origen: OrigenModal } | null>(null);
  const gruposMap = new Map<number, GrupoEmpleado>();
  for (const pago of pagos) {
    const grupo = gruposMap.get(pago.empleadoId);
    if (grupo) grupo.pagos.push(pago);
    else gruposMap.set(pago.empleadoId, { empleadoId: pago.empleadoId, empleado: pago.empleado, pagos: [pago] });
  }
  const grupos = [...gruposMap.values()].sort((a, b) => `${a.empleado.nombre} ${a.empleado.apellidos}`.localeCompare(`${b.empleado.nombre} ${b.empleado.apellidos}`, "es"));
  const pendientes = pagos.filter((pago) => pago.netoAPagar > pago.pagado);
  const completos = pagos.filter(estaCompleto);
  const termino = buscar.toLocaleLowerCase("es");
  const visibles = grupos.filter((grupo) => {
    const coincideTexto = `${grupo.empleado.nombre} ${grupo.empleado.apellidos} ${grupo.empleado.cargo} ${grupo.pagos.map((pago) => `${pago.periodo.fechaDesde} ${pago.periodo.fechaHasta}`).join(" ")}`.toLocaleLowerCase("es").includes(termino);
    const tienePendiente = grupo.pagos.some((pago) => !estaCompleto(pago));
    const tieneCompleto = grupo.pagos.some(estaCompleto);
    return coincideTexto && (filtro === "TODOS" || (filtro === "PENDIENTES" ? tienePendiente : tieneCompleto));
  });
  function abrir(grupo: GrupoEmpleado, event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setSeleccion({ empleadoId: grupo.empleadoId, origen: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
  }
  const seleccionado = grupos.find((grupo) => grupo.empleadoId === seleccion?.empleadoId);

  return <div className="nomina-operations">
    <header className="nomina-operationHero"><div className="nomina-operationTitle"><span className="nomina-operationIcon"><Banknote /></span><div><p className="nomina-operationEyebrow">EQUIPO · PAGOS SEMANALES</p><h1>Pagos del equipo</h1><p>Un expediente por empleado con todos sus ciclos y comprobantes.</p></div></div><Link href="/admin/nomina" className="nomina-operationSecondary">Volver al resumen <ArrowUpRight size={16} /></Link></header>
    <NavegacionNomina actual="/admin/nomina/pagos" />
    <div className="nomina-operationStats"><article><Wallet /><span>Por entregar<strong>{formatCOP(pendientes.reduce((sum, pago) => sum + Math.max(pago.netoAPagar - pago.pagado, 0), 0))}</strong></span></article><article><Clock3 /><span>Ciclos pendientes<strong>{pendientes.length}</strong></span></article><article><CheckCircle2 /><span>Pagos completos<strong>{completos.length}</strong></span></article></div>
    <div className="nomina-operationToolbar"><label><Search size={18} /><input aria-label="Buscar empleado" placeholder="Buscar empleado, cargo o ciclo…" value={buscar} onChange={(event) => setBuscar(event.target.value)} /></label><div className="nomina-operationFilters">{[["PENDIENTES", "Por pagar"], ["PAGADOS", "Pagados"], ["TODOS", "Todos"]].map(([valor, etiqueta]) => <button type="button" key={valor} aria-pressed={filtro === valor} onClick={() => setFiltro(valor)}>{etiqueta}</button>)}</div></div>
    <div className="nomina-operationGrid">{visibles.map((grupo) => { const tienePendiente = grupo.pagos.some((pago) => !estaCompleto(pago)); const entregado = grupo.pagos.reduce((sum, pago) => sum + pago.pagado, 0); const saldo = grupo.pagos.reduce((sum, pago) => sum + Math.max(pago.netoAPagar - pago.pagado, 0), 0); return <button className="nomina-operationTile" type="button" key={grupo.empleadoId} onClick={(event) => abrir(grupo, event)}><div className="nomina-tileHeading"><span className="nomina-operationAvatar">{grupo.empleado.nombre[0]}{grupo.empleado.apellidos[0]}</span><span className="nomina-operationBadge">{tienePendiente ? (entregado > 0 ? "Pago parcial" : "Por entregar") : "Pagado"}</span><ArrowUpRight size={18} /></div><h2>{grupo.empleado.nombre} {grupo.empleado.apellidos}</h2><p>{grupo.empleado.cargo}</p><p className="nomina-tilePeriod">{grupo.pagos.length} {grupo.pagos.length === 1 ? "ciclo registrado" : "ciclos registrados"}</p><footer><span>{tienePendiente ? "Saldo pendiente" : "Total entregado"}<strong>{formatCOP(tienePendiente ? saldo : entregado)}</strong></span><span>Ver expediente →</span></footer></button>; })}</div>
    {!visibles.length && <div className="nomina-operationEmpty"><CheckCircle2 size={32} /><h2>No hay empleados en esta vista</h2><p>Cambia el filtro o selecciona otro ciclo desde el resumen de Nómina.</p></div>}
    {seleccionado && <ModalFlip origen={seleccion!.origen} onClose={() => setSeleccion(null)} ariaLabel={`Expediente de pagos de ${seleccionado.empleado.nombre}`} animacion="suave" panelClassName="nomina-operationModal nomina-paymentModal">{(cerrar) => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">EXPEDIENTE DE PAGOS</p><h2>{seleccionado.empleado.nombre} {seleccionado.empleado.apellidos}</h2></div><button type="button" aria-label="Cerrar expediente" onClick={cerrar}><X size={20} /></button></header><div className="nomina-operationModalBody"><ContenidoEmpleadoPagos pagos={seleccionado.pagos} /></div></>}</ModalFlip>}
  </div>;
}
