"use client";

import { cancelarComanda, empezarComanda, terminarComanda } from "./acciones";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** Botón de submit de acción: muestra progreso y se bloquea mientras actúa */
function Submit({ children, clase }: { children: ReactNode; clase: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={clase + (pending ? " opacity-50" : "")}
    >
      {pending ? "…" : children}
    </button>
  );
}

const BASE =
  "inline-flex h-11 items-center rounded-2xl px-4 text-[11px] font-bold uppercase tracking-wider transition active:scale-95";

const CLASES = {
  empezar: BASE + " bg-amber-brand text-brown-950 hover:scale-105",
  terminar:
    BASE +
    " bg-success/15 text-success-text ring-1 ring-success/30 hover:bg-success/25",
  cancelar:
    BASE +
    " text-danger-text ring-1 ring-danger/30 hover:bg-danger/10",
};

/**
 * Acciones de despacho del admin sobre una comanda viva:
 *   ENVIADO          -> Empezar (y cancelar)
 *   EN_PREPARACION   -> Terminar (y cancelar)
 *   PARCIAL_SERVIDO  -> Cancelar
 */
export function AccionesComanda({
  pedidoId,
  estado,
}: {
  pedidoId: number;
  estado: string;
}) {
  const sePuedeCancel = ["ENVIADO", "EN_PREPARACION", "PARCIAL_SERVIDO"].includes(
    estado,
  );
  if (!sePuedeCancel) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      {estado === "ENVIADO" ? (
        <form action={empezarComanda}>
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <Submit clase={CLASES.empezar}>Empezar</Submit>
        </form>
      ) : null}
      {estado === "EN_PREPARACION" ? (
        <form action={terminarComanda}>
          <input type="hidden" name="pedidoId" value={pedidoId} />
          <Submit clase={CLASES.terminar}>Terminar</Submit>
        </form>
      ) : null}
      <form
        action={cancelarComanda}
        onSubmit={(e) => {
          if (!window.confirm(`¿Cancelar la comanda #${pedidoId}? Las porciones vuelven al menú del día.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <Submit clase={CLASES.cancelar}>Cancelar</Submit>
      </form>
    </div>
  );
}
