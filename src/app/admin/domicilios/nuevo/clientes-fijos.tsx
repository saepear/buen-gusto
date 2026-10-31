"use client";

import { Repeat2, UsersRound } from "lucide-react";
import { useActionState } from "react";
import { formatCOP } from "@/lib/format";
import { repetirUltimoDomicilio, type EstadoAccionDomicilio } from "../actions";

const INICIAL: EstadoAccionDomicilio = { error: null, ok: null };

/** Cliente con historia de domicilios: su chip repite el último pedido */
export type ClienteFijo = {
  /** Id de su último domicilio (el que se replica) */
  domicilioId: number;
  cliente: string;
  telefono: string;
  pedidos: number;
  /** Resumen legible de lo que pidió la última vez */
  resumen: string;
  /** Total de aquella última vez */
  total: number;
};

/**
 * Checkout en un toque para los clientes de siempre: el domiciliario ya
 * sabe a dónde va, al sistema solo le importa el pedido y el precio.
 */
export function ClientesFijos({ clientes }: { clientes: ClienteFijo[] }) {
  const [estado, accion, pendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(repetirUltimoDomicilio, INICIAL);

  if (clientes.length === 0) return null;

  return (
    <section aria-label="Clientes fijos" className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg leading-none text-texto-app">
          <UsersRound aria-hidden className="h-4.5 w-4.5 text-amber-brand" />
          Clientes fijos
          <span className="rounded-full bg-panel-app px-2 py-0.5 text-[10px] font-bold text-texto-muted/60 ring-1 ring-borde-app">
            {clientes.length}
          </span>
        </h2>
        <p className="hidden truncate text-xs text-texto-muted/50 sm:block">
          Piden lo mismo de siempre · un toque lo repite
        </p>
      </div>

      {/* Carril con desplazamiento lateral: los de siempre quedan a la mano
          sin empujar el formulario fuera de la primera pantalla */}
      <div className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1.5">
        {clientes.map((c) => (
          <article
            key={c.telefono}
            className="flex w-[15.5rem] shrink-0 snap-start flex-col rounded-2xl bg-panel-app p-3.5 ring-1 ring-borde-app transition hover:ring-amber-brand/40"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-brand/15 font-display text-lg text-amber-brand ring-1 ring-amber-brand/30"
              >
                {c.cliente.trim().charAt(0).toUpperCase() || "·"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight text-texto-app">
                  {c.cliente}
                </p>
                <p className="text-[10px] font-bold text-texto-muted/40">
                  {c.pedidos}{" "}
                  {c.pedidos === 1
                    ? "pedido con nosotros"
                    : "pedidos con nosotros"}
                </p>
              </div>
            </div>

            <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-texto-muted/75">
              {c.resumen}
            </p>

            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <span
                className="min-w-0 truncate text-[11px] font-bold text-texto-muted/45"
                title={`Tel ${c.telefono}`}
              >
                Tel {c.telefono.slice(-4)}
              </span>
              <span className="font-display text-md tabular-nums text-texto-app">
                {formatCOP(c.total)}
              </span>
            </div>

            <form action={accion} className="mt-2.5">
              <input type="hidden" name="domicilioId" value={c.domicilioId} />
              <button
                type="submit"
                disabled={pendiente}
                title="Registra su pedido de siempre, con el precio de hoy"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20 transition hover:bg-success/25 active:scale-[0.97] disabled:opacity-50"
              >
                {pendiente ? (
                  "Registrando…"
                ) : (
                  <>
                    <Repeat2 aria-hidden className="h-3.5 w-3.5" /> Repetir su
                    pedido
                  </>
                )}
              </button>
            </form>
          </article>
        ))}
      </div>

      {estado.error ? (
        <p
          aria-live="polite"
          className="mt-3 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger-text ring-1 ring-danger/20"
        >
          {estado.error}
        </p>
      ) : null}
    </section>
  );
}
