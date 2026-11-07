"use client";

// ═════════ Formulario de jornada (asistencia) ═════════
import { useActionState } from "react";
import { Plus } from "lucide-react";
import { guardarJornada, type EstadoAccionJornada } from "./actions";

const INICIAL: EstadoAccionJornada = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

export function FormularioJornada({
  empleados,
}: {
  empleados: { id: number; nombre: string; diaDescanso: number }[];
}) {
  const [estado, accion, pendiente] = useActionState(guardarJornada, INICIAL);

  return (
    <details className="group rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95">
        <Plus className="h-5 w-5" /> Registrar jornada
      </summary>
      <form action={accion} className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {estado.error ? (
          <p aria-live="polite" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20 sm:col-span-2 lg:col-span-3">
            {estado.error}
          </p>
        ) : null}
        {estado.ok ? (
          <p aria-live="polite" className="rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20 sm:col-span-2 lg:col-span-3">
            {estado.ok}
          </p>
        ) : null}

        <label className={ETIQUETA}>
          EMPLEADO *
          <select name="empleadoId" required defaultValue="" className={CAMPO}>
            <option value="" disabled>Escoge una persona…</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} ({e.diaDescanso === 0 ? "descansa domingo" : e.diaDescanso === 6 ? "descansa sábado" : `descansa día ${e.diaDescanso + 1}`})
              </option>
            ))}
          </select>
        </label>
        <label className={ETIQUETA}>
          DÍA DE ENTRADA *
          <input type="date" name="fecha" required className={CAMPO} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className={ETIQUETA}>
            ENTRADA *
            <input name="entrada" required placeholder="14:30" className={CAMPO} inputMode="numeric" />
          </label>
          <label className={ETIQUETA}>
            SALIDA *
            <input name="salida" required placeholder="22:15" className={CAMPO} inputMode="numeric" />
          </label>
          <label className={ETIQUETA}>
            DESCANSO (min)
            <input name="descansoMinutos" inputMode="numeric" defaultValue={0} className={CAMPO} />
          </label>
        </div>
        <label className={`${ETIQUETA} sm:col-span-2`}>
          MOTIVO (obligatorio solo si la jornada YA estaba registrada)
          <input name="motivo" maxLength={200} placeholder="corrección: se olvidó marcar la salida…" className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          OBSERVACIONES
          <input name="observaciones" maxLength={200} className={CAMPO} />
        </label>
        <p className="text-[11px] text-texto-muted/60 sm:col-span-2 lg:col-span-3">
          Si la salida es menor o igual a la entrada se entiende que cruza
          medianoche (termina al día siguiente, sigue siendo jornada del día
          de entrada). El sistema marca el festivo según el calendario y el
          recargo del día de descanso según el contrato.
        </p>
        <button
          type="submit"
          disabled={pendiente || empleados.length === 0}
          className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar y clasificar"}
        </button>
      </form>
    </details>
  );
}
