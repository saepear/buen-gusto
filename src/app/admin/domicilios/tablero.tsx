"use client";

import {
  Bike,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  Printer,
  StickyNote,
  UserPlus,
  X,
} from "lucide-react";
import { useActionState } from "react";
import Link from "next/link";
import { formatCOP } from "@/lib/format";
import { ESTADO_DOMICILIO, ESTADO_DOMICILIO_LABEL } from "@/lib/roles";
import {
  asignarDomiciliario,
  cancelarDomicilio,
  cobrarDomicilio,
  marcarEntregadoAdmin,
  marcarListaDomicilio,
  reintentarDomicilio,
  type EstadoAccionDomicilio,
} from "./actions";

const INICIAL: EstadoAccionDomicilio = { error: null, ok: null };

export type Repartidor = { id: number; nombre: string };

export type DomicilioVista = {
  id: number;
  pedidoId: number;
  estado: string;
  /** Estado de la comanda: para saber si la cocina la tiene lista */
  pedidoEstado: string;
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  horaEntrega: string | null;
  /** La misma hora en minutos (para ordenar la fila por hora de entrega) */
  horaMin: number | null;
  observaciones: string | null;
  notaEntrega: string | null;
  domiciliarioId: number | null;
  cobradoMonto: number | null;
  cobradoMetodo: string | null;
  /** Hora de la entrega (cuando el admin marcó «Entregado») */
  entregadoEn: string | null;
  creadoEn: string;
  /** epoch de creación, para ordenar la cola por llegada (FIFO) */
  ordenTs: number;
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
  const [lisEstado, lisAccion, lisPendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(marcarListaDomicilio, INICIAL);
  const [reintEstado, reintAccion, reintPendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(reintentarDomicilio, INICIAL);
  const [entEstado, entAccion, entPendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(marcarEntregadoAdmin, INICIAL);
  const [cobEstado, cobAccion, cobPendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(cobrarDomicilio, INICIAL);

  const estado = domicilio.estado;
  const abierto =
    estado === ESTADO_DOMICILIO.PENDIENTE || estado === ESTADO_DOMICILIO.ASIGNADO;
  // El toast «Entregado» aplica mientras el domicilio siga en curso
  const enCurso =
    estado === ESTADO_DOMICILIO.PENDIENTE ||
    estado === ESTADO_DOMICILIO.ASIGNADO ||
    estado === ESTADO_DOMICILIO.EN_CAMINO;
  const repartidor =
    repartidores.find((r) => r.id === domicilio.domiciliarioId)?.nombre ?? null;
  // La comanda todavía no pasó por "lista": hay que marcarla antes de salir
  const comandaPendiente =
    (estado === ESTADO_DOMICILIO.PENDIENTE || estado === ESTADO_DOMICILIO.ASIGNADO) &&
    (domicilio.pedidoEstado === "ENVIADO" ||
      domicilio.pedidoEstado === "EN_PREPARACION" ||
      domicilio.pedidoEstado === "PARCIAL_SERVIDO");

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
        {domicilio.horaEntrega ? (
          <span className="flex items-center gap-1 rounded-full bg-orange-brand/10 px-2.5 py-0.5 text-[10px] font-bold text-orange-brand ring-1 ring-orange-brand/20">
            <Clock className="h-3 w-3" /> {domicilio.horaEntrega}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-xs text-texto-muted/45">
          {domicilio.creadoEn}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-texto-muted/70">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-texto-muted/35" />
          <span>
            {domicilio.direccion || "Sin dirección registrada"}
            {domicilio.barrio ? ` · ${domicilio.barrio}` : ""}
            {domicilio.referencia ? (
              <span className="text-texto-muted/45"> ({domicilio.referencia})</span>
            ) : null}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-texto-muted/35" />
          {domicilio.telefono ? (
            <a
              href={`tel:${domicilio.telefono}`}
              className="font-bold text-texto-app transition hover:text-amber-brand"
            >
              {domicilio.telefono}
            </a>
          ) : (
            <span className="italic text-texto-muted/45">Sin teléfono</span>
          )}
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

      {/* La cocina aún no la tiene lista: un toque marca ENVIADO → lista */}
      {comandaPendiente ? (
        <>
          <form action={lisAccion} className="mt-2.5">
            <input type="hidden" name="pedidoId" value={domicilio.pedidoId} />
            <button
              type="submit"
              disabled={lisPendiente}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-warning/10 px-3 py-2 text-xs font-bold text-warning-text ring-1 ring-warning/30 transition hover:bg-warning/20 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              {lisPendiente ? "Marcando…" : "Marcar lista para empaque"}
            </button>
          </form>
          <Aviso estado={lisEstado} />
        </>
      ) : null}

      {/* El domiciliario llegó con la plata: el admin la recibe y el pedido
          queda a la espera del cobro en la columna «Entregados» */}
      {enCurso ? (
        <>
          <form action={entAccion} className="mt-2.5">
            <input type="hidden" name="domicilioId" value={domicilio.id} />
            <button
              type="submit"
              disabled={entPendiente}
              className={
                "flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50 " +
                (estado === ESTADO_DOMICILIO.EN_CAMINO
                  ? "bg-success/15 text-success-text ring-1 ring-success/30 hover:bg-success/25"
                  : "bg-panel-app text-success-text ring-1 ring-success/30 hover:bg-success/15")
              }
            >
              <CheckCircle2 className="h-4 w-4" />
              {entPendiente ? "Marcando…" : "Entregado"}
            </button>
          </form>
          <Aviso estado={entEstado} />
        </>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Link
          href={`/ordenes/comanda/${domicilio.pedidoId}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950"
          title="Comanda para la cocina / el empaque"
        >
          <Printer className="h-3.5 w-3.5" />
          Comanda
        </Link>
        {estado === ESTADO_DOMICILIO.ENTREGADO && domicilio.entregadoEn ? (
          <span className="text-xs font-bold text-texto-muted/50">
            Entregado a las {domicilio.entregadoEn}
          </span>
        ) : null}
      </div>
      {domicilio.observaciones ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-texto-muted/60">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {domicilio.observaciones}
        </p>
      ) : null}

      {estado === ESTADO_DOMICILIO.ENTREGADO ? (
        domicilio.cobradoMonto === null ? (
          // El dinero sigue allá afuera: el admin abre aquí la factura
          <form action={cobAccion} className="mt-3">
            <input type="hidden" name="domicilioId" value={domicilio.id} />
            <p className="flex items-center justify-between rounded-xl bg-warning/10 px-3 pt-2.5 text-sm ring-1 ring-warning/20">
              <span className="font-bold text-warning-text">Pendiente por cobrar</span>
              <span className="font-display text-lg text-warning-text">
                {formatCOP(domicilio.total)}
              </span>
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={cobPendiente}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-brand px-3.5 py-2.5 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
                title="Abrir la factura, cobrar y mandar al recibo"
              >
                <Banknote className="h-4 w-4" />
                {cobPendiente ? "Cobrando…" : "Cobrar"}
              </button>
              <span className="text-[11px] leading-tight text-texto-muted/50">
                Factura → pago → recibo
              </span>
            </div>
            <Aviso estado={cobEstado} />
          </form>
        ) : (
          <p className="mt-3 flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-sm ring-1 ring-success/20">
            <span className="font-bold text-success-text">Cobrado</span>
            <span className="flex items-center gap-2">
              {domicilio.cobradoMetodo ? (
                <span className="text-xs font-bold text-success-text/70">
                  {CHIP_METODO[domicilio.cobradoMetodo] ?? domicilio.cobradoMetodo}
                </span>
              ) : null}
              <span className="font-display text-lg text-success-text">
                {formatCOP(domicilio.cobradoMonto)}
              </span>
            </span>
          </p>
        )
      ) : null}

      {estado === ESTADO_DOMICILIO.NO_ENTREGADO && domicilio.notaEntrega ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger-text ring-1 ring-danger/20">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {domicilio.notaEntrega}
        </p>
      ) : null}

      {estado === ESTADO_DOMICILIO.NO_ENTREGADO ? (
        <div className="mt-3 border-t border-dashed border-borde-app pt-3">
          <p className="text-xs text-texto-muted/55">
            La comida sigue disponible: reintentar la devuelve a la fila para
            salir otra vez con el mismo domiciliario.
          </p>
          <form action={reintAccion} className="mt-2">
            <input type="hidden" name="domicilioId" value={domicilio.id} />
            <button
              type="submit"
              disabled={reintPendiente}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-brand px-3.5 py-2 text-xs font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
            >
              <Navigation className="h-3.5 w-3.5" />
              {reintPendiente ? "Reintentando…" : "Reintentar entrega"}
            </button>
          </form>
          <Aviso estado={reintEstado} />
        </div>
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
  entregados,
  cerrados,
  repartidores,
}: {
  porAsignar: DomicilioVista[];
  enReparto: DomicilioVista[];
  /** Entregados del día: esperan el cobro o ya quedaron cobrados */
  entregados: DomicilioVista[];
  /** No entregados y cancelados: la cola de excepciones del día */
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
        titulo="Entregados"
        Icono={CheckCircle2}
        domicilios={entregados}
        repartidores={repartidores}
        vacio="Ninguna entrega recibida hoy todavía."
      />
      <Grupo
        titulo="Cerrados"
        Icono={Bike}
        domicilios={cerrados}
        repartidores={repartidores}
        vacio="Sin excepciones hoy (no entregados ni cancelados)."
      />
    </div>
  );
}
