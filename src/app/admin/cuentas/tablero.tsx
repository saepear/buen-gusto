"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CircleDollarSign,
  CreditCard,
  History,
  LoaderCircle,
  ReceiptText,
  UserRound,
  X,
} from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { claveDia, formatCOP, formatHora } from "@/lib/format";
import { ESTADO_CUENTA, ESTADO_CUENTA_LABEL, type EstadoCuenta } from "@/lib/roles";
import {
  FormularioAbono,
  FormularioAnularCuenta,
  FormularioCondonarCuenta,
} from "./formularios";
import { obtenerDetalleCuenta } from "./actions";

export type CuentaTarjeta = {
  id: number;
  clienteId: number;
  nombre: string;
  telefono: string;
  concepto: string;
  valorOriginal: number;
  pagado: number;
  saldoCondonado: number;
  estado: string;
  createdAt: string;
  pedidoId: number | null;
  itemCount: number;
  abonoCount: number;
  ordinal: number;
};

type DetalleCuenta = NonNullable<Awaited<ReturnType<typeof obtenerDetalleCuenta>>>;

const METODOS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  NEQUI: "Nequi",
  DAVIPLATA: "Daviplata",
};

const ESTADOS: Record<string, string> = {
  PENDIENTE: "cuentas-status cuentas-status-pendiente",
  PAGADA: "cuentas-status cuentas-status-pagada",
  ANULADA: "cuentas-status cuentas-status-anulada",
  CONDONADA: "cuentas-status cuentas-status-condonada",
};

