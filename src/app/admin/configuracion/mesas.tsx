"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { type EstadoMesa } from "@/lib/roles";
import { alternarMesa, crearMesa, type EstadoAccionConfig } from "./acciones";
import { Aviso } from "./usuarios";

const INICIAL: EstadoAccionConfig = { error: null, ok: null };

const ESTILO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "bg-success/15 text-success-dark",
  OCUPADA: "bg-orange-brand/15 text-orange-brand",
  POR_PAGAR: "bg-warning/15 text-amber-700",
};

const TEXTO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "Libre",
  OCUPADA: "Ocupada",
  POR_PAGAR: "Por pagar",
};

export type MesaDetalle = {
  id: number;
  numero: number;
  estado: string;
  activa: boolean;
};

function ChipMesa({ mesa }: { mesa: MesaDetalle }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    alternarMesa,
    INICIAL,
  );
  const oculta = !mesa.activa;
  const e = mesa.estado as EstadoMesa;

  return (
    <div
      className={
        oculta
          ? "rounded-2xl bg-cream-100 p-4 ring-1 ring-cream-200 opacity-75"
          : "rounded-2xl bg-white p-4 ring-1 ring-cream-300"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-3xl text-brown-800">
          #{mesa.numero}
        </span>
        {oculta ? (
          <span className="rounded-full bg-brown-800/10 px-2.5 py-0.5 text-[10px] font-bold text-brown-500">
            Oculta
          </span>
        ) : (
          <span
            className={
              "rounded-full px-2.5 py-0.5 text-[10px] font-bold " +
              ESTILO_ESTADO[e]
            }
          >
            {TEXTO_ESTADO[e]}
          </span>
        )}
      </div>

      <form action={accion} className="mt-3">
        <input type="hidden" name="mesaId" value={mesa.id} />
        <button
          type="submit"
          disabled={pendiente}
          className={
            "flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition disabled:opacity-50 " +
            (oculta
              ? "bg-success/20 text-success-dark hover:bg-success/30"
              : "border border-danger/40 bg-white text-danger hover:bg-danger/10")
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
      <Aviso estado={estado} />
    </div>
  );
}

export function PanelMesas({
  mesas,
  sugerida,
}: {
  mesas: MesaDetalle[];
  sugerida: number;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    crearMesa,
    INICIAL,
  );
  const activas = mesas.filter((m) => m.activa);
  const ocultas = mesas.filter((m) => !m.activa);

  return (
    <section className="rounded-2xl bg-white p-5 ring-1 ring-cream-300">
      <h2 className="font-display text-xl text-brown-800">Mesas del salón</h2>
      <p className="mt-1 text-sm text-brown-600">
        Los meseros y la caja solo ven las {activas.length} mesas visibles.
        Ocultar una mesa no borra su historial: solo se puede si está libre.
      </p>

      {/* Crear mesa */}
      <form
        action={accion}
        className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-cream-50 p-3.5 ring-1 ring-cream-200"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brown-800/10 text-brown-700">
          <Plus className="h-4.5 w-4.5" />
        </span>
        <input
          name="numero"
          inputMode="numeric"
          defaultValue={sugerida}
          aria-label="Número de la mesa nueva"
          className="w-24 rounded-xl border-0 bg-white px-3 py-2 text-sm font-bold text-brown-800 ring-1 ring-cream-300 focus:ring-2 focus:ring-amber-brand"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-orange-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-brand disabled:opacity-50"
        >
          {pendiente ? "Creando…" : "Agregar mesa"}
        </button>
        <div className="w-full">
          <Aviso estado={estado} />
        </div>
      </form>

      {/* Mesas visibles */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {activas.map((m) => (
          <ChipMesa key={m.id} mesa={m} />
        ))}
      </div>

      {/* Mesas ocultas */}
      {ocultas.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brown-500">
            Ocultas ({ocultas.length})
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ocultas.map((m) => (
              <ChipMesa key={m.id} mesa={m} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
