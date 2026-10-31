"use client";

import { Eye, EyeOff, LayoutGrid, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { type EstadoMesa } from "@/lib/roles";
import { alternarMesa, borrarMesa, crearMesa, type EstadoAccionConfig } from "./acciones";
import { Aviso } from "./usuarios";

const INICIAL: EstadoAccionConfig = { error: null, ok: null };

const ESTILO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "bg-success/10 text-success-text ring-1 ring-success/20",
  OCUPADA: "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
};

const TEXTO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "Libre",
  OCUPADA: "Ocupada",
  POR_PAGAR: "Por pagar",
};

export type MesaDetalle = {
  id: number;
  nombre: string;
  estado: string;
  activa: boolean;
  /** Comandas históricas de la mesa: > 0 => solo se puede ocultar */
  pedidos: number;
};

function ChipMesa({ mesa }: { mesa: MesaDetalle }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    alternarMesa,
    INICIAL,
  );
  const [estadoBorrar, accionBorrar, pendienteBorrar] = useActionState<
    EstadoAccionConfig,
    FormData
  >(borrarMesa, INICIAL);
  const oculta = !mesa.activa;
  const e = mesa.estado as EstadoMesa;
  // Sin historial => se puede borrar del todo; con historial solo ocultar
  const sePuedeBorrar = mesa.pedidos === 0;

  return (
    <div className={oculta ? "rounded-2xl bg-campo-app p-3.5 opacity-70" : "rounded-2xl bg-campo-app p-3.5"}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-display text-lg text-texto-app">
          {mesa.nombre}
        </span>
        {oculta ? (
          <span className="rounded-full bg-panel-app px-2.5 py-0.5 text-[11px] font-bold text-texto-muted/45">
            Oculta
          </span>
        ) : (
          <span
            className={
              "rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
              ESTILO_ESTADO[e]
            }
          >
            {TEXTO_ESTADO[e]}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-1.5">
        <form action={accion} className="min-w-0 flex-1">
          <input type="hidden" name="mesaId" value={mesa.id} />
          <button
            type="submit"
            disabled={pendiente}
            className={
              "flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50 " +
              (oculta
                ? "bg-success/10 text-success-text ring-1 ring-success/20 hover:bg-success/25"
                : "border border-danger/40 bg-panel-app text-danger-text hover:bg-danger/10")
            }
          >
            {pendiente ? (
              "…"
            ) : oculta ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Mostrar
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Ocultar
              </>
            )}
          </button>
        </form>
        {sePuedeBorrar ? (
          <form
            action={accionBorrar}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `¿Borrar la mesa «${mesa.nombre}» del salón? Esta acción no se deshace.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="mesaId" value={mesa.id} />
            <button
              type="submit"
              disabled={pendienteBorrar}
              title="Borrar la mesa del salón (solo mesas sin historial)"
              aria-label={`Borrar la mesa ${mesa.nombre}`}
              className="flex w-9 items-center justify-center rounded-lg border border-danger/40 bg-panel-app text-danger-text transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : null}
      </div>
      {estadoBorrar.error || estadoBorrar.ok ? (
        <Aviso estado={estadoBorrar} />
      ) : (
        <Aviso estado={estado} />
      )}
    </div>
  );
}

export function PanelMesas({ mesas }: { mesas: MesaDetalle[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    crearMesa,
    INICIAL,
  );
  const [nombre, setNombre] = useState("");
  const [aprobada, setAprobada] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activas = mesas.filter((m) => m.activa);
  const ocultas = mesas.filter((m) => !m.activa);

  // Al crear una mesa con éxito, se limpia el campo para la siguiente
  // (setState durante el render, del modo que recomienda la documentación)
  if (estado.ok !== null && estado.ok !== aprobada) {
    setAprobada(estado.ok);
    setNombre("");
  }

  /** Siguiente número libre mirando los nombres existentes (ej. "Mesa 3") */
  const siguienteNumero = () => {
    const numeros = mesas
      .map((m) => m.nombre.match(/\d+/))
      .filter(Boolean)
      .map((m) => Number(m![0]));
    setNombre(String(numeros.length ? Math.max(...numeros) + 1 : 1));
  };

  /** Primera letra A–Z que aún no esté usada como nombre de una sola letra */
  const siguienteLetra = () => {
    const usadas = new Set(
      mesas
        .map((m) => m.nombre.trim().toUpperCase())
        .filter((n) => n.length === 1)
        .map((n) => n.charCodeAt(0)),
    );
    for (let c = 65; c <= 90; c++) {
      if (!usadas.has(c)) {
        setNombre(String.fromCharCode(c));
        break;
      }
    }
  };

  return (
    <section className="overflow-hidden rounded-[2rem] bg-panel-app ring-1 ring-borde-app">
      {/* Cabecera del módulo */}
      <div className="flex items-start justify-between gap-3 border-b border-borde-app px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-campo-app ring-1 ring-borde-app">
            <LayoutGrid className="h-5 w-5 text-texto-muted" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl text-texto-app">
              Mesas del salón
            </h2>
            <p className="mt-0.5 text-sm text-texto-muted/75">
              Los meseros y la caja solo ven las mesas visibles. Las mesas sin
              historial se pueden borrar (ícono de basura); si ya tienen
              comandas, escóndelas para conservar el registro de ventas.
            </p>
          </div>
        </div>
        <p className="shrink-0 pt-1.5 text-xs font-bold text-texto-muted/70">
          {activas.length} {activas.length === 1 ? "visible" : "visibles"}
        </p>
      </div>

      <div className="px-5 py-4 sm:px-6">
        {/* Alta: nombre a lo ancho con sugerencias y envío alineados */}
        <form
          action={accion}
          className="grid gap-2 rounded-2xl bg-campo-app p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
        >
          <input
            ref={inputRef}
            name="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la mesa (1, 2… o A, B…)"
            aria-label="Nombre de la mesa nueva"
            className="rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
          <button
            type="button"
            onClick={() => {
              siguienteNumero();
              inputRef.current?.focus();
            }}
            title="Sugerir el siguiente número"
            className="rounded-lg bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70"
          >
            Núm…
          </button>
          <button
            type="button"
            onClick={() => {
              siguienteLetra();
              inputRef.current?.focus();
            }}
            title="Sugerir la siguiente letra disponible"
            className="rounded-lg bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70"
          >
            A…
          </button>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50"
          >
            {pendiente ? "Creando…" : "Agregar mesa"}
          </button>
          <div className="sm:col-span-full">
            <Aviso estado={estado} />
          </div>
        </form>

        {/* Mesas visibles */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activas.map((m) => (
            <ChipMesa key={m.id} mesa={m} />
          ))}
        </div>

        {/* Mesas ocultas: sección aparte al fondo del módulo */}
        {ocultas.length > 0 ? (
          <div className="mt-4 border-t border-borde-app pt-4">
            <p className="text-sm font-bold text-texto-muted/75">
              Ocultas ({ocultas.length})
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ocultas.map((m) => (
                <ChipMesa key={m.id} mesa={m} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
