"use client";

import { cancelarComanda } from "./acciones";
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
  cancelar:
    BASE +
    " text-danger-text ring-1 ring-danger/30 hover:bg-danger/10",
};

/**
 * El sistema no controla la cocina: una comanda solo se anula o se cobra.
 */
export function AccionesComanda({
  pedidoId,
  estado,
}: {
  pedidoId: number;
  estado: string;
}) {
  const sePuedeCancel = ["ENVIADO", "EN_PREPARACION", "PARCIAL_SERVIDO", "SERVIDO", "POR_PAGAR"].includes(estado);
  if (!sePuedeCancel) return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <form
        action={cancelarComanda}
        onSubmit={(e) => {
          if (!window.confirm(`¿Anular la comanda #${pedidoId}? Las porciones vuelven al menú del día.`)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="pedidoId" value={pedidoId} />
        <Submit clase={CLASES.cancelar}>Anular comanda</Submit>
      </form>
    </div>
  );
}
