"use client";

// ═════════ Formulario de novedad (crear) ═════════
import { useState } from "react";
import { useActionState } from "react";
import { Plus } from "lucide-react";
import { crearNovedad, type EstadoAccionNovedad } from "./actions";
import { TIPO_NOVEDAD, TIPO_NOVEDAD_LABEL } from "./constantes";

const INICIAL: EstadoAccionNovedad = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

const PIDE_DIAS = ["AUSENCIA", "INCAPACIDAD", "PERMISO_REMUNERADO", "PERMISO_NO_REMUNERADO", "VACACIONES"];
const PIDE_VALOR = ["COMISION", "BONIFICACION", "DESCUENTO"];

export function FormularioNovedad({
  empleados,
}: {
  empleados: { id: number; nombre: string }[];
}) {
  const [estado, accion, pendiente] = useActionState(crearNovedad, INICIAL);
  const [tipo, setTipo] = useState("COMISION");

  return (
    <details className="group rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95">
        <Plus className="h-5 w-5" /> Registrar novedad
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
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </label>
        <label className={ETIQUETA}>
          TIPO *
          <select
            name="tipo"
            required
            defaultValue="COMISION"
            className={CAMPO}
            onChange={(e) => setTipo(e.target.value)}
          >
            {Object.entries(TIPO_NOVEDAD_LABEL).map(([valor, texto]) => (
              <option key={valor} value={valor}>{texto}</option>
            ))}
          </select>
        </label>
        <label className={ETIQUETA}>
          FECHA *
          <input type="date" name="fecha" required className={CAMPO} />
        </label>

        {PIDE_DIAS.includes(tipo) ? (
          <label className={ETIQUETA}>
            CANTIDAD DE DÍAS *
            <input name="dias" inputMode="numeric" required className={CAMPO} placeholder="1" />
          </label>
        ) : null}

        {PIDE_VALOR.includes(tipo) ? (
          <label className={ETIQUETA}>
            VALOR (COP) *
            <input name="valor" inputMode="numeric" required className={CAMPO} placeholder="$0" />
          </label>
        ) : null}

        <label className={`${ETIQUETA} sm:col-span-2 lg:col-span-3`}>
          DESCRIPCIÓN *
          <input
            name="descripcion"
            required
            maxLength={200}
            className={CAMPO}
            placeholder="Ej: se fichó tarde el jueves, colecta de cumpleaños…"
          />
        </label>
        <p className="text-[11px] text-texto-muted/60 sm:col-span-2 lg:col-span-3">
          Las novedades quedan PENDIENTES: solo las aprobadas se incorporan a
          una liquidación, y una vez contadas quedan marcadas — no se pueden
          contar dos veces. Las horas extra y recargos NO se registran aquí:
          nacen de las jornadas de asistencia.
        </p>
        <button
          type="submit"
          disabled={pendiente || empleados.length === 0}
          className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar novedad (pendiente)"}
        </button>
      </form>
    </details>
  );
}
