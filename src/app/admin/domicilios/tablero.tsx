"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowRight,
  Bike,
  Clock,
  MapPin,
  Phone,
  Printer,
  StickyNote,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useRef,
  useState,
  useActionState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { formatCOP } from "@/lib/format";
import { ESTADO_DOMICILIO, ordenDeItem } from "@/lib/roles";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import {
  cancelarDomicilio,
  type EstadoAccionDomicilio,
} from "./actions";
import { PanelCobroDomicilio } from "./panel-cobro-domicilio";

gsap.registerPlugin(useGSAP);

const INICIAL: EstadoAccionDomicilio = { error: null, ok: null };

export type ItemDomicilioVista = {
  id: number;
  cantidad: number;
  grupo: number;
  tipo: string;
  nombre: string;
  conSopa: boolean | null;
  nota: string | null;
  /** Precio unitario congelado al ordenar (el de la comanda, no el de hoy) */
  precio: number;
};

export type DomicilioVista = {
  id: number;
  pedidoId: number;
  estado: string;
  /** Estado de la comanda: para saber si la cocina la tiene lista */
  pedidoEstado: string;
  cliente: string;
  /** Ficha del historial (Clientes): destino de la deuda si se fió */
  clienteId: number | null;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  horaEntrega: string | null;
  /** La misma hora en minutos (para ordenar la fila por hora de entrega) */
  horaMin: number | null;
  observaciones: string | null;
  creadoEn: string;
  /** epoch de creación, para ordenar la cola por llegada (FIFO) */
  ordenTs: number;
  total: number;
  resumen: string;
  /** Líneas de la comanda, para el detalle del modal sin pedirle nada al servidor */
  items: ItemDomicilioVista[];
};

/** El estado de la comanda, con el mismo vocabulario de cocina (Órdenes) */
const TXT_COMANDA: Record<string, string> = {
  ENVIADO: "En cocina",
  EN_PREPARACION: "En preparación",
  PARCIAL_SERVIDO: "Parcial",
  SERVIDO: "Lista para servir",
  POR_PAGAR: "Por pagar",
};

const CHIP_COMANDA: Record<string, string> = {
  ENVIADO: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  EN_PREPARACION: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  PARCIAL_SERVIDO:
    "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
  SERVIDO: "bg-success/10 text-success-text ring-1 ring-success/20",
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
};

function Aviso({ estado }: { estado: EstadoAccionDomicilio }) {
  if (estado.error) {
    return (
      <p className="mt-1.5 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="mt-1.5 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/20">
        ✅ {estado.ok}
      </p>
    );
  }
  return null;
}

/** Agrupa los ítems del pedido por grupo (1, 2, 3… y el 0 al final como extras/bebidas) */
function agruparItems(
  items: ItemDomicilioVista[],
): { grupo: number; items: ItemDomicilioVista[] }[] {
  const porGrupo: Record<number, ItemDomicilioVista[]> = {};
  for (const item of items) {
    if (!porGrupo[item.grupo]) porGrupo[item.grupo] = [];
    porGrupo[item.grupo].push(item);
  }
  return Object.keys(porGrupo)
    .map(Number)
    .sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    })
    .map((grupo) => ({
      grupo,
      items: porGrupo[grupo].sort(
        (a, b) => ordenDeItem(a.tipo) - ordenDeItem(b.tipo) || a.id - b.id,
      ),
    }));
}

/* ══════════════════════ Ficha del tablero ══════════════════════ */

