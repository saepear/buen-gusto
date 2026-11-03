"use client";

import { ChevronDown, Link2, UserPlus } from "lucide-react";
import { useActionState, useState } from "react";
import {
  crearCliente,
  vincularHistorial,
  type EstadoAccionCliente,
} from "./actions";

const INICIAL: EstadoAccionCliente = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

function Aviso({ estado }: { estado: EstadoAccionCliente }) {
  if (estado.error) {
    return (
      <p
        aria-live="polite"
        className="mt-2.5 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger-text ring-1 ring-danger/20 sm:col-span-2"
      >
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p
        aria-live="polite"
        className="mt-2.5 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm text-success-text ring-1 ring-success/20 sm:col-span-2"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

/** Post para registrar un cliente (se abre con un toque) */
export function FormularioNuevoCliente() {
  const [estado, accion, pendiente] = useActionState(crearCliente, INICIAL);
  const [abierto, setAbierto] = useState(false);

  return (
    <section aria-label="Registrar cliente">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95"
      >
        <UserPlus className="h-5 w-5" />
        Nuevo cliente
        <ChevronDown
          aria-hidden
          className={
            "h-4 w-4 transition-transform " + (abierto ? "rotate-180" : "")
          }
        />
      </button>

      {abierto ? (
        <form
          action={accion}
          className="mt-3 grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2"
        >
          <label className={ETIQUETA}>
            NOMBRE *
            <input
              name="nombre"
              required
              maxLength={60}
              className={CAMPO}
              placeholder="Nombre completo"
            />
          </label>
          <label className={ETIQUETA}>
            TELÉFONO
            <input
              name="telefono"
              inputMode="tel"
              maxLength={24}
              className={CAMPO}
              placeholder="Opcional"
            />
          </label>
          <label className={ETIQUETA}>
            DIRECCIÓN
            <input
              name="direccion"
              maxLength={120}
              className={CAMPO}
              placeholder="Opcional"
            />
          </label>
          <label className={ETIQUETA}>
            BARRIO
            <input
              name="barrio"
              maxLength={60}
              className={CAMPO}
              placeholder="Opcional"
            />
          </label>
          <label className={ETIQUETA + " sm:col-span-2"}>
            OBSERVACIONES
            <input
              name="observaciones"
              maxLength={300}
              className={CAMPO}
              placeholder="Ej: pide sin cebolla, clienta de la iglesia…"
            />
          </label>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50 sm:col-span-2"
          >
            {pendiente ? "Guardando…" : "Guardar cliente"}
          </button>
          <Aviso estado={estado} />
        </form>
      ) : null}
    </section>
  );
}

/** Crea clientes desde el historial de domicilios y enlaza sus entregas */
export function FormularioVincular({ pendientes }: { pendientes: number }) {
  const [estado, accion, enProceso] = useActionState(
    vincularHistorial,
    INICIAL,
  );

  if (pendientes === 0 && !estado.ok && !estado.error) {
    return null; // Nada por vincular: no ocupar la pantalla
  }

  return (
    <form action={accion}>
      <button
        type="submit"
        disabled={enProceso || pendientes === 0}
        title="Crea la ficha de cada persona del historial de domicilios (por teléfono; los sin teléfono, por nombre) y enlaza esos pedidos"
        className="flex items-center gap-2 rounded-2xl bg-panel-app px-4 py-3 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-50"
      >
        <Link2 className="h-4 w-4 text-amber-brand" />
        {enProceso
          ? "Vinculando…"
          : `Vincular historial (${pendientes})`}
      </button>
      <div
        aria-live="polite"
        className={"max-w-xl " + (estado.error || estado.ok ? "mt-2" : "")}
      >
        <Aviso estado={estado} />
      </div>
    </form>
  );
}
