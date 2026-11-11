"use client";

import { Check, XCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { formatCOP } from "@/lib/format";
import {
  cancelarApartado,
  entregarApartado,
  type EstadoAccionApartado,
} from "./actions";

const INICIAL: EstadoAccionApartado = { error: null, ok: null };

function Mensaje({ estado }: { estado: EstadoAccionApartado }) {
  if (estado.error) {
    return (
      <p
        aria-live="polite"
        className="w-full rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20"
      >
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p
        aria-live="polite"
        className="w-full rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

const METODOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "TARJETA", texto: "Tarjeta" },
];

/** Propina por preset, igual que en el cobro de Domicilios */
const PRESET_PROPINA = [
  { valor: "", texto: "Sin propina" },
  { valor: "1000", texto: "$1.000" },
  { valor: "2000", texto: "$2.000" },
];

/** Billetes típicos del bolsillo para el «¿con cuánto paga?» */
const BILLETES = [
  { valor: 50000, texto: "$50.000" },
  { valor: 100000, texto: "$100.000" },
];

const CHIP =
  "rounded-xl px-2.5 py-1.5 text-xs font-bold ring-1 transition ";
const CHIP_ON = "bg-amber-brand text-brown-950 ring-amber-brand";
const CHIP_OFF = "bg-panel-app text-texto-app ring-borde-app hover:ring-amber-brand/50";

/**
 * Acciones de un apartado pendiente: entregar y cobrar (método + propina +
 * billete con vueltas en vivo, como en Domicilios) o entregar y dejar fiado
 * (nace la deuda). Ambos llaman a la MISMA server action: método vacío =
 * fiado. Las vueltas de verdad las recalcula el servidor.
 */
export function AccionesEntregaApartado({
  apartadoId,
  total,
}: {
  apartadoId: number;
  total: number;
}) {
  const [entrega, entregarAccion, entregando] = useActionState(
    entregarApartado,
    INICIAL,
  );
  const [cancela, cancelarAccion, cancelando] = useActionState(
    cancelarApartado,
    INICIAL,
  );
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [propinaTxt, setPropinaTxt] = useState("");
  const [montoTxt, setMontoTxt] = useState("");
  const [verCancelar, setVerCancelar] = useState(false);

  const ocupado = entregando || cancelando;
  const enEfectivo = metodo === "EFECTIVO";
  const propinaNum = Number.parseInt(propinaTxt.replace(/[^0-9]/g, ""), 10) || 0;
  const aCobrar = total + propinaNum;
  const montoNum = Number.parseInt(montoTxt.replace(/[^0-9]/g, ""), 10) || null;
  const vueltas = enEfectivo && montoNum !== null ? montoNum - aCobrar : null;
  const noAlcanza = vueltas !== null && vueltas < 0;

  return (
    <div className="apartados-action-panel mt-3 w-full border-t border-borde-app/60 pt-3">
      {verCancelar ? (
        <div className="apartados-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={`cancelar-apartado-${apartadoId}`}>
          <div className="apartados-cancel-modal">
            <span className="apartados-cancel-icon"><XCircle aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p id={`cancelar-apartado-${apartadoId}`} className="font-display text-xl text-texto-app">Cancelar apartado #{apartadoId}</p>
              <p className="mt-1 text-sm text-texto-muted/65">
                Las porciones reservadas volverán al inventario del menú. Esta acción queda registrada en el historial.
              </p>
            </div>
            <div className="apartados-cancel-actions">
            <form action={cancelarAccion}>
              <input type="hidden" name="apartadoId" value={apartadoId} />
              <button
                type="submit"
                disabled={ocupado}
                className="flex items-center gap-1.5 rounded-xl bg-danger px-3 py-2 text-sm font-bold text-danger-text transition hover:opacity-90 disabled:opacity-40"
              >
                <XCircle className="h-4 w-4" />
                {cancelando ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setVerCancelar(false)}
              className="rounded-xl bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app"
            >
              Volver
            </button>
            </div>
          {cancela.error || cancela.ok ? (
            <Mensaje estado={cancela} />
          ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="apartados-payment-options">
            {/* Método de pago */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Método de pago"
            >
              <span className="text-[10px] font-bold tracking-wide text-texto-muted/50">
                PAGA CON
              </span>
              {METODOS.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  onClick={() => setMetodo(m.valor)}
                  aria-pressed={metodo === m.valor}
                  className={CHIP + (metodo === m.valor ? CHIP_ON : CHIP_OFF)}
                >
                  {m.texto}
                </button>
              ))}
            </div>

            {/* Propina (opcional, presets del negocio) */}
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Propina"
            >
              <span className="text-[10px] font-bold tracking-wide text-texto-muted/50">
                PROPINA
              </span>
              {PRESET_PROPINA.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  aria-pressed={propinaTxt === p.valor}
                  aria-label={
                    p.valor === "" ? "Sin propina" : `Propina de $${p.valor}`
                  }
                  onClick={() => setPropinaTxt(p.valor)}
                  className={
                    CHIP + (propinaTxt === p.valor ? CHIP_ON : CHIP_OFF)
                  }
                >
                  {p.texto}
                </button>
              ))}
            </div>
          </div>

          {/* ¿Con cuánto paga? — solo en efectivo; vueltas en vivo */}
          {enEfectivo ? (
            <div
              className="mt-2 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Billete con que paga"
            >
              <span className="text-[10px] font-bold tracking-wide text-texto-muted/50">
                ¿CON CUÁNTO PAGA?
              </span>
              <button
                type="button"
                aria-pressed={montoTxt === String(aCobrar)}
                onClick={() => setMontoTxt(String(aCobrar))}
                className={CHIP + (montoTxt === String(aCobrar) ? CHIP_ON : CHIP_OFF)}
              >
                Exacto
              </button>
              {BILLETES.filter((b) => b.valor >= aCobrar).map((b) => (
                <button
                  key={b.valor}
                  type="button"
                  aria-label={`Cliente paga con ${b.texto}`}
                  aria-pressed={montoTxt === String(b.valor)}
                  onClick={() => setMontoTxt(String(b.valor))}
                  className={CHIP + (montoTxt === String(b.valor) ? CHIP_ON : CHIP_OFF)}
                >
                  {b.texto}
                </button>
              ))}
              {noAlcanza ? (
                <span
                  aria-live="polite"
                  className="rounded-xl bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/25"
                >
                  No alcanza: faltan {formatCOP(Math.abs(vueltas ?? 0))}
                </span>
              ) : vueltas !== null ? (
                <span
                  aria-live="polite"
                  className="rounded-xl bg-success/10 px-2.5 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/25"
                >
                  Vueltas: {formatCOP(vueltas)}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="apartados-delivery-actions mt-2.5 flex flex-wrap items-end gap-2">
            <form action={entregarAccion} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="apartadoId" value={apartadoId} />
              <input type="hidden" name="metodo" value={metodo} />
              <input type="hidden" name="propina" value={propinaTxt} />
              <input type="hidden" name="montoPagado" value={enEfectivo ? montoTxt : ""} />
              <button
                type="submit"
                disabled={ocupado || noAlcanza}
                title="Entrega el apartado y registra el pago en caja"
                className="flex items-center gap-1.5 rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                {entregando
                  ? "Entregando…"
                  : `Entregar y cobrar · ${formatCOP(aCobrar)}`}
              </button>
            </form>

            <form action={entregarAccion}>
              <input type="hidden" name="apartadoId" value={apartadoId} />
              <input type="hidden" name="metodo" value="" />
              <button
                type="submit"
                disabled={ocupado}
                title="Entregar el apartado sin cobro: queda como deuda (fiado)"
                className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
              >
                {entregando ? "Entregando…" : "Entregar y dejar fiado"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => setVerCancelar(true)}
              className="ml-auto text-xs font-bold text-danger-text/70 underline-offset-2 transition hover:text-danger-text hover:underline"
            >
              Cancelar apartado
            </button>
          </div>

          {entrega.error || entrega.ok ? null : (
            <p className="w-full pl-0.5 pt-1 text-[11px] text-texto-muted/45">
              La entrega genera la comanda y consume
              las porciones que el apartado tenía reservadas.
            </p>
          )}
          <Mensaje estado={entrega} />
        </>
      )}
    </div>
  );
}
