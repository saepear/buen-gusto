"use client";

// ═════════ Acciones de aprobación de novedades (client) ═════════
import { useActionState } from "react";
import { aprobarNovedad, rechazarNovedad, type EstadoAccionNovedad } from "./actions";

const INICIAL: EstadoAccionNovedad = { error: null, ok: null };

export function AccionAprobarNovedad({ novedadId }: { novedadId: number }) {
  const [estado, accion, pendiente] = useActionState(aprobarNovedad, INICIAL);

  return (
    <form action={accion} className="inline-block">
      <input type="hidden" name="novedadId" value={novedadId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-xl bg-success/15 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/25 transition hover:bg-success/25 disabled:opacity-50"
      >
        {pendiente ? "…" : "Aprobar"}
      </button>
      {estado.error ? (
        <p aria-live="polite" className="mt-1 max-w-48 text-[10px] font-bold text-danger-text">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}

export function AccionRechazarNovedad({ novedadId }: { novedadId: number }) {
  const [estado, accion, pendiente] = useActionState(rechazarNovedad, INICIAL);

  return (
    <details className="relative inline-block">
      <summary className="w-fit cursor-pointer list-none rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20 transition hover:bg-danger/20">
        Rechazar
      </summary>
      <form
        action={accion}
        className="absolute right-0 z-20 mt-2 w-64 space-y-2 rounded-2xl bg-panel-app p-3 shadow-xl ring-1 ring-borde-app"
      >
        <input type="hidden" name="novedadId" value={novedadId} />
        <input
          name="motivo"
          required
          maxLength={200}
          placeholder="Motivo del rechazo…"
          className="w-full rounded-xl border-0 bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="w-full rounded-xl bg-danger/20 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/30 disabled:opacity-50"
        >
          {pendiente ? "…" : "Confirmar rechazo"}
        </button>
        {estado.error ? (
          <p aria-live="polite" className="text-[10px] font-bold text-danger-text">
            {estado.error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
