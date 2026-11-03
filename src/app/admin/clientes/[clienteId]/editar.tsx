"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";
import { editarCliente, type EstadoAccionCliente } from "../actions";

const INICIAL: EstadoAccionCliente = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

export type DatosClienteFicha = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  observaciones: string | null;
};

/** Edición de la ficha (los datos se precargan; guarda con server action) */
export function FormularioEditarCliente({
  cliente,
}: {
  cliente: DatosClienteFicha;
}) {
  const [estado, accion, pendiente] = useActionState(
    editarCliente,
    INICIAL,
  );
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
      >
        <Pencil className="h-4 w-4 text-amber-brand" />
        {abierto ? "Cerrar edición" : "Editar datos"}
      </button>

      {abierto ? (
        <form
          action={accion}
          className="mt-3 grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2"
        >
          <input type="hidden" name="clienteId" value={cliente.id} />
          <label className={ETIQUETA}>
            NOMBRE *
            <input
              name="nombre"
              required
              maxLength={60}
              defaultValue={cliente.nombre}
              className={CAMPO}
            />
          </label>
          <label className={ETIQUETA}>
            TELÉFONO
            <input
              name="telefono"
              inputMode="tel"
              maxLength={24}
              defaultValue={cliente.telefono}
              className={CAMPO}
            />
          </label>
          <label className={ETIQUETA}>
            DIRECCIÓN
            <input
              name="direccion"
              maxLength={120}
              defaultValue={cliente.direccion}
              className={CAMPO}
            />
          </label>
          <label className={ETIQUETA}>
            BARRIO
            <input
              name="barrio"
              maxLength={60}
              defaultValue={cliente.barrio ?? ""}
              className={CAMPO}
            />
          </label>
          <label className={ETIQUETA + " sm:col-span-2"}>
            OBSERVACIONES
            <input
              name="observaciones"
              maxLength={300}
              defaultValue={cliente.observaciones ?? ""}
              className={CAMPO}
            />
          </label>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
          >
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </button>
          {estado.error ? (
            <p
              aria-live="polite"
              className="rounded-xl bg-danger/10 px-3 py-2.5 text-sm font-bold text-danger-text ring-1 ring-danger/20 sm:col-span-2"
            >
              {estado.error}
            </p>
          ) : null}
          {estado.ok ? (
            <p
              aria-live="polite"
              className="rounded-xl bg-success/10 px-3 py-2.5 text-sm font-bold text-success-text ring-1 ring-success/20 sm:col-span-2"
            >
              {estado.ok}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
