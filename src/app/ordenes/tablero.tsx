"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ChefHat, ClipboardList, Printer, UserRound, X } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP, formatHora } from "@/lib/format";
import { AccionesComanda } from "./botones-comanda";

export type OrdenTarjeta = {
  id: number;
  mesa: string;
  mesero: string;
  estado: string;
  paraLlevar: boolean;
  createdAt: string;
  items: { id: number; nombre: string; cantidad: number; precio: number; nota: string | null; conSopa: boolean | null }[];
};

const ESTADO: Record<string, { label: string; className: string }> = {
  ENVIADO: { label: "Enviado", className: "orden-status orden-status-enviado" },
  EN_PREPARACION: { label: "En preparación", className: "orden-status orden-status-preparacion" },
  PARCIAL_SERVIDO: { label: "Parcial servido", className: "orden-status orden-status-preparacion" },
  SERVIDO: { label: "Servido", className: "orden-status orden-status-servido" },
  POR_PAGAR: { label: "Por pagar", className: "orden-status orden-status-pagar" },
  FIADO: { label: "Fiada", className: "orden-status orden-status-fiado" },
  COBRADO: { label: "Atendido", className: "orden-status orden-status-cobrado" },
  CANCELADO: { label: "Cancelado", className: "orden-status orden-status-cancelado" },
};

function totalDe(items: OrdenTarjeta["items"]) {
  return items.reduce((total, item) => total + item.precio * item.cantidad, 0);
}

function inicial(texto: string) {
  return texto.trim().charAt(0).toUpperCase() || "·";
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
          const estado = ESTADO[pedido.estado] ?? { label: pedido.estado.replaceAll("_", " "), className: "orden-status" };
          return (
            <button key={pedido.id} type="button" onClick={(event) => abrir(pedido, event.currentTarget)} className="orden-card">
              <span className="orden-card-topline">
                <span className="orden-card-icon">{inicial(pedido.mesa)}</span>
                <span className="orden-card-heading">
                  <span className="orden-card-title">Comanda #{pedido.id}</span>
                  <span className="orden-card-meta">{pedido.mesa}{pedido.paraLlevar ? " · Para llevar" : ""}</span>
                </span>
                <ArrowUpRight size={17} className="orden-card-arrow" />
              </span>
              <span className="orden-card-status-row"><span className={estado.className}>{estado.label}</span><span className="orden-card-time"><CalendarClock size={14} /> {formatHora(new Date(pedido.createdAt))}</span></span>
              <span className="orden-card-summary"><strong>{pedido.items.length} {pedido.items.length === 1 ? "producto" : "productos"}</strong><strong>{formatCOP(totalDe(pedido.items))}</strong></span>
              <span className="orden-card-footer"><span>{pedido.mesero || "Sistema"}</span><span>Ver detalle <ArrowUpRight size={14} /></span></span>
            </button>
          );
        })}
      </div>

      {seleccionado && origen ? (
        <ModalFlip rapida origen={origen} onClose={cerrar} ariaLabel={`Detalle de comanda ${seleccionado.id}`} panelClassName="orden-detail-panel">
          {(cerrarModal) => {
            const estado = ESTADO[seleccionado.estado] ?? { label: seleccionado.estado.replaceAll("_", " "), className: "orden-status" };
            return (
              <div className="orden-detail-modal">
                <header className="orden-detail-header" data-anim>
                  <div className="orden-detail-title"><span className="orden-detail-icon"><ClipboardList size={22} /></span><div><span className="orden-eyebrow">DETALLE DE COMANDA</span><h2>Comanda #{seleccionado.id}</h2><p>{seleccionado.mesa}{seleccionado.paraLlevar ? " · Para llevar" : ""}</p></div></div>
                  <button type="button" className="orden-modal-close" onClick={cerrarModal} aria-label="Cerrar detalle"><X size={19} /></button>
                </header>
                <div className="orden-detail-body">
                  <div className="orden-detail-hero" data-anim><div><span className="orden-eyebrow">TOTAL DE LA COMANDA</span><strong>{formatCOP(totalDe(seleccionado.items))}</strong><p>Registrada hoy a las {formatHora(new Date(seleccionado.createdAt))}</p></div><span className={estado.className}>{estado.label}</span></div>
                  <div className="orden-detail-info" data-anim><div><ChefHat size={16} /><span><small>Origen</small><b>{seleccionado.mesa}{seleccionado.paraLlevar ? " · Para llevar" : ""}</b></span></div><div><UserRound size={16} /><span><small>Responsable</small><b>{seleccionado.mesero || "Sistema"}</b></span></div></div>
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
