"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ChefHat, ClipboardList, CircleDollarSign, MapPin, Printer, UserRound, X } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP, formatHora } from "@/lib/format";
import { AccionesComanda } from "./botones-comanda";

export type OrdenTarjeta = {
  id: number;
  numero: number;
  mesa: string;
  mesero: string;
  estado: string;
  paraLlevar: boolean;
  createdAt: string;
  origen: string;
  cliente: string | null;
  cuenta: { estado: "PENDIENTE" | "PAGADA" | "CONDONADA" | "ANULADA"; saldo: number; total: number } | null;
  items: { id: number; nombre: string; cantidad: number; precio: number; nota: string | null; conSopa: boolean | null }[];
};

const ESTADO: Record<string, { label: string; className: string }> = {
  ENVIADO: { label: "Enviado", className: "orden-status orden-status-enviado" },
  EN_PREPARACION: { label: "En preparación", className: "orden-status orden-status-preparacion" },
  PARCIAL_SERVIDO: { label: "Parcial servido", className: "orden-status orden-status-preparacion" },
  SERVIDO: { label: "Servido", className: "orden-status orden-status-servido" },
  POR_PAGAR: { label: "Por pagar", className: "orden-status orden-status-pagar" },
  FIADO: { label: "Fiada", className: "orden-status orden-status-fiado" },
  FIADO_PENDIENTE: { label: "Fiado pendiente", className: "orden-status orden-status-fiado" },
  FIADO_PAGADO: { label: "Fiado pagado", className: "orden-status orden-status-pagado" },
  FIADO_CONDONADO: { label: "Fiado condonado", className: "orden-status orden-status-condonado" },
  COBRADO: { label: "Atendido", className: "orden-status orden-status-cobrado" },
  CANCELADO: { label: "Cancelado", className: "orden-status orden-status-cancelado" },
};

function totalDe(items: OrdenTarjeta["items"]) {
  return items.reduce((total, item) => total + item.precio * item.cantidad, 0);
}

function inicial(texto: string) {
  return texto.trim().charAt(0).toUpperCase() || "·";
}

function estadoVisible(pedido: OrdenTarjeta) {
  if (pedido.cuenta?.estado === "PENDIENTE") return ESTADO.FIADO_PENDIENTE;
  if (pedido.cuenta?.estado === "PAGADA") return ESTADO.FIADO_PAGADO;
  if (pedido.cuenta?.estado === "CONDONADA") return ESTADO.FIADO_CONDONADO;
  return ESTADO[pedido.estado] ?? { label: pedido.estado.replaceAll("_", " "), className: "orden-status" };
}

