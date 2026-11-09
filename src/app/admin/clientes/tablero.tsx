"use client";

import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  CreditCard,
  FileText,
  History,
  MapPin,
  Merge,
  PackageOpen,
  Phone,
  SearchX,
  Truck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP, formatHora } from "@/lib/format";
import { AccionesDuplicados } from "./[clienteId]/acciones-ficha";
import { FormularioEditarCliente } from "./[clienteId]/editar";
import { obtenerDetalleCliente, type DetalleClienteModal } from "./actions";

type ClienteTarjeta = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  createdAt: string;
  domicilios: number;
  apartados: number;
  deuda: { cuentas: number; saldo: number } | null;
  ordinal: number;
  fichaBuscada: boolean;
};

const METODOS: Record<string, string> = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia" };
const ESTADOS_DOMICILIO: Record<string, string> = { PENDIENTE: "Pendiente", ASIGNADO: "Asignado", EN_CAMINO: "En camino", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" };
const ESTADOS_APARTADO: Record<string, string> = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", CANCELADO: "Cancelado" };
const ESTADOS_CUENTA: Record<string, string> = { PENDIENTE: "Pendiente", PAGADA: "Pagada", ANULADA: "Anulada", CONDONADA: "Condonada" };

export function TableroClientes({ clientes }: { clientes: ClienteTarjeta[] }) {
  const [seleccion, setSeleccion] = useState<{ cliente: ClienteTarjeta; origen: OrigenModal } | null>(null);
  const [detalle, setDetalle] = useState<DetalleClienteModal | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!seleccion) return;
    let vivo = true;
    obtenerDetalleCliente(seleccion.cliente.id).then((resultado) => {
      if (!vivo) return;
      setDetalle(resultado);
      setError(!resultado);
      setCargando(false);
    }).catch(() => {
      if (!vivo) return;
      setError(true);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [seleccion]);

  return <>
    <div className="clientes-board-grid" aria-label="Fichas de clientes">
      {clientes.map((cliente) => <FichaCliente key={cliente.id} cliente={cliente} onOpen={(origen) => { setDetalle(null); setError(false); setCargando(true); setSeleccion({ cliente, origen }); }} />)}
    </div>
    {seleccion ? <ModalFlip rapida origen={seleccion.origen} ariaLabel={`Ficha de ${seleccion.cliente.nombre}`} onClose={() => setSeleccion(null)}>
      {cerrar => <>
        <header className="clientes-modal-header" data-anim>
          <span className="clientes-modal-avatar">{seleccion.cliente.nombre.trim().charAt(0).toUpperCase() || "·"}</span>
          <div className="clientes-modal-title"><p className="clientes-eyebrow">FICHA DE CLIENTE · N.º {seleccion.cliente.ordinal}</p><h2>{seleccion.cliente.nombre}</h2><p>{seleccion.cliente.telefono || "Sin teléfono registrado"}</p></div>
          <button type="button" className="clientes-modal-close" aria-label={`Cerrar ficha de ${seleccion.cliente.nombre}`} onClick={cerrar}><X aria-hidden size={19} /></button>
        </header>
        <div className="clientes-modal-body" data-anim>
          {cargando ? <ClienteModalSkeleton /> : error || !detalle ? <div className="clientes-modal-error"><SearchX aria-hidden size={28} /><p>No se pudo cargar la ficha completa.</p><button type="button" onClick={cerrar}>Cerrar</button></div> : <ClienteModalDetalle detalle={detalle} cerrar={cerrar} />}
        </div>
        <footer className="clientes-modal-footer" data-anim><span>{detalle ? `Cliente desde ${new Date(detalle.cliente.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}` : "Cargando ficha…"}</span><button type="button" onClick={cerrar}>Listo <Check aria-hidden size={16} /></button></footer>
      </>}
    </ModalFlip> : null}
  </>;
}

function FichaCliente({ cliente, onOpen }: { cliente: ClienteTarjeta; onOpen: (origen: OrigenModal) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const inicial = cliente.nombre.trim().charAt(0).toUpperCase() || "·";
  const abrir = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) onOpen({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  };

  return <button ref={trigger} type="button" className="clientes-card" onClick={abrir} aria-haspopup="dialog">
    <span className="clientes-card-top"><span className="clientes-card-avatar">{inicial}</span><span className="clientes-card-arrow"><ArrowUpRight aria-hidden size={18} /></span></span>
    <span className="clientes-card-heading"><strong>{cliente.nombre}</strong><span>N.º {cliente.ordinal}{cliente.fichaBuscada ? ` · Ficha #${cliente.id}` : ""}</span></span>
    <span className="clientes-card-since">Cliente desde {new Date(cliente.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
    <span className="clientes-card-contact">{cliente.telefono ? <><Phone aria-hidden size={14} /> {cliente.telefono}</> : <><UserRound aria-hidden size={14} /> Cliente sin teléfono</>}</span>
    <span className="clientes-card-contact">{cliente.direccion ? <><MapPin aria-hidden size={14} /> {cliente.direccion}{cliente.barrio ? ` · ${cliente.barrio}` : ""}</> : <><MapPin aria-hidden size={14} /> Sin dirección registrada</>}</span>
    <span className="clientes-card-metrics"><span><Truck aria-hidden size={13} /> {cliente.domicilios}</span><span><CalendarDays aria-hidden size={13} /> {cliente.apartados}</span>{cliente.deuda?.cuentas ? <span className={cliente.deuda.saldo > 0 ? "is-debt" : ""}><CircleDollarSign aria-hidden size={13} /> {formatCOP(Math.max(0, cliente.deuda.saldo))}</span> : null}</span>
    <span className="clientes-card-footer">Ver ficha completa <ArrowUpRight aria-hidden size={14} /></span>
  </button>;
}

function ClienteModalDetalle({ detalle, cerrar }: { detalle: DetalleClienteModal; cerrar: () => void }) {
  const { cliente } = detalle;
  const datosFicha = { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono, direccion: cliente.direccion, barrio: cliente.barrio, observaciones: cliente.observaciones };
  const tieneHistorial = detalle.domicilios.length > 0 || detalle.apartados.length > 0 || detalle.cuentas.length > 0 || detalle.fusiones.length > 0;

  return <div className="clientes-modal-content">
    <section className="clientes-profile-panel">
      <div className="clientes-profile-main"><div className="clientes-profile-line"><Phone aria-hidden size={16} /><span>{cliente.telefono || "Sin teléfono registrado"}</span></div><div className="clientes-profile-line"><MapPin aria-hidden size={16} /><span>{cliente.direccion ? `${cliente.direccion}${cliente.barrio ? ` · ${cliente.barrio}` : ""}` : "Sin dirección registrada"}</span></div>{cliente.observaciones ? <div className="clientes-profile-note"><FileText aria-hidden size={14} /> «{cliente.observaciones}»</div> : null}</div><FormularioEditarCliente cliente={datosFicha} />
    </section>

    <section className="clientes-summary-grid" aria-label="Resumen de la ficha">
      <ResumenMetrica icono={Truck} etiqueta="Domicilios" valor={detalle.domicilios.length} color="success" />
      <ResumenMetrica icono={CalendarDays} etiqueta="Apartados" valor={detalle.apartados.length} color="info" />
      <ResumenMetrica icono={CircleDollarSign} etiqueta="Fiado pendiente" valor={formatCOP(detalle.saldoFiado)} color={detalle.saldoFiado > 0 ? "danger" : "success"} />
    </section>

    <div className="clientes-history-grid">
      <HistorialFiados cuentas={detalle.cuentas} />
      <HistorialApartados apartados={detalle.apartados} />
      <HistorialDomicilios domicilios={detalle.domicilios} />
    </div>

    {detalle.fusiones.length > 0 ? <section className="clientes-modal-section"><SectionHeading icono={Merge} titulo="Historial de fusiones" cantidad={detalle.fusiones.length} /><ul className="clientes-fusion-list">{detalle.fusiones.map((fusion) => <li key={fusion.id}>Ficha #{fusion.origenId} · {fusion.origenNombre}{fusion.origenTelefono ? ` · ${fusion.origenTelefono}` : ""}<small>{fusion.domicilios} domicilios, {fusion.apartados} apartados y {fusion.cuentas} deudas movidas · {fusion.hechoPor}</small></li>)}</ul></section> : null}

    <AccionesDuplicados clienteId={cliente.id} nombre={cliente.nombre} telefono={cliente.telefono} tieneHistorial={tieneHistorial} />
    <div className="clientes-modal-actions"><Link href={`/admin/clientes/${cliente.id}`} className="clientes-detail-link"><History aria-hidden size={16} /> Abrir ficha completa <ArrowUpRight aria-hidden size={15} /></Link><Link href={`/admin/cuentas?clienteId=${cliente.id}&nuevo=1`} className="clientes-credit-link"><CircleDollarSign aria-hidden size={16} /> Gestionar fiados</Link><button type="button" className="clientes-secondary-button" onClick={cerrar}>Cerrar ficha</button></div>
  </div>;
}

function ResumenMetrica({ icono: Icono, etiqueta, valor, color }: { icono: LucideIcon; etiqueta: string; valor: number | string; color: "success" | "info" | "danger" }) {
  return <div className={`clientes-summary-metric is-${color}`}><Icono aria-hidden size={17} /><span><small>{etiqueta}</small><strong>{valor}</strong></span></div>;
}

function SectionHeading({ icono: Icono, titulo, cantidad }: { icono: LucideIcon; titulo: string; cantidad: number }) {
  return <div className="clientes-section-heading"><span><Icono aria-hidden size={16} /><strong>{titulo}</strong></span><b>{cantidad}</b></div>;
}

function HistorialFiados({ cuentas }: { cuentas: DetalleClienteModal["cuentas"] }) {
  return <section className="clientes-modal-section"><SectionHeading icono={CreditCard} titulo="Fiados" cantidad={cuentas.length} />{cuentas.length === 0 ? <EmptyHistory texto="Sin deudas registradas" /> : <div className="clientes-history-list">{cuentas.slice(0, 6).map((cuenta) => { const saldo = Math.max(0, cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado); return <article key={cuenta.id} className="clientes-history-item"><div className="clientes-history-item-top"><strong>{cuenta.concepto}</strong><span className={`clientes-status is-${cuenta.estado.toLowerCase()}`}>{ESTADOS_CUENTA[cuenta.estado] ?? cuenta.estado}</span></div><p>Deuda {formatCOP(cuenta.valorOriginal)} · abonado {formatCOP(cuenta.pagado)}{saldo > 0 ? ` · saldo ${formatCOP(saldo)}` : ""}</p>{cuenta.abonos.length > 0 ? <small>Último abono: {formatCOP(cuenta.abonos[cuenta.abonos.length - 1].monto)} · {METODOS[cuenta.abonos[cuenta.abonos.length - 1].metodo] ?? cuenta.abonos[cuenta.abonos.length - 1].metodo}</small> : <small>Registrado por {cuenta.creadoPor}</small>}</article>; })}</div>}</section>;
}

function HistorialApartados({ apartados }: { apartados: DetalleClienteModal["apartados"] }) {
  return <section className="clientes-modal-section"><SectionHeading icono={CalendarDays} titulo="Apartados" cantidad={apartados.length} />{apartados.length === 0 ? <EmptyHistory texto="Sin apartados registrados" /> : <div className="clientes-history-list">{apartados.slice(0, 6).map((apartado) => <article key={apartado.id} className="clientes-history-item"><div className="clientes-history-item-top"><strong>#{apartado.id} · {formatCOP(apartado.total)}</strong><span className={`clientes-status is-${apartado.estado.toLowerCase()}`}>{ESTADOS_APARTADO[apartado.estado] ?? apartado.estado}</span></div><p>{apartado.fechaEntrega ? `Para ${apartado.fechaEntrega}` : "Sin fecha de entrega"}{apartado.horaEntrega ? ` · ${apartado.horaEntrega}` : ""}</p><small>{apartado.items.slice(0, 2).map((item) => `${item.cantidad > 1 ? `${item.cantidad}× ` : ""}${item.nombre}`).join(" · ") || "Sin productos detallados"}</small></article>)}</div>}</section>;
}

function HistorialDomicilios({ domicilios }: { domicilios: DetalleClienteModal["domicilios"] }) {
  return <section className="clientes-modal-section clientes-history-wide"><SectionHeading icono={Truck} titulo="Domicilios" cantidad={domicilios.length} />{domicilios.length === 0 ? <EmptyHistory texto="Sin domicilios registrados" /> : <div className="clientes-history-list">{domicilios.slice(0, 8).map((domicilio) => <article key={domicilio.id} className="clientes-history-item"><div className="clientes-history-item-top"><strong>{domicilio.direccion}{domicilio.barrio ? ` · ${domicilio.barrio}` : ""}</strong><span className={`clientes-status is-${domicilio.estado.toLowerCase()}`}>{ESTADOS_DOMICILIO[domicilio.estado] ?? domicilio.estado}</span></div><p>{new Date(domicilio.createdAt).toLocaleDateString("es-CO")} · {formatHora(new Date(domicilio.createdAt))}{domicilio.cobradoMonto !== null ? ` · ${formatCOP(domicilio.cobradoMonto)}` : " · Pendiente de cobro"}</p>{domicilio.notaEntrega ? <small>Nota: {domicilio.notaEntrega}</small> : null}</article>)}</div>}</section>;
}

function EmptyHistory({ texto }: { texto: string }) { return <div className="clientes-history-empty"><PackageOpen aria-hidden size={19} /><span>{texto}</span></div>; }

function ClienteModalSkeleton() { return <div className="clientes-modal-skeleton" aria-label="Cargando ficha"><span /><span /><span /><span /><span /></div>; }
