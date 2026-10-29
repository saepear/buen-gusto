"use client";

import { ClipboardCheck, Lock } from "lucide-react";
import { useActionState } from "react";
import { registrarCierre, type EstadoAccionCierre } from "./acciones";

const INICIAL: EstadoAccionCierre = { error: null, ok: null };

export function FormularioCierre({ conPagos }: { conPagos: boolean }) {
  const [estado, accion, pendiente] = useActionState<
    EstadoAccionCierre,
    FormData
  >(registrarCierre, INICIAL);

  const bloqueado = !conPagos || pendiente || estado.ok !== null;

  return (
    <form action={accion} className="mt-4 space-y-3">
      {estado.error ? (
        <p className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-[#f0a6a3]">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm font-bold text-[#a7dd83]">
          ✅ {estado.ok}
        </p>
      ) : null}

      {!conPagos ? (
        <p className="text-sm font-semibold text-cream-200/45">
          Todavía no hay pagos hoy: no hay nada que cerrar.
        </p>
      ) : (
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
            Efectivo contado en caja (opcional)
          </span>
          <input
            name="efectivoContado"
            inputMode="numeric"
            placeholder="Ej: 12000"
            className="mt-1.5 w-56 rounded-xl border-0 bg-white/5 px-3 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-brand/60 placeholder:text-cream-200/25"
          />
          <span className="mt-1 block text-xs text-cream-200/45">
            Compara la plata física contra el sistema y registra la diferencia.
          </span>
        </label>
      )}

      {!estado.ok ? (
        <button
          type="submit"
          disabled={bloqueado}
          className={
            "flex items-center gap-2 rounded-xl px-5 py-3 font-display text-lg transition " +
            (bloqueado
              ? "cursor-not-allowed bg-white/5 text-cream-200/45"
              : "bg-white/5 text-cream-100 ring-1 ring-white/10 hover:bg-white/10 hover:text-white")
          }
        >
          {pendiente ? (
            <>Registrando…</>
          ) : (
            <>
              <Lock className="h-5 w-5" /> Registrar cierre del día
            </>
          )}
        </button>
      ) : null}

      {estado.ok ? (
        <p className="flex items-center gap-2 text-sm font-bold text-cream-200/70">
          <ClipboardCheck className="h-4 w-4" /> El resumen quedó guardado más
          abajo en «Cierres anteriores».
        </p>
      ) : null}
    </form>
  );
}