export function TableroOrdenes({ pedidos }: { pedidos: OrdenTarjeta[] }) {
  const [seleccionado, setSeleccionado] = useState<OrdenTarjeta | null>(null);
  const [origen, setOrigen] = useState<OrigenModal | null>(null);

  function abrir(pedido: OrdenTarjeta, elemento: HTMLElement) {
    const rect = elemento.getBoundingClientRect();
    setOrigen({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    setSeleccionado(pedido);
  }

  function cerrar() {
    setSeleccionado(null);
    setOrigen(null);
  }

  return (
    <>
      <div className="ordenes-grid">
        {pedidos.map((pedido) => {
          const estado = estadoVisible(pedido);
          return (
            <button key={pedido.id} type="button" onClick={(event) => abrir(pedido, event.currentTarget)} className="orden-card">
              <span className="orden-card-topline">
                <span className="orden-card-icon">{inicial(pedido.mesa)}</span>
                <span className="orden-card-heading">
                  <span className="orden-card-title">{pedido.origen}</span>
                  <span className="orden-card-meta">Comanda #{pedido.numero}{pedido.cliente ? ` · ${pedido.cliente}` : ""}</span>
                </span>
                <ArrowUpRight size={17} className="orden-card-arrow" />
              </span>
              <span className="orden-card-status-row"><span className={estado.className}>{estado.label}</span><span className="orden-card-time"><CalendarClock size={14} /> {formatHora(new Date(pedido.createdAt))}</span></span>
              <span className="orden-card-summary"><strong>{pedido.items.length} {pedido.items.length === 1 ? "producto" : "productos"}</strong><strong>{formatCOP(totalDe(pedido.items))}</strong></span>
              <span className="orden-card-footer"><span>{pedido.cuenta?.estado === "PENDIENTE" ? `Debe ${formatCOP(pedido.cuenta.saldo)}` : pedido.cuenta?.estado === "PAGADA" ? "Deuda pagada" : (pedido.cliente ?? pedido.mesero ?? "Sistema")}</span><span>Ver detalle <ArrowUpRight size={14} /></span></span>
            </button>
          );
        })}
      </div>

      {seleccionado && origen ? (
        <ModalFlip rapida origen={origen} onClose={cerrar} ariaLabel={`Detalle de comanda ${seleccionado.numero}`} panelClassName="orden-detail-panel">
          {(cerrarModal) => {
            const estado = estadoVisible(seleccionado);
            return (
              <div className="orden-detail-modal">
                <header className="orden-detail-header" data-anim>
                  <div className="orden-detail-title"><span className="orden-detail-icon"><ClipboardList size={22} /></span><div><span className="orden-eyebrow">DETALLE DE COMANDA</span><h2>{seleccionado.origen}</h2><p>Comanda #{seleccionado.numero}{seleccionado.cliente ? ` · ${seleccionado.cliente}` : ""}</p></div></div>
                  <button type="button" className="orden-modal-close" onClick={cerrarModal} aria-label="Cerrar detalle"><X size={19} /></button>
                </header>
                <div className="orden-detail-body">
                  <div className="orden-detail-hero" data-anim><div><span className="orden-eyebrow">TOTAL DE LA COMANDA</span><strong>{formatCOP(totalDe(seleccionado.items))}</strong><p>Registrada hoy a las {formatHora(new Date(seleccionado.createdAt))}</p></div><span className={estado.className}>{estado.label}</span></div>
                  <div className="orden-detail-info" data-anim><div><MapPin size={16} /><span><small>Origen</small><b>{seleccionado.origen}</b></span></div>{seleccionado.cliente ? <div><UserRound size={16} /><span><small>Cliente</small><b>{seleccionado.cliente}</b></span></div> : null}<div><ChefHat size={16} /><span><small>Responsable</small><b>{seleccionado.mesero || "Sistema"}</b></span></div></div>
                  {seleccionado.cuenta ? <section className="orden-finance-info" data-anim><CircleDollarSign size={18} /><div><span className="orden-eyebrow">HISTORIAL DE COBRO</span><h3>{seleccionado.cuenta.estado === "PAGADA" ? "Esta comanda se fió y ya fue pagada" : seleccionado.cuenta.estado === "PENDIENTE" ? "Esta comanda quedó fiada" : seleccionado.cuenta.estado === "CONDONADA" ? "La deuda de esta comanda fue condonada" : "La deuda de esta comanda fue anulada"}</h3><p>{seleccionado.cuenta.estado === "PENDIENTE" ? `Saldo pendiente: ${formatCOP(seleccionado.cuenta.saldo)} de ${formatCOP(seleccionado.cuenta.total)}.` : `Valor original de la deuda: ${formatCOP(seleccionado.cuenta.total)}.`}</p></div><span className={estado.className}>{estado.label}</span></section> : null}
                  <section className="orden-items-section" data-anim><div className="orden-section-title"><ClipboardList size={17} /><h3>Productos de la comanda</h3><span>{seleccionado.items.length}</span></div><ul className="orden-items-list">{seleccionado.items.map((item) => <li key={item.id}><span><b>{item.cantidad}× {item.nombre}</b>{item.conSopa === false ? <em>Sin sopa</em> : null}{item.nota ? <em>«{item.nota}»</em> : null}</span><strong>{formatCOP(item.precio * item.cantidad)}</strong></li>)}</ul></section>
                  <div className="orden-detail-actions" data-anim><AccionesComanda pedidoId={seleccionado.id} estado={seleccionado.estado} /><Link href={`/ordenes/comanda/${seleccionado.id}`} onClick={cerrarModal} className="orden-print-link"><Printer size={16} /> Abrir comanda completa</Link></div>
                </div>
              </div>
            );
          }}
        </ModalFlip>
      ) : null}
    </>
  );
}