function saldoDe(cuenta: Pick<CuentaTarjeta, "valorOriginal" | "pagado" | "saldoCondonado">) {
  return Math.max(0, cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado);
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

export function TableroCuentas({
  cuentas,
  autoOpenId,
}: {
  cuentas: CuentaTarjeta[];
  autoOpenId?: number | null;
}) {
  const [seleccionada, setSeleccionada] = useState<CuentaTarjeta | null>(null);
  const [detalle, setDetalle] = useState<DetalleCuenta | null>(null);
  const [cargando, setCargando] = useState(false);
  const [origen, setOrigen] = useState<OrigenModal | null>(null);
  const autoAbierto = useRef(false);

  const abrir = useCallback(async (cuenta: CuentaTarjeta, origenFicha: OrigenModal) => {
    setOrigen(origenFicha);
    setSeleccionada(cuenta);
    setDetalle(null);
    setCargando(true);
    try {
      setDetalle(await obtenerDetalleCuenta(cuenta.id));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!autoOpenId || autoAbierto.current) return;
    const cuenta = cuentas.find((fila) => fila.id === autoOpenId);
    if (!cuenta) return;
    autoAbierto.current = true;
    const w = Math.min(220, window.innerWidth * 0.35);
    const h = 90;
    queueMicrotask(() =>
      void abrir(cuenta, {
        x: (window.innerWidth - w) / 2,
        y: (window.innerHeight - h) / 2,
        w,
        h,
      }),
    );
  }, [autoOpenId, cuentas, abrir]);

  function cerrar() {
    setSeleccionada(null);
    setDetalle(null);
    setOrigen(null);
  }

  return (
    <>
      <div className="cuentas-grid">
        {cuentas.map((cuenta) => {
          const saldo = saldoDe(cuenta);
          const porcentaje = cuenta.valorOriginal > 0
            ? Math.min(100, Math.round((cuenta.pagado / cuenta.valorOriginal) * 100))
            : 100;
          return (
            <button
              key={cuenta.id}
              type="button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                void abrir(cuenta, {
                  x: rect.left,
                  y: rect.top,
                  w: rect.width,
                  h: rect.height,
                });
              }}
              className={`cuentas-card ${cuenta.estado === ESTADO_CUENTA.ANULADA ? "cuentas-card-muted" : ""}`}
            >
              <span className="cuentas-card-topline">
                <span className="cuentas-avatar">{iniciales(cuenta.nombre)}</span>
                <span className="cuentas-card-heading">
                  <span className="cuentas-client-name">{cuenta.nombre}</span>
                  <span className="cuentas-client-meta">
                    {cuenta.telefono || "Sin teléfono"} · Fiado n.º {cuenta.ordinal}
                  </span>
                </span>
                <span className={ESTADOS[cuenta.estado] ?? "cuentas-status"}>
                  {ESTADO_CUENTA_LABEL[cuenta.estado as EstadoCuenta] ?? cuenta.estado}
                </span>
              </span>
              <span className="cuentas-card-concepto">{cuenta.concepto}</span>
              <span className="cuentas-card-values">
                <span>
                  <small>Saldo pendiente</small>
                  <strong className={saldo > 0 ? "cuentas-danger" : "cuentas-success"}>{formatCOP(saldo)}</strong>
                </span>
                <span>
                  <small>Valor original</small>
                  <strong>{formatCOP(cuenta.valorOriginal)}</strong>
                </span>
              </span>
              <span className="cuentas-progress" aria-hidden="true">
                <span style={{ width: `${porcentaje}%` }} />
              </span>
              <span className="cuentas-card-footer">
                <span><CalendarDays size={14} /> {claveDia(new Date(cuenta.createdAt))}</span>
                <span>{cuenta.abonoCount} {cuenta.abonoCount === 1 ? "abono" : "abonos"} <ArrowUpRight size={15} /></span>
              </span>
            </button>
          );
        })}
      </div>

      {seleccionada && origen ? (
        <ModalFlip origen={origen} onClose={cerrar} ariaLabel={`Detalle del fiado de ${seleccionada.nombre}`} rapida>
          {(cerrarModal) => (
            <div className="cuentas-modal">
              <div className="cuentas-modal-header" data-anim>
                <div className="cuentas-modal-title">
                  <span className="cuentas-modal-avatar">{iniciales(seleccionada.nombre)}</span>
                  <div>
                    <span className="cuentas-eyebrow">Ficha de fiado · N.º {seleccionada.ordinal}</span>
                    <h2>{seleccionada.nombre}</h2>
                    <p>{seleccionada.telefono || "Sin teléfono registrado"}</p>
                  </div>
                </div>
                <button type="button" onClick={cerrarModal} className="cuentas-modal-close" aria-label="Cerrar detalle">
                  <X size={19} />
                </button>
              </div>

              {cargando ? (
                <div className="cuentas-modal-loading" data-anim>
                  <LoaderCircle className="animate-spin" size={28} />
                  <span>Cargando el historial del fiado…</span>
                </div>
              ) : detalle ? (
                <div className="cuentas-modal-scroll">
                  <div className="cuentas-detail-hero" data-anim>
                    <div>
                      <span className="cuentas-eyebrow">Saldo por cobrar</span>
                      <strong>{formatCOP(saldoDe(detalle))}</strong>
                      <p>{detalle.concepto}</p>
                    </div>
                    <span className={ESTADOS[detalle.estado] ?? "cuentas-status"}>
                      {ESTADO_CUENTA_LABEL[detalle.estado as EstadoCuenta] ?? detalle.estado}
                    </span>
                  </div>

                  <div className="cuentas-detail-metrics" data-anim>
                    <div><small>Deuda original</small><strong>{formatCOP(detalle.valorOriginal)}</strong></div>
                    <div><small>Abonado</small><strong className="cuentas-success">{formatCOP(detalle.pagado)}</strong></div>
                    <div><small>Condonado</small><strong className="cuentas-warning">{formatCOP(detalle.saldoCondonado)}</strong></div>
                  </div>

                  <div className="cuentas-detail-columns">
                    <section className="cuentas-detail-section" data-anim>
                      <div className="cuentas-section-title"><ReceiptText size={17} /><h3>Desglose</h3></div>
                      {detalle.items.length ? (
                        <ul className="cuentas-lineas">
                          {detalle.items.map((item) => (
                            <li key={item.id}>
                              <span><b>{item.cantidad}× {item.nombre}</b>{item.conSopa === false ? <em>Sin sopa</em> : null}{item.nota ? <em>«{item.nota}»</em> : null}</span>
                              <strong>{formatCOP(item.precio * item.cantidad)}</strong>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="cuentas-empty-note">Deuda manual, sin artículos congelados.</p>}
                      <p className="cuentas-audit"><History size={14} /> Registrado {claveDia(new Date(detalle.createdAt))} a las {formatHora(new Date(detalle.createdAt))} por {detalle.creadoPor.nombre}</p>
                    </section>

                    <section className="cuentas-detail-section" data-anim>
                      <div className="cuentas-section-title"><CreditCard size={17} /><h3>Abonos recibidos</h3><span>{detalle.abonos.length}</span></div>
                      {detalle.abonos.length ? (
                        <ul className="cuentas-abonos">
                          {detalle.abonos.map((abono) => (
                            <li key={abono.id}><span><b>{formatCOP(abono.monto)}</b><small>{METODOS[abono.metodo] ?? abono.metodo} · {claveDia(new Date(abono.createdAt))}</small>{abono.nota ? <em>«{abono.nota}»</em> : null}</span><Check size={15} /></li>
                          ))}
                        </ul>
                      ) : <p className="cuentas-empty-note">Aún no hay abonos registrados.</p>}
                    </section>
                  </div>

                  {detalle.estado === ESTADO_CUENTA.PENDIENTE ? (
                    <section className="cuentas-actions" data-anim>
                      <div className="cuentas-section-title"><CircleDollarSign size={18} /><h3>Gestionar cuenta</h3></div>
                      <FormularioAbono cuentaId={detalle.id} saldo={saldoDe(detalle)} />
                      <div className="cuentas-action-links">
                        <FormularioCondonarCuenta cuentaId={detalle.id} valorOriginal={detalle.valorOriginal} abonado={detalle.pagado} saldo={saldoDe(detalle)} />
                        <FormularioAnularCuenta cuentaId={detalle.id} />
                      </div>
                    </section>
                  ) : null}

                  <div className="cuentas-modal-bottom" data-anim>
                    <Link href={`/admin/clientes/${detalle.clienteId}`} className="cuentas-client-link" onClick={cerrarModal}>
                      <UserRound size={16} /> Ver ficha completa del cliente
                    </Link>
                    <span className="cuentas-modal-hint">Esc para cerrar</span>
                  </div>
                </div>
              ) : (
                <div className="cuentas-modal-loading" data-anim><History size={25} /><span>No se encontró este fiado.</span></div>
              )}
            </div>
          )}
        </ModalFlip>
      ) : null}
    </>
  );
}
