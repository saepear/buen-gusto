"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Plus } from "lucide-react";
import { type EstadoMesa } from "@/lib/roles";
import { alternarMesa, crearMesa, type EstadoAccionConfig } from "./acciones";
import { Aviso } from "./usuarios";

const INICIAL: EstadoAccionConfig = { error: null, ok: null };

const ESTILO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "bg-success/10 text-[#a7dd83] ring-1 ring-success/20",
  OCUPADA: "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
  POR_PAGAR: "bg-warning/10 text-[#f0cf6d] ring-1 ring-warning/20",
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
          ? "rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 opacity-75"
          : "rounded-2xl bg-white/[0.02] p-4 ring-1 ring-white/10"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-3xl text-white">
          #{mesa.numero}
        </span>
        {oculta ? (
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-bold text-cream-200/45">
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
              ? "bg-success/10 text-[#a7dd83] ring-1 ring-success/20 hover:bg-success/25"
              : "border border-danger/40 bg-white/5 text-[#f0a6a3] hover:bg-danger/10")
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
    <section className="rounded-[2rem] bg-white/[0.02] p-5 ring-1 ring-white/10">
      <h2 className="font-display text-xl text-white">Mesas del salón</h2>
      <p className="mt-1 text-sm text-cream-200/70">
        Los meseros y la caja solo ven las {activas.length} mesas visibles.
        Ocultar una mesa no borra su historial: solo se puede si está libre.
      </p>

      {/* Crear mesa */}
      <form
        action={accion}
        className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 p-3.5 ring-1 ring-white/10"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-cream-100">
          <Plus className="h-4.5 w-4.5" />
        </span>
        <input
          name="numero"
          inputMode="numeric"
          defaultValue={sugerida}
          aria-label="Número de la mesa nueva"
          className="w-24 rounded-xl border-0 bg-white/5 px-3 py-2 text-sm font-bold text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-brand/60"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-white disabled:opacity-50"
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
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
