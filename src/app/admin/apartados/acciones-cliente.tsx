"use client";

import { Check, XCircle } from "lucide-react";
import { useActionState, useState } from "react";
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

/**
 * Acciones de un apartado pendiente: Entregar y cobrar (con método), o
 * entregar y dejar fiado (nace la deuda). La entrega llama a la MISMA
 * server action; método vacío = fiado.
 */
export function AccionesEntregaApartado({ apartadoId }: { apartadoId: number }) {
  const [entrega, entregarAccion, entregando] = useActionState(
    entregarApartado,
    INICIAL,
  );
  const [cancela, cancelarAccion, cancelando] = useActionState(
    cancelarApartado,
    INICIAL,
  );
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [verCancelar, setVerCancelar] = useState(false);

  const ocupado = entregando || cancelando;

  return (
    <div className="mt-3 w-full border-t border-borde-app/60 pt-3">
      {verCancelar ? (
        <div className="w-full rounded-xl bg-danger/5 p-3 ring-1 ring-danger/25">
          <p className="mb-2 text-xs font-bold text-danger-text">
            ¿Seguro que cancelas el apartado? (no toca stock ni caja)
          </p>
          <div className="flex items-center gap-2">
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
          {cancela.error ? <Mensaje estado={cancela} /> : null}
          {cancela.ok ? <Mensaje estado={cancela} /> : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <form action={entregarAccion} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="apartadoId" value={apartadoId} />
              <label className="text-xs font-bold tracking-wide text-texto-muted/60">
                PAGA CON
                <select
                  name="metodo"
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value)}
                  className="ml-2 rounded-xl bg-panel-app px-2.5 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app"
                >
                  {METODOS.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.texto}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={ocupado}
                title="Entregar el apartado y registrar el pago en caja"
                className="flex items-center gap-1.5 rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                {entregando ? "Entregando…" : "Entregar y cobrar"}
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
              La entrega genera la comanda (cocina la ve en Órdenes) y no toca
              el stock salvo con lo que esté en el menú de hoy.
            </p>
          )}
          <Mensaje estado={entrega} />
        </>
      )}
    </div>
  );
}
