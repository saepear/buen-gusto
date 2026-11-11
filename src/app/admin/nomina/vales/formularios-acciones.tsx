"use client";
import { useActionState } from "react";
import { anularVale, type EstadoAccionVale } from "./actions";
export function AccionesVale({ valeId, estado }: { valeId: number; estado: string }) {
  const [resultado, accion, pendiente] = useActionState(anularVale, { error: null, ok: null } as EstadoAccionVale);
  if (estado === "ANULADO" || estado === "DESCONTADO") return null;
  return <details className="mt-4"><summary className="cursor-pointer text-sm text-danger-text">Anular vale</summary><form action={accion} className="nomina-shortForm mt-3"><input type="hidden" name="valeId" value={valeId} /><label>Motivo<input name="motivo" required maxLength={200} /></label>{resultado.error && <p role="alert">{resultado.error}</p>}{resultado.ok && <p role="status">{resultado.ok}</p>}<button className="nomina-operationSecondary" disabled={pendiente}>{pendiente ? "Guardando…" : "Confirmar anulación"}</button></form></details>;
}
