"use client";

import {
  Bike,
  MapPin,
  Navigation,
  Phone,
  StickyNote,
  UserPlus,
  X,
} from "lucide-react";
import { useActionState } from "react";
import { formatCOP } from "@/lib/format";
import { ESTADO_DOMICILIO, ESTADO_DOMICILIO_LABEL } from "@/lib/roles";
import {
  asignarDomiciliario,
  cancelarDomicilio,
  type EstadoAccionDomicilio,
} from "./actions";

const INICIAL: EstadoAccionDomicilio = { error: null, ok: null };

export type Repartidor = { id: number; nombre: string };

export type DomicilioVista = {
  id: number;
  estado: string;
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  observaciones: string | null;
  notaEntrega: string | null;
  domiciliarioId: number | null;
  cobradoMonto: number | null;
  cobradoMetodo: string | null;
  creadoEn: string;
  total: number;
  resumen: string;
};

const CHIP_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
  ASIGNADO: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  EN_CAMINO: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  ENTREGADO: "bg-success/10 text-success-text ring-1 ring-success/20",
  NO_ENTREGADO: "bg-danger/10 text-danger-text ring-1 ring-danger/20",
  CANCELADO: "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app",
};

const CHIP_METODO: Record<string, string> = {
  EFECTIVO: "💵 Efectivo",
  TARJETA: "💳 Tarjeta",
  TRANSFERENCIA: "🏦 Transferencia",
};

function Aviso({ estado }: { estado: EstadoAccionDomicilio }) {
  if (estado.error) {
    return (
      <p className="mt-2 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="mt-2 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/20">
        ✅ {estado.ok}
      </p>
    );
  }
  return null;
}

