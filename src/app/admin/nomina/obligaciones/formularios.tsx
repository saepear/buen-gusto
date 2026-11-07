"use client";

// ═════════ Formulario de pago de prestación (client) ═════════
// Expande una fila pequeña: concepto fijo, monto (tope = pendiente) y
// método. El egreso de caja solo con EFECTIVO (lo crea la acción).
import { useActionState, useState } from "react";
import { registrarPagoPrestacion, type EstadoAccionObligacion } from "./actions";

const INICIAL: EstadoAccionObligacion = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app focus:ring-amber-brand/60";

const CONCEPTO_CORTO: Record<string, string> = {
  PRIMA: "Prima",
  CESANTIAS: "Cesantías",
  INTERESES_CESANTIAS: "Intereses",
  VACACIONES: "Vacaciones",
};

export function FormularioPagoPrestacion({
  empleadoId,
  nombre,
  concepto,
  pendiente,
}: {
  empleadoId: number;
  nombre: string;
  concepto: string;
  pendiente: number;
}) {
  const [estado, accion, guardando] = useActionState(registrarPagoPrestacion, INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-xl bg-amber-brand px-3 py-1.5 text-xs font-bold text-brown-950 transition hover:bg-orange-brand"
      >
        Pagar
      </button>
    );
  }

  return (
    <form
      action={accion}
      className="mt-1 w-64 space-y-2 rounded-2xl bg-panel-app p-3 shadow-xl ring-1 ring-borde-app"
    >
      <input type="hidden" name="empleadoId" value={empleadoId} />
      <input type="hidden" name="concepto" value={concepto} />
      <p className="text-xs font-bold text-texto-app">
        {CONCEPTO_CORTO[concepto] ?? concepto} de {nombre}
      </p>
      {estado.error ? (
        <p aria-live="polite" className="rounded-lg bg-danger/10 px-2 py-1 text-[10px] font-bold text-danger-text ring-1 ring-danger/20">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p aria-live="polite" className="rounded-lg bg-success/10 px-2 py-1 text-[10px] font-bold text-success-text ring-1 ring-success/20">
          {estado.ok}
        </p>
      ) : null}
      <input
        name="monto"
        required
        inputMode="numeric"
        placeholder={"Hasta $" + pendiente.toLocaleString("es-CO")}
        className={CAMPO}
      />
      <div className="grid grid-cols-2 gap-2">
        <select name="metodo" defaultValue="EFECTIVO" className={CAMPO}>
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="OTRO">Otro</option>
        </select>
        <input name="referencia" maxLength={120} placeholder="Referencia…" className={CAMPO} />
      </div>
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={guardando}
          className="flex-1 rounded-xl bg-amber-brand px-3 py-2 text-xs font-bold text-brown-950 disabled:opacity-50"
        >
          {guardando ? "Registrando…" : "Registrar pago"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app"
        >
          Cerrar
        </button>
      </div>
      <p className="text-[10px] text-texto-muted/55">
        Pendiente: ${pendiente.toLocaleString("es-CO")} · el pago en efectivo
        genera egreso de caja.
      </p>
    </form>
  );
}