function TarjetaDomicilio({
  domicilio,
  onAbrir,
}: {
  domicilio: DomicilioVista;
  onAbrir: (rect: DOMRect) => void;
}) {
  return (
    <button
      type="button"
      data-origen-ficha
      onClick={(e) => onAbrir(e.currentTarget.getBoundingClientRect())}
      aria-label={`Abrir el domicilio de ${domicilio.cliente}: detalle y enviar a caja`}
      className="tarjeta-domicilio w-full rounded-[1.65rem] bg-panel-app p-4 text-left ring-1 ring-borde-app transition hover:ring-amber-brand/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate font-display text-lg text-texto-app">
          #{domicilio.id} · {domicilio.cliente}
        </span>
        {domicilio.horaEntrega ? (
          <span className="flex items-center gap-1 rounded-full bg-orange-brand/10 px-2 py-0.5 text-[10px] font-bold text-orange-brand ring-1 ring-orange-brand/20">
            <Clock className="h-3 w-3" /> {domicilio.horaEntrega}
          </span>
        ) : null}
        <span className="ml-auto font-mono text-xs text-texto-muted/45">
          {domicilio.creadoEn}
        </span>
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-sm text-texto-muted/70">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-texto-muted/35" />
        <span className="min-w-0">
          {domicilio.direccion || "Sin dirección registrada"}
          {domicilio.barrio ? ` · ${domicilio.barrio}` : ""}
          {domicilio.referencia ? (
            <span className="text-texto-muted/45"> ({domicilio.referencia})</span>
          ) : null}
        </span>
      </p>

      <p className="mt-2.5 rounded-xl bg-campo-app px-3 py-2 text-xs text-texto-muted/70">
        {domicilio.resumen}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={
            "rounded-full px-2 py-0.5 text-[10px] font-bold " +
            (CHIP_COMANDA[domicilio.pedidoEstado] ??
              "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
          }
        >
          {TXT_COMANDA[domicilio.pedidoEstado] ?? domicilio.pedidoEstado}
        </span>
        <span className="ml-auto font-display text-xl text-amber-brand">
          {formatCOP(domicilio.total)}
        </span>
      </div>
    </button>
  );
}

/* ══════════════════════ Modal de detalle y ruta de cobro ══════════════════════ */

function DetalleDomicilio({
  domicilio,
  cerrar,
}: {
  domicilio: DomicilioVista;
  cerrar: () => void;
}) {
  const [canEstado, canAccion, canPendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(cancelarDomicilio, INICIAL);

  const puedeCancelar =
    domicilio.estado === ESTADO_DOMICILIO.PENDIENTE &&
    domicilio.pedidoEstado !== "CANCELADO";

  return (
    <>
      {/* Cabecera */}
      <div
        data-anim
        className="flex items-start justify-between gap-3 border-b border-borde-app/50 p-5"
      >
        <div className="min-w-0">
          <p className="truncate font-display text-3xl leading-none text-texto-app">
            {domicilio.cliente}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-panel-app px-2.5 py-0.5 text-[11px] font-bold text-texto-muted/70 ring-1 ring-borde-app">
              Domicilio #{domicilio.id}
            </span>
            {domicilio.horaEntrega ? (
              <span className="flex items-center gap-1 rounded-full bg-orange-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-orange-brand ring-1 ring-orange-brand/20">
                <Clock className="h-3.5 w-3.5" /> Para las {domicilio.horaEntrega}
              </span>
            ) : null}
            <span
              className={
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
                (CHIP_COMANDA[domicilio.pedidoEstado] ??
                  "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
              }
            >
              {TXT_COMANDA[domicilio.pedidoEstado] ?? domicilio.pedidoEstado}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-app text-texto-muted/70 ring-1 ring-borde-app transition hover:bg-danger/15 hover:text-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Datos de entrega */}
      <div
        data-anim
        className="space-y-1.5 border-b border-borde-app/50 px-5 py-4 text-sm text-texto-muted/70"
      >
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
      </div>

      {/* Detalle del pedido + cobro */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div
          data-anim
          className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
            Pedido
          </p>
          {domicilio.items.length === 0 ? (
            <p className="mt-2 text-sm text-texto-muted/50">Sin ítems.</p>
          ) : (
            <div className="mt-2.5 space-y-3">
              {agruparItems(domicilio.items).map(({ grupo, items }) => (
                <div key={grupo}>
                  {grupo > 0 ? (
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-texto-muted/45">
                      Almuerzo {grupo}
                    </p>
                  ) : null}
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-baseline gap-2 text-sm"
                      >
                        <span className="font-bold text-texto-app">
                          {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                          {item.nombre}
                        </span>
                        {item.tipo === "PROTEINA" && item.conSopa === false ? (
                          <span className="shrink-0 rounded-full bg-panel-app px-1.5 py-0.5 text-[9px] font-bold text-texto-muted/60 ring-1 ring-borde-app">
                            sin sopa
                          </span>
                        ) : null}
                        <span className="shrink-0 text-xs font-bold text-texto-muted/70">
                          {item.precio > 0
                            ? formatCOP(item.precio * item.cantidad)
                            : "Incluido"}
                        </span>
                        {item.nota ? (
                          <span className="w-full text-[11px] italic text-texto-muted/50">
                            ↳ {item.nota}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {domicilio.observaciones ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-texto-muted/55">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {domicilio.observaciones}
            </p>
          ) : null}
          <p className="mt-3 flex items-baseline justify-between border-t border-dashed border-borde-app pt-2.5">
            <span className="text-xs font-bold uppercase tracking-widest text-texto-muted/50">
              Total de la comanda
            </span>
            <span className="font-display text-xl text-amber-brand">
              {formatCOP(domicilio.total)}
            </span>
          </p>
        </div>

        {/* El efectivo se registra exclusivamente desde Caja. El fiado sigue
            disponible aquí porque no es ingreso hasta que llegue el abono. */}
        <div data-anim className="domicilios-caja-route">
          <div className="domicilios-caja-route-copy">
            <span className="domicilios-eyebrow">COBRO CENTRALIZADO</span>
            <h3>Este domicilio se cobra en Caja</h3>
            <p>Allí eliges método, propina, billete y recibes la factura imprimible.</p>
          </div>
          <Link
            href={`/admin/caja?domicilio=${domicilio.id}`}
            onClick={cerrar}
            className="domicilios-caja-route-button"
          >
            Ir a Caja <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div data-anim className="rounded-2xl">
          <PanelCobroDomicilio
            domicilioId={domicilio.id}
            total={domicilio.total}
            fichaCliente={
              domicilio.clienteId
                ? { id: domicilio.clienteId, nombre: domicilio.cliente }
                : null
            }
            soloFiado
          />
        </div>
      </div>

      {/* Acciones secundarias: comanda y cancelación */}
      <div
        data-anim
        className="border-t border-borde-app/50 bg-panel-app/40 p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/ordenes/comanda/${domicilio.pedidoId}?autoPrint=1&volver=${encodeURIComponent("/admin/domicilios")}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-campo-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950"
            title="Abre la comanda en el ticket e imprime; luego regresa al tablero"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir comanda
          </Link>
          {puedeCancelar ? (
            <form action={canAccion} className="ml-auto">
              <input type="hidden" name="domicilioId" value={domicilio.id} />
              <button
                type="submit"
                disabled={canPendiente}
                className="inline-flex items-center gap-1.5 rounded-xl border border-danger/40 bg-panel-app px-3 py-2 text-xs font-bold text-danger-text transition hover:bg-danger/10 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                {canPendiente ? "Cancelando…" : "Cancelar domicilio"}
              </button>
            </form>
          ) : null}
        </div>
        <Aviso estado={canEstado} />
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-texto-muted/45">
          <Bike className="h-3.5 w-3.5" />
          La comanda de cocina sale a imprimir apenas se crea el domicilio. El
          cobro en efectivo y su factura se gestionan desde Caja.
        </p>
      </div>
    </>
  );
}

function ModalDomicilio({
  domicilio,
  origen,
  onClose,
}: {
  domicilio: DomicilioVista;
  origen: OrigenModal;
  onClose: () => void;
}) {
  return (
    <ModalFlip
      origen={origen}
      onClose={onClose}
      ariaLabel={`Detalle del domicilio de ${domicilio.cliente}`}
    >
      {(cerrar) => <DetalleDomicilio domicilio={domicilio} cerrar={cerrar} />}
    </ModalFlip>
  );
}

/* ══════════════════════ Tablero ══════════════════════ */

export function TableroDomicilios({
  pendientes,
}: {
  pendientes: DomicilioVista[];
}) {
  const [seleccion, setSeleccion] = useState<{
    id: number;
    origen: OrigenModal;
  } | null>(null);
  const seleccionActual = seleccion
    ? pendientes.find((d) => d.id === seleccion.id)
    : null;

  const gridRef = useRef<HTMLDivElement>(null);

  // Entrada única del tablero: el HTML de SSR deja las fichas ocultas solo
  // por CSS (globals.css, .escenario-cascada); soltar esa clase y animar
  // sucede en el mismo frame antes del próximo pintado, así nunca se ve el
  // paso intermedio «aparecen → se ocultan → cascada».
  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;
      const fichas = grid.querySelectorAll<HTMLElement>(".tarjeta-domicilio");
      if (fichas.length === 0) return;
      const reducido = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      grid.classList.remove("escenario-cascada");
      if (reducido) return;
      gsap.fromTo(
        fichas,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          ease: "power3.out",
          stagger: 0.03,
          overwrite: "auto",
          clearProps: "all",
        },
      );
    },
    // pendientes.length cubre el regreso desde el estado vacío
    { dependencies: [pendientes.length], scope: gridRef },
  );

  return (
    <>
      {/* sin JS el CSS de entrada dejaría las fichas ocultas: neutralizarlo */}
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            "<style>.escenario-cascada .tarjeta-domicilio{opacity:1!important}</style>",
        }}
      />

      {pendientes.length === 0 ? (
        <div className="rounded-[2rem] bg-panel-app p-10 text-center ring-1 ring-borde-app">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-campo-app text-texto-muted/40">
            <Bike className="h-10 w-10" />
          </span>
          <p className="mt-5 font-display text-2xl text-texto-app">
            Todo cobrado
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-texto-muted/60">
            No hay domicilios pendientes de cobro. Los nuevos aparecen aquí
            apenas se registran y al cobrarlos quedan en la caja, el historial
            del cliente y los reportes.
          </p>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="escenario-cascada grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {pendientes.map((domicilio) => (
            <TarjetaDomicilio
              key={domicilio.id}
              domicilio={domicilio}
              onAbrir={(rect) =>
                setSeleccion({
                  id: domicilio.id,
                  origen: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
                })
              }
            />
          ))}
        </div>
      )}

      {seleccion && seleccionActual
        ? createPortal(
            <ModalDomicilio
              key={seleccion.id}
              domicilio={seleccionActual}
              origen={seleccion.origen}
              onClose={() => setSeleccion(null)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
