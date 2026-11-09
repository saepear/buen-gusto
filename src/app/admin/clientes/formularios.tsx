"use client";

import { ChevronDown, Link2, UserPlus, X, Check } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
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

/** Ficha candidata cuando hay posible duplicado (se muestra para decidir) */
function Coincidencias({
  lista,
  pendiente,
}: {
  lista: EstadoAccionCliente["coincidencias"];
  pendiente: boolean;
}) {
  if (!lista || lista.length === 0) return null;
  return (
    <div
      role="status"
      className="mt-2.5 rounded-xl bg-info/10 px-3.5 py-3 text-sm ring-1 ring-info/20 sm:col-span-2"
    >
      <p className="font-bold text-info-text">Posibles coincidencias</p>
      <p className="mt-0.5 text-texto-muted/70">
        Revísalas antes de crear la ficha: puede que ya exista. Si es otra
        persona (o comparten número), crea una ficha nueva.
      </p>
      <ul className="mt-2 space-y-1.5">
        {lista.map((c) => (
          <li
            key={c.id}
            className="rounded-lg bg-panel-app px-3 py-2 ring-1 ring-borde-app"
          >
            <span className="font-bold text-texto-app">
              #{c.id} · {c.nombre}
            </span>
            {c.telefono ? (
              <span className="text-texto-muted/70"> · {c.telefono}</span>
            ) : null}
            {c.direccion || c.barrio ? (
              <span className="text-texto-muted/50"> · {[c.direccion, c.barrio].filter(Boolean).join(" · ")}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="forzar"
          value="1"
          disabled={pendiente}
          className="rounded-xl bg-panel-app px-3.5 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand/20 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Es otra persona: crear ficha nueva"}
        </button>
      </div>
    </div>
  );
}

/** Post para registrar un cliente (se abre con un toque) */
export function FormularioNuevoCliente() {
  const [estado, accion, pendiente] = useActionState(crearCliente, INICIAL);
  const [origen, setOrigen] = useState<OrigenModal | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const mensaje =
    estado.ok && !estado.coincidencias ? estado.ok : null;

  function abrir() {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setOrigen({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  }

  return (
    <section aria-label="Registrar cliente">
      <button ref={trigger} type="button" onClick={abrir} className="clientes-new-button">
        <UserPlus className="h-5 w-5" />
        Nuevo cliente
        <ChevronDown aria-hidden className="h-4 w-4" />
      </button>
      {origen ? <ModalFlip rapida origen={origen} ariaLabel="Registrar nuevo cliente" onClose={() => { setOrigen(null); trigger.current?.focus(); }}>
        {cerrar => <>
          <header className="clientes-form-modal-header" data-anim><span className="clientes-form-modal-icon"><UserPlus aria-hidden size={22} /></span><div><p className="clientes-eyebrow">CLIENTES</p><h2>Nuevo cliente</h2><p>Registra una ficha para autocompletar domicilios y apartados.</p></div><button type="button" className="clientes-modal-close" aria-label="Cerrar nuevo cliente" onClick={cerrar}><X aria-hidden size={19} /></button></header>
          <form action={accion} className="clientes-new-form" data-anim>
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
          <Coincidencias lista={estado.coincidencias} pendiente={pendiente} />
          {mensaje ? (
            <p
              aria-live="polite"
              className="mt-2.5 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm text-success-text ring-1 ring-success/20 sm:col-span-2"
            >
              {mensaje}
            </p>
          ) : (
            <Aviso estado={{ error: estado.error, ok: null }} />
          )}
          </form>
          <footer className="clientes-modal-footer" data-anim><span>Los datos se podrán editar desde la ficha.</span><button type="button" onClick={cerrar}>Listo <Check aria-hidden size={16} /></button></footer>
        </>}
      </ModalFlip> : null}
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
