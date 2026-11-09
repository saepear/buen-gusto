"use client";

// ═════════ Formularios de períodos (client) ═════════
import { useActionState, useEffect, useState } from "react";
import {
  abrirPeriodo,
  aprobarLiquidacion,
  cerrarPeriodo,
  crearPeriodo,
  liquidarEmpleadoEnPeriodo,
  type EstadoAccionPeriodo,
} from "./actions";

const INICIAL: EstadoAccionPeriodo = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

export function FormularioCrearPeriodo({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [estado, accion, pendiente] = useActionState(async (prev: EstadoAccionPeriodo, form: FormData) => {
    const resultado = await crearPeriodo(prev, form);
    if (resultado.ok) onSuccess?.();
    return resultado;
  }, INICIAL);
  const [tipo, setTipo] = useState("CICLOS");

  return (
    <details open className="group rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
      <form action={accion} className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {estado.error ? (
          <p aria-live="polite" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20 sm:col-span-2 lg:col-span-4">
            {estado.error}
          </p>
        ) : null}
        {estado.ok ? (
          <p aria-live="polite" className="rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20 sm:col-span-2 lg:col-span-4">
            {estado.ok}
          </p>
        ) : null}
        <label className={ETIQUETA}>
          TIPO *
          <select
            name="tipo"
            defaultValue="CICLOS"
            className={CAMPO}
            onChange={(e) => setTipo(e.target.value)}
          >
            <option value="CICLOS">Restaurante: 7 / 14 / 21 / fin de mes</option>
            <option value="QUINCENAL">Quincenal (excepcional)</option>
            <option value="MENSUAL">Mensual</option>
          </select>
        </label>
        {tipo === "CICLOS" ? <label className={ETIQUETA}>CORTE *<select name="corte" defaultValue="1" className={CAMPO}><option value="1">1–7 · pago el 7</option><option value="2">8–14 · pago el 14</option><option value="3">15–21 · pago el 21</option><option value="4">22–fin · pago el último día</option></select></label> : null}
        {tipo === "QUINCENAL" ? (
          <label className={ETIQUETA}>
            QUINCENA *
            <select name="quincena" defaultValue="1" className={CAMPO}>
              <option value="1">Primera (1–15)</option>
              <option value="2">Segunda (16–fin)</option>
            </select>
          </label>
        ) : null}
        <label className={ETIQUETA}>
          MES *
          <select name="mes" required defaultValue={String(new Date().getMonth() + 1)} className={CAMPO}>
            {["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"].map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </label>
        <label className={ETIQUETA}>
          AÑO *
          <input name="anio" required inputMode="numeric" defaultValue={new Date().getFullYear()} className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          FECHA PREVISTA DE PAGO (opcional; por defecto, el corte)
          <input type="date" name="fechaPagoPrevista" className={CAMPO} />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50"
        >
          {pendiente ? "Creando…" : "Crear período"}
        </button>
      </form>
    </details>
  );
}

/** Liquidar UN empleado dentro del detalle del período */
export function BotonLiquidarEmpleado({ periodoId, empleadoId, nombre }: { periodoId: number; empleadoId: number; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(liquidarEmpleadoEnPeriodo, INICIAL);

  return (
    <form action={accion} className="inline-block">
      <input type="hidden" name="periodoId" value={periodoId} />
      <input type="hidden" name="empleadoId" value={empleadoId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-xl bg-amber-brand px-3 py-2 text-xs font-bold text-brown-950 transition hover:bg-orange-brand disabled:opacity-50"
      >
        {pendiente ? "…" : `Preparar pago de ${nombre}`}
      </button>
      {estado.error || estado.ok ? (
        <p
          aria-live="polite"
          className={
            "mt-1 max-w-56 text-[10px] font-bold " + (estado.error ? "text-danger-text" : "text-success-text")
          }
        >
          {estado.error ?? estado.ok}
        </p>
      ) : null}
    </form>
  );
}

export function BotonAprobarLiquidacion({ liquidacionId, nombre }: { liquidacionId: number; nombre: string }) {
  const [estado, accion, pendiente] = useActionState(aprobarLiquidacion, INICIAL);

  return (
    <form action={accion} className="inline-block">
      <input type="hidden" name="liquidacionId" value={liquidacionId} />
      <button
        type="submit"
        disabled={pendiente}
        title={`Confirmar el pago de ${nombre}`}
        className="rounded-xl bg-success/15 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/25 transition hover:bg-success/25 disabled:opacity-50"
      >
        {pendiente ? "…" : "Confirmar pago"}
      </button>
      {estado.error ? (
        <p aria-live="polite" className="mt-1 max-w-56 text-[10px] font-bold text-danger-text">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}

export function BotonCerrarPeriodo({ periodoId, onSuccess }: { periodoId: number; onSuccess?: () => void }) {
  const [estado, accion, pendiente] = useActionState(cerrarPeriodo, INICIAL);
  useEffect(() => { if (estado.ok) onSuccess?.(); }, [estado.ok, onSuccess]);

  return (
    <form action={accion} className="inline-block">
      <input type="hidden" name="periodoId" value={periodoId} />
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-50"
      >
        {pendiente ? "Cerrando…" : "Cerrar período"}
      </button>
      {estado.error || estado.ok ? (
        <p aria-live="polite" className={"mt-1 text-[10px] font-bold " + (estado.error ? "text-danger-text" : "text-success-text")}>
          {estado.error ?? estado.ok}
        </p>
      ) : null}
    </form>
  );
}

/** Reabrir — exige motivo y solo si no hay pagos */
export function BotonAbrirPeriodo({ periodoId, onSuccess }: { periodoId: number; onSuccess?: () => void }) {
  const [estado, accion, pendiente] = useActionState(abrirPeriodo, INICIAL);
  const [abierto, setAbierto] = useState(false);
  useEffect(() => { if (estado.ok) onSuccess?.(); }, [estado.ok, onSuccess]);

  return (
    <form action={accion} className="inline-block">
      <input type="hidden" name="periodoId" value={periodoId} />
      {abierto ? (
        <div className="space-y-1.5">
          <input name="motivo" required maxLength={200} placeholder="Motivo de la reapertura…" className={CAMPO} />
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-warning/20 px-4 py-2.5 text-sm font-bold text-warning-text ring-1 ring-warning/30 disabled:opacity-50"
          >
            {pendiente ? "Abriendo…" : "Confirmar reapertura"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="rounded-xl bg-warning/10 px-4 py-2.5 text-sm font-bold text-warning-text ring-1 ring-warning/20 transition hover:bg-warning/20"
        >
          Reabrir período
        </button>
      )}
      {estado.error || estado.ok ? (
        <p aria-live="polite" className={"mt-1 text-[10px] font-bold " + (estado.error ? "text-danger-text" : "text-success-text")}>
          {estado.error ?? estado.ok}
        </p>
      ) : null}
    </form>
  );
}
