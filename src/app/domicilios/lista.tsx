"use client";

import {
  Bike,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  StickyNote,
  XCircle,
} from "lucide-react";
import { useActionState, useState } from "react";
import { formatCOP } from "@/lib/format";
import { ESTADO_DOMICILIO } from "@/lib/roles";
import {
  entregarDomicilio,
  fallarDomicilio,
  salirDomicilio,
  type EstadoAccionDomiciliario,
} from "./acciones";

const INICIAL: EstadoAccionDomiciliario = { error: null, ok: null };

export type EntregaVista = {
  id: number;
  estado: string;
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  observaciones: string | null;
  notaEntrega: string | null;
  total: number;
  creadoEn: string;
  resumen: string;
};

function Aviso({ estado }: { estado: EstadoAccionDomiciliario }) {
  if (estado.error) {
    return (
      <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-sm font-bold text-danger-text ring-1 ring-danger/20">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="mt-2 rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-success-text ring-1 ring-success/20">
        ✅ {estado.ok}
      </p>
    );
  }
  return null;
}

function Tarjeta({ entrega }: { entrega: EntregaVista }) {
  const [salirEstado, salirAccion, salirPendiente] = useActionState<
    EstadoAccionDomiciliario,
    FormData
  >(salirDomicilio, INICIAL);
  const [entEstado, entAccion, entPendiente] = useActionState<
    EstadoAccionDomiciliario,
    FormData
  >(entregarDomicilio, INICIAL);
  const [falloEstado, falloAccion, falloPendiente] = useActionState<
    EstadoAccionDomiciliario,
    FormData
  >(fallarDomicilio, INICIAL);

  const [abrirFallo, setAbrirFallo] = useState(false);
  const [metodo, setMetodo] = useState<"EFECTIVO" | "TRANSFERENCIA" | "TARJETA">(
    "EFECTIVO",
  );

  const enCamino = entrega.estado === ESTADO_DOMICILIO.EN_CAMINO;

  return (
    <article className="overflow-hidden rounded-[1.75rem] bg-panel-app ring-1 ring-borde-app shadow-flotante">
      <div className="flex items-center gap-2 bg-orange-brand/10 px-4 py-2.5 text-orange-brand ring-1 ring-orange-brand/20">
        {enCamino ? (
          <Navigation className="h-4 w-4" />
        ) : (
          <Bike className="h-4 w-4" />
        )}
        <span className="text-xs font-bold uppercase tracking-wide">
          {enCamino ? "En camino · cobrar al entregar" : "Listo para salir"}
        </span>
        <span className="ml-auto font-mono text-[11px] opacity-70">
          {entrega.creadoEn}
        </span>
      </div>

      <div className="p-4">
        <p className="font-display text-2xl text-texto-app">{entrega.cliente}</p>
        <div className="mt-2 space-y-1.5 text-sm text-texto-muted/70">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-texto-muted/35" />
            <span>
              {entrega.direccion}
              {entrega.barrio ? ` · ${entrega.barrio}` : ""}
              {entrega.referencia ? (
                <span className="text-texto-muted/45"> ({entrega.referencia})</span>
              ) : null}
            </span>
          </p>
          <a
            href={`tel:${entrega.telefono}`}
            className="flex items-center gap-2 font-bold text-texto-app transition hover:text-amber-brand"
          >
            <Phone className="h-4 w-4 shrink-0 text-texto-muted/35" />
            {entrega.telefono}
          </a>
        </div>

        <p className="mt-3 rounded-xl bg-panel-app px-3 py-2 text-xs text-texto-muted/70 ring-1 ring-borde-app">
          {entrega.resumen}
        </p>
        {entrega.observaciones ? (
          <p className="mt-2 flex items-start gap-2 text-xs text-texto-muted/60">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {entrega.observaciones}
          </p>
        ) : null}

        <div className="mt-3 flex items-baseline justify-between rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <span className="text-sm font-bold text-texto-muted/60">
            Cobrar al cliente
          </span>
          <span className="font-display text-3xl text-texto-app">
            {formatCOP(entrega.total)}
          </span>
        </div>

        {!enCamino ? (
          <>
            <form action={salirAccion} className="mt-3">
              <input type="hidden" name="domicilioId" value={entrega.id} />
              <button
                type="submit"
                disabled={salirPendiente}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-brand py-4 font-display text-lg text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-[0.98] disabled:opacity-50"
              >
                <Navigation className="h-5 w-5" />
                {salirPendiente ? "Saliendo…" : "Salir a entregar"}
              </button>
            </form>
            <Aviso estado={salirEstado} />
          </>
        ) : (
          <>
            <form action={entAccion} className="mt-3 space-y-2.5">
              <input type="hidden" name="domicilioId" value={entrega.id} />
              <input type="hidden" name="metodo" value={metodo} />
              <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-panel-app p-1.5 ring-1 ring-borde-app">
                {(
                  [
                    { v: "EFECTIVO", t: "Efectivo" },
                    { v: "TRANSFERENCIA", t: "Transf." },
                    { v: "TARJETA", t: "Tarjeta" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.v}
                    type="button"
                    onClick={() => setMetodo(m.v)}
                    className={
                      "rounded-xl px-2 py-2.5 text-center text-xs font-bold transition active:scale-95 " +
                      (metodo === m.v
                        ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
                        : "text-texto-muted/70 hover:bg-panel-hover")
                    }
                  >
                    {m.t}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={entPendiente}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-success py-4 font-display text-lg text-brown-950 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              >
                <CheckCircle2 className="h-5 w-5" />
                {entPendiente ? "Registrando…" : "Entregado y cobrado"}
              </button>
            </form>
            <Aviso estado={entEstado} />

            {!abrirFallo ? (
              <button
                type="button"
                onClick={() => setAbrirFallo(true)}
                className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/40 bg-panel-app py-3 font-display text-md text-danger-text transition hover:bg-danger/10"
              >
                <XCircle className="h-4 w-4" />
                No se pudo entregar
              </button>
            ) : (
              <form action={falloAccion} className="mt-2.5 space-y-2">
                <input type="hidden" name="domicilioId" value={entrega.id} />
                <textarea
                  name="motivo"
                  required
                  maxLength={140}
                  rows={2}
                  placeholder="¿Qué pasó? (ej: nadie contestó, dirección errada)"
                  className="w-full rounded-2xl border-0 bg-panel-app px-3.5 py-3 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-danger/60"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAbrirFallo(false)}
                    className="rounded-2xl bg-panel-app py-3 font-display text-md text-texto-muted/70 ring-1 ring-borde-app transition hover:bg-panel-hover"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    disabled={falloPendiente}
                    className="rounded-2xl bg-danger/80 py-3 font-display text-md text-texto-app transition hover:bg-danger active:scale-[0.98] disabled:opacity-50"
                  >
                    {falloPendiente ? "Guardando…" : "Confirmar"}
                  </button>
                </div>
              </form>
            )}
            <Aviso estado={falloEstado} />
          </>
        )}
      </div>
    </article>
  );
}

export function ListaDomiciliario({
  enCamino,
  porSalir,
  historial,
}: {
  enCamino: EntregaVista[];
  porSalir: EntregaVista[];
  historial: EntregaVista[];
}) {
  const vacio =
    enCamino.length === 0 && porSalir.length === 0 && historial.length === 0;

  if (vacio) {
    return (
      <div className="flex flex-col items-center gap-2.5 rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center ring-1 ring-borde-app">
        <Bike className="h-9 w-9 text-texto-muted/35" />
        <p className="font-display text-xl text-texto-app">Sin domicilios por ahora</p>
        <p className="text-sm text-texto-muted/70">
          Cuando el administrador te asigne una entrega, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {enCamino.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg text-texto-app">
            <Navigation className="h-5 w-5 text-orange-brand" /> En camino
          </h2>
          {enCamino.map((e) => (
            <Tarjeta key={e.id} entrega={e} />
          ))}
        </section>
      ) : null}

      {porSalir.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-lg text-texto-app">
            <Bike className="h-5 w-5 text-amber-brand" /> Por salir
          </h2>
          {porSalir.map((e) => (
            <Tarjeta key={e.id} entrega={e} />
          ))}
        </section>
      ) : null}

      {historial.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg text-texto-muted/60">
            Entregados hoy
          </h2>
          {historial.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success-text" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-texto-app">
                  {e.cliente}
                </span>
                <span className="block truncate text-xs text-texto-muted/50">
                  {e.direccion}
                </span>
              </span>
              <span className="font-display text-lg text-success-text">
                {formatCOP(e.total)}
              </span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
