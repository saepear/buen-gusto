"use client";

import { useState } from "react";
import { ArrowUpRight, CalendarDays, CircleDollarSign, CreditCard, FileText, X } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP, formatHora } from "@/lib/format";
import { AccionAnularGasto } from "./formularios";

export type GastoTarjeta = {
  id: number;
  descripcion: string;
  categoria: string;
  categoriaLabel: string;
  metodo: string;
  metodoLabel: string;
  origen: string;
  origenLabel: string;
  valor: number;
  observaciones: string | null;
  anulado: boolean;
  anuladoAt: string | null;
  anuladoMotivo: string | null;
  anuladoPor: string | null;
  createdAt: string;
  registradoPor: string;
};

const METODO_ICONO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
};

function iniciales(texto: string) {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function TableroGastos({ gastos }: { gastos: GastoTarjeta[] }) {
  const [seleccionado, setSeleccionado] = useState<GastoTarjeta | null>(null);
  const [origen, setOrigen] = useState<OrigenModal | null>(null);

  function abrir(gasto: GastoTarjeta, elemento: HTMLElement) {
    const rect = elemento.getBoundingClientRect();
    setOrigen({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    setSeleccionado(gasto);
  }

  function cerrar() {
    setSeleccionado(null);
    setOrigen(null);
  }

  return (
    <>
      <div className="gastos-grid">
        {gastos.map((gasto) => (
          <button
            key={gasto.id}
            type="button"
            onClick={(event) => abrir(gasto, event.currentTarget)}
            className={`gastos-card ${gasto.anulado ? "gastos-card-muted" : ""}`}
          >
            <span className="gastos-card-topline">
              <span className="gastos-avatar">{iniciales(gasto.descripcion)}</span>
              <span className="gastos-card-heading">
                <span className="gastos-card-title">{gasto.descripcion}</span>
                <span className="gastos-card-meta">{gasto.categoriaLabel} · {gasto.origenLabel}</span>
              </span>
              <ArrowUpRight size={17} className="gastos-card-arrow" />
            </span>
            <span className="gastos-card-value">{formatCOP(gasto.valor)}</span>
            <span className="gastos-card-footer">
              <span><CalendarDays size={14} /> {new Date(gasto.createdAt).toLocaleDateString("es-CO")}</span>
              <span className={gasto.origen === "CAJA" ? "gastos-caja" : "gastos-externo"}>{gasto.origenLabel}</span>
            </span>
          </button>
        ))}
      </div>

      {seleccionado && origen ? (
        <ModalFlip rapida origen={origen} onClose={cerrar} ariaLabel={`Detalle del gasto ${seleccionado.descripcion}`}>
          {(cerrarModal) => (
            <div className="gastos-detail-modal">
              <header className="gastos-detail-header" data-anim>
                <div className="gastos-detail-title">
                  <span className="gastos-detail-avatar">{iniciales(seleccionado.descripcion)}</span>
                  <div>
                    <span className="gastos-eyebrow">DETALLE DEL GASTO</span>
                    <h2>{seleccionado.descripcion}</h2>
                    <p>{seleccionado.categoriaLabel} · {seleccionado.origenLabel}</p>
                  </div>
                </div>
                <button type="button" className="gastos-modal-close" onClick={cerrarModal} aria-label="Cerrar detalle"><X size={19} /></button>
              </header>
              <div className="gastos-detail-body">
                <div className="gastos-detail-hero" data-anim>
                  <div><span className="gastos-eyebrow">VALOR REGISTRADO</span><strong>{formatCOP(seleccionado.valor)}</strong></div>
                  <span className={seleccionado.anulado ? "gastos-state gastos-state-anulado" : "gastos-state gastos-state-activo"}>{seleccionado.anulado ? "Anulado" : "Activo"}</span>
                </div>
                <div className="gastos-detail-info" data-anim>
                  <div><CircleDollarSign size={16} /><span><small>Origen</small><b>{seleccionado.origenLabel}</b></span></div>
                  <div><CreditCard size={16} /><span><small>Método</small><b>{seleccionado.metodoLabel || METODO_ICONO[seleccionado.metodo] || seleccionado.metodo}</b></span></div>
                  <div><CalendarDays size={16} /><span><small>Registrado</small><b>{new Date(seleccionado.createdAt).toLocaleDateString("es-CO")} · {formatHora(new Date(seleccionado.createdAt))}</b></span></div>
                  <div><FileText size={16} /><span><small>Responsable</small><b>{seleccionado.registradoPor}</b></span></div>
                </div>
                {seleccionado.observaciones ? <div className="gastos-note" data-anim><span>Observaciones</span><p>«{seleccionado.observaciones}»</p></div> : null}
                {seleccionado.anulado ? (
                  <div className="gastos-anulado-note" data-anim>
                    Anulado {seleccionado.anuladoAt ? new Date(seleccionado.anuladoAt).toLocaleDateString("es-CO") : ""}
                    {seleccionado.anuladoPor ? ` por ${seleccionado.anuladoPor}` : ""}
                    {seleccionado.anuladoMotivo ? ` · «${seleccionado.anuladoMotivo}»` : ""}
                  </div>
                ) : (
                  <div className="gastos-detail-action" data-anim><AccionAnularGasto gastoId={seleccionado.id} /></div>
                )}
              </div>
            </div>
          )}
        </ModalFlip>
      ) : null}
    </>
  );
}
