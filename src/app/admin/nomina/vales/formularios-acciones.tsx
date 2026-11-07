"use client";
import { useActionState } from "react";
import { autorizarVale, anularVale, type EstadoAccionVale } from "./actions";
const INICIAL: EstadoAccionVale = { error: null, ok: null };
export function AccionesVale({
  valeId,
  estado,
}: {
  valeId: number;
  estado: string;
}) {
  const [aprobacion, aprobar, aprobando] = useActionState(
    autorizarVale,
    INICIAL,
  );
  const [anulacion, anular, anulando] = useActionState(anularVale, INICIAL);
  if (estado === "ANULADO" || estado === "DESCONTADO") return null;
  const campo =
    "rounded-xl bg-campo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app";
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <form action={aprobar} className="space-y-2">
        <input name="valeId" type="hidden" value={valeId} />
        {estado === "PENDIENTE" && (
          <label className="block text-xs text-texto-muted">
            Referencia de autorización escrita del trabajador
            <input
              name="soporteAutorizacion"
              className={`${campo} mt-1 w-full`}
              maxLength={120}
              minLength={3}
              required
              placeholder="Documento o soporte archivado"
            />
          </label>
        )}
        <button
          disabled={aprobando}
          className="rounded-xl bg-amber-brand px-3 py-2 text-xs font-bold text-brown-950 disabled:opacity-50"
        >
          {aprobando
            ? "Guardando…"
            : estado === "PENDIENTE"
              ? "Autorizar descuento"
              : "Devolver a pendiente"}
        </button>
        {aprobacion.error || aprobacion.ok ? (
          <p role="status" className="text-xs text-warning-text">
            {aprobacion.error ?? aprobacion.ok}
          </p>
        ) : null}
      </form>
      <details>
        <summary className="cursor-pointer text-xs font-bold text-danger-text">
          Anular vale
        </summary>
        <form action={anular} className="mt-2 space-y-2">
          <input type="hidden" name="valeId" value={valeId} />
          <label className="block text-xs text-texto-muted">
            Motivo de anulación
            <input
              name="motivo"
              required
              maxLength={200}
              className={`${campo} mt-1 w-full`}
            />
          </label>
          <button
            disabled={anulando}
            className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text"
          >
            {anulando ? "Anulando…" : "Confirmar anulación"}
          </button>
          {anulacion.error || anulacion.ok ? (
            <p role="status" className="text-xs text-warning-text">
              {anulacion.error ?? anulacion.ok}
            </p>
          ) : null}
        </form>
      </details>
    </div>
  );
}