function TarjetaDomicilio({
  domicilio,
  repartidores,
}: {
  domicilio: DomicilioVista;
  repartidores: Repartidor[];
}) {
  const [asigEstado, asigAccion, asigPendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(asignarDomiciliario, INICIAL);
  const [canEstado, canAccion, canPendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(cancelarDomicilio, INICIAL);

  const estado = domicilio.estado;
  const abierto =
    estado === ESTADO_DOMICILIO.PENDIENTE || estado === ESTADO_DOMICILIO.ASIGNADO;
  const repartidor =
    repartidores.find((r) => r.id === domicilio.domiciliarioId)?.nombre ?? null;

  return (
    <div className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-lg text-texto-app">
          #{domicilio.id} · {domicilio.cliente}
        </span>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
            (CHIP_ESTADO[estado] ?? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
          }
        >
          {ESTADO_DOMICILIO_LABEL[estado as keyof typeof ESTADO_DOMICILIO_LABEL] ??
            estado}
        </span>
        <span className="ml-auto font-mono text-xs text-texto-muted/45">
          {domicilio.creadoEn}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-texto-muted/70">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-texto-muted/35" />
          <span>
            {domicilio.direccion}
            {domicilio.barrio ? ` · ${domicilio.barrio}` : ""}
            {domicilio.referencia ? (
              <span className="text-texto-muted/45"> ({domicilio.referencia})</span>
            ) : null}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-texto-muted/35" />
          <a
            href={`tel:${domicilio.telefono}`}
            className="font-bold text-texto-app transition hover:text-amber-brand"
          >
            {domicilio.telefono}
          </a>
        </p>
        <p className="flex items-center gap-2">
          <Bike className="h-4 w-4 shrink-0 text-texto-muted/35" />
          {repartidor ? (
            <span className="font-bold text-texto-app">{repartidor}</span>
          ) : (
            <span className="italic text-texto-muted/45">Sin asignar</span>
          )}
        </p>
      </div>

      <p className="mt-3 rounded-xl bg-panel-app px-3 py-2 text-xs text-texto-muted/70 ring-1 ring-borde-app">
        {domicilio.resumen}
      </p>
      {domicilio.observaciones ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-texto-muted/60">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {domicilio.observaciones}
        </p>
      ) : null}

      {estado === ESTADO_DOMICILIO.ENTREGADO ? (
        <p className="mt-3 flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-sm ring-1 ring-success/20">
          <span className="font-bold text-success-text">Cobrado</span>
          <span className="flex items-center gap-2">
            {domicilio.cobradoMetodo ? (
              <span className="text-xs font-bold text-success-text/70">
                {CHIP_METODO[domicilio.cobradoMetodo] ?? domicilio.cobradoMetodo}
              </span>
            ) : null}
            <span className="font-display text-lg text-success-text">
              {domicilio.cobradoMonto !== null
                ? formatCOP(domicilio.cobradoMonto)
                : formatCOP(domicilio.total)}
            </span>
          </span>
        </p>
      ) : null}

      {estado === ESTADO_DOMICILIO.NO_ENTREGADO && domicilio.notaEntrega ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger-text ring-1 ring-danger/20">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {domicilio.notaEntrega}
        </p>
      ) : null}

      {abierto ? (
        <div className="mt-3 space-y-2.5 border-t border-dashed border-borde-app pt-3">
          <form action={asigAccion} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="domicilioId" value={domicilio.id} />
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-app text-texto-app ring-1 ring-borde-app">
              <UserPlus className="h-4 w-4" />
            </span>
            <select
              name="domiciliarioId"
              defaultValue={domicilio.domiciliarioId ?? ""}
              className="min-w-40 flex-1 rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60"
            >
              <option value="" disabled>
                {repartidor ? `Reasignar…` : "Elegir domiciliario…"}
              </option>
              {repartidores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={asigPendiente}
              className="rounded-xl bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
            >
              {asigPendiente ? "Asignando…" : repartidor ? "Reasignar" : "Asignar"}
            </button>
          </form>
          <Aviso estado={asigEstado} />

          <form action={canAccion}>
            <input type="hidden" name="domicilioId" value={domicilio.id} />
            <button
              type="submit"
              disabled={canPendiente}
              className="inline-flex items-center gap-2 rounded-xl border border-danger/40 bg-panel-app px-3.5 py-2 text-xs font-bold text-danger-text transition hover:bg-danger/10 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              {canPendiente ? "Cancelando…" : "Cancelar domicilio"}
            </button>
          </form>
          <Aviso estado={canEstado} />
        </div>
      ) : null}
    </div>
  );
}

function Grupo({
  titulo,
  Icono,
  domicilios,
  repartidores,
  vacio,
}: {
  titulo: string;
  Icono: typeof Navigation;
  domicilios: DomicilioVista[];
  repartidores: Repartidor[];
  vacio: string;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-texto-app">
        <Icono className="h-5 w-5 text-texto-muted/45" />
        {titulo}
        <span className="rounded-full bg-panel-app px-2.5 py-0.5 text-xs font-bold text-texto-muted/50 ring-1 ring-borde-app">
          {domicilios.length}
        </span>
      </h2>
      {domicilios.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borde-app bg-panel-app px-4 py-6 text-center text-sm text-texto-muted/45">
          {vacio}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {domicilios.map((d) => (
            <TarjetaDomicilio
              key={d.id}
              domicilio={d}
              repartidores={repartidores}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TableroDomicilios({
  porAsignar,
  enReparto,
  cerrados,
  repartidores,
}: {
  porAsignar: DomicilioVista[];
  enReparto: DomicilioVista[];
  cerrados: DomicilioVista[];
  repartidores: Repartidor[];
}) {
  const sinRepartidores = repartidores.length === 0;

  return (
    <div className="space-y-8">
      {sinRepartidores ? (
        <p className="rounded-2xl bg-warning/10 px-4 py-3 text-sm font-bold text-warning-text ring-1 ring-warning/20">
          No hay domiciliarios activos. Créalos en Configuración → Usuarios para
          poder asignar entregas.
        </p>
      ) : null}

      <Grupo
        titulo="Por asignar"
        Icono={UserPlus}
        domicilios={porAsignar}
        repartidores={repartidores}
        vacio="No hay domicilios esperando repartidor."
      />
      <Grupo
        titulo="En reparto"
        Icono={Navigation}
        domicilios={enReparto}
        repartidores={repartidores}
        vacio="Nadie está en la calle ahora mismo."
      />
      <Grupo
        titulo="Cerrados hoy"
        Icono={Bike}
        domicilios={cerrados}
        repartidores={repartidores}
        vacio="Aún no se ha cerrado ningún domicilio hoy."
      />
    </div>
  );
}
