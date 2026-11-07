"use client";
import { useActionState } from "react";
import { ajustarPago } from "./ajustes-actions";
export function AjustePago({ pagoId, quitar }: { pagoId: number; quitar?: number }) {
  const [estado, accion, pendiente] = useActionState(ajustarPago, { error: null });
  const campo = "mt-1 w-full rounded-xl bg-fondo-app p-3 ring-1 ring-borde-app";
  return <form action={accion} className={quitar ? "mt-1" : "grid gap-3 rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app sm:grid-cols-2"}>
    <input type="hidden" name="pagoId" value={pagoId} />
    {quitar ? <input type="hidden" name="quitar" value={quitar} /> : <>
      <h2 className="text-lg font-bold sm:col-span-2">Agregar extra o deducción</h2>
      <label className="text-sm">Tipo<select className={campo} name="tipo"><option value="BONIFICACION">Extra / incentivo (+)</option><option value="DESCUENTO">Deducción (−)</option></select></label>
      <label className="text-sm">Valor (COP)<input className={campo} name="valor" type="number" min="1" max="2147483647" step="1" required placeholder="5000" /></label>
      <label className="text-sm sm:col-span-2">Concepto<input className={campo} name="descripcion" maxLength={200} required placeholder="Ej. Incentivo del corte o anticipo" /></label>
    </>}
    <button disabled={pendiente} className={quitar ? "text-xs text-danger-text underline disabled:opacity-50" : "rounded-xl bg-amber-brand px-4 py-3 font-bold text-brown-950 disabled:opacity-50"}>{pendiente ? "Guardando…" : quitar ? "Quitar ajuste" : "Agregar al pago"}</button>
    {estado.error && <p role="alert" className="text-sm text-danger-text sm:col-span-2">{estado.error}</p>}
  </form>;
}
