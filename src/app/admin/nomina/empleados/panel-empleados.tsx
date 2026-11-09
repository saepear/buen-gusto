"use client";

import { useState, type ComponentProps, type MouseEvent } from "react";
import { ArrowUpRight, CalendarDays, Mailbox, Phone, Plus, Search, UsersRound, X } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { NavegacionNomina } from "../navegacion";
import { ContenidoEmpleadoPagos } from "../pagos/contenido-empleado";
import type { DatosPago } from "../pagos/datos-pago";
import { AccionActivarEmpleado, AccionActualizarContrato, AccionDesactivarEmpleado, AccionEditarEmpleado, FormularioNuevoEmpleado } from "./formularios";
import "../operaciones.css";
import "../directorio-reportes.css";

type EmpleadoPerfil = {
  id: number; nombre: string; cargo: string; estado: string; documento: string;
  ingreso: string; retiro: string | null; motivo: string | null;
  contacto: ComponentProps<typeof AccionEditarEmpleado>["empleado"];
  contrato: ComponentProps<typeof AccionActualizarContrato>["empleado"];
  pagos: DatosPago[];
  versiones: { id: number; desde: string; hasta: string | null; motivo: string; remuneracion: string; valor: number }[];
};

export function PanelEmpleados({ empleados }: { empleados: EmpleadoPerfil[] }) {
  const [buscar, setBuscar] = useState("");
  const [filtro, setFiltro] = useState("ACTIVO");
  const [tab, setTab] = useState("Perfil");
  const [modal, setModal] = useState<{ id: number | null; origen: OrigenModal } | null>(null);
  const seleccionado = empleados.find(e => e.id === modal?.id);
  const visibles = empleados.filter(e => (filtro === "TODOS" || e.estado === filtro) && `${e.nombre} ${e.cargo} ${e.documento}`.toLocaleLowerCase("es").includes(buscar.toLocaleLowerCase("es")));
  function abrir(event: MouseEvent<HTMLButtonElement>, id: number | null) {
    const r = event.currentTarget.getBoundingClientRect();
    setTab("Perfil"); setModal({ id, origen: { x: r.x, y: r.y, w: r.width, h: r.height } });
  }
  return <div className="nomina-operations">
    <header className="nomina-operationHero"><div className="nomina-operationTitle"><span className="nomina-operationIcon"><UsersRound /></span><div><p className="nomina-operationEyebrow">LAS PERSONAS DE LA CASA</p><h1>Tu equipo</h1><p>Contacto, acuerdo de pago e historial de cada persona.</p></div></div><button className="nomina-operationPrimary" onClick={e => abrir(e, null)}><Plus size={17} /> Nuevo empleado</button></header>
    <NavegacionNomina actual="/admin/nomina/empleados" />
    <div className="nomina-directoryIntro"><span><b>{empleados.filter(e => e.estado === "ACTIVO").length}</b> activos</span><span><b>{empleados.filter(e => e.estado !== "ACTIVO").length}</b> retirados · historial conservado</span></div>
    <div className="nomina-operationToolbar"><label><Search size={18} /><input aria-label="Buscar empleado" placeholder="Nombre, documento o cargo…" value={buscar} onChange={e => setBuscar(e.target.value)} /></label><div className="nomina-operationFilters">{[["ACTIVO", "Activos"], ["INACTIVO", "Retirados"], ["TODOS", "Todos"]].map(([id, label]) => <button key={id} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{label}</button>)}</div></div>
    <div className="nomina-operationGrid">{visibles.map(e => <button key={e.id} className="nomina-operationTile" onClick={event => abrir(event, e.id)}><div className="nomina-tileHeading"><span className="nomina-operationAvatar">{e.contacto.nombre[0]}{e.contacto.apellidos[0]}</span><span className="nomina-operationBadge">{e.estado === "ACTIVO" ? "Activo" : "Retirado"}</span><ArrowUpRight size={17} /></div><h2>{e.nombre}</h2><p>{e.cargo}</p><p className="nomina-tilePeriod">{e.documento}</p><footer><span>{e.pagos.length} ciclos en su expediente</span><span>Ver perfil →</span></footer></button>)}</div>
    {!visibles.length && <div className="nomina-operationEmpty"><UsersRound size={32} /><h2>No hay empleados en esta vista</h2><p>Prueba otro filtro o registra una nueva persona.</p></div>}
    {modal && <ModalFlip origen={modal.origen} onClose={() => setModal(null)} animacion="suave" ariaLabel={seleccionado ? `Perfil de ${seleccionado.nombre}` : "Nuevo empleado"} panelClassName="nomina-operationModal nomina-paymentModal">{cerrar => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">EXPEDIENTE DEL EQUIPO</p><h2>{seleccionado?.nombre ?? "Nuevo empleado"}</h2></div><button aria-label="Cerrar perfil" onClick={cerrar}><X size={20} /></button></header><div className="nomina-operationModalBody">{seleccionado ? <>
      <div className="nomina-profileTabs" role="group" aria-label="Secciones del perfil">{["Perfil", "Pagos", "Acuerdo e historial", "Gestionar"].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Perfil" && <div className="nomina-profileLayout"><section className="nomina-profileIdentity"><span className="nomina-profileAvatar">{seleccionado.contacto.nombre[0]}{seleccionado.contacto.apellidos[0]}</span><h3>{seleccionado.cargo}</h3><p>{seleccionado.documento}</p><span className="nomina-operationBadge">{seleccionado.estado === "ACTIVO" ? "En el equipo" : "Retirado"}</span></section><div className="nomina-profileFacts">{[[Phone, "Teléfono", seleccionado.contacto.telefono ?? "Sin registrar"], [Mailbox, "Dirección", seleccionado.contacto.direccion ?? "Sin registrar"], [CalendarDays, "Ingreso", seleccionado.ingreso], [CalendarDays, "Retiro", seleccionado.retiro ?? "Sigue en el equipo"]].map(([Icon, label, value]) => { const I = Icon as typeof Phone; return <div key={String(label)}><I size={18} /><span>{String(label)}<strong>{String(value)}</strong></span></div>; })}</div></div>}
      {tab === "Pagos" && (seleccionado.pagos.length ? <ContenidoEmpleadoPagos pagos={seleccionado.pagos} /> : <div className="nomina-operationEmpty"><h2>Aún no tiene pagos preparados</h2><p>Sus ciclos y comprobantes aparecerán aquí.</p></div>)}
      {tab === "Acuerdo e historial" && <><div className="nomina-profileAgreement"><span>Remuneración {seleccionado.contrato.remuneracion === "DIARIO" ? "por día" : seleccionado.contrato.remuneracion === "HORARIO" ? "por hora" : "mensual"}<strong>{formatCOP(seleccionado.contrato.remuneracion === "DIARIO" ? seleccionado.contrato.salarioDiario : seleccionado.contrato.remuneracion === "HORARIO" ? seleccionado.contrato.valorHora : seleccionado.contrato.salarioMensual)}</strong></span><span>Método habitual<strong>{seleccionado.contrato.metodoPago}</strong></span></div><h3 className="nomina-sectionTitle">Historial de acuerdos</h3>{seleccionado.versiones.map(v => <article className="nomina-profileVersion" key={v.id}><div><strong>{v.desde} → {v.hasta ?? "Vigente"}</strong><p>{v.motivo}</p></div><b>{formatCOP(v.valor)}</b></article>)}</>}
      {tab === "Gestionar" && <div className="nomina-profileManagement"><AccionEditarEmpleado empleado={seleccionado.contacto} />{seleccionado.estado === "ACTIVO" ? <><AccionActualizarContrato empleado={seleccionado.contrato} /><section className="nomina-operationBox"><h3>Retiro del equipo</h3><p>La baja conserva sus pagos y comprobantes. Dejará de entrar en nuevos ciclos.</p><AccionDesactivarEmpleado empleadoId={seleccionado.id} nombre={seleccionado.nombre} /></section></> : <section className="nomina-operationBox"><h3>Empleado retirado</h3><p>{seleccionado.motivo}</p><AccionActivarEmpleado empleadoId={seleccionado.id} /></section>}</div>}
    </> : <FormularioNuevoEmpleado dentroModal />}</div></>}</ModalFlip>}
  </div>;
}
