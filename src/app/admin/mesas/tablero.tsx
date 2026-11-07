"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowUpRight,
  LayoutGrid,
  Check,
  Banknote,
  Clock,
  CupSoda,
  Drumstick,
  Salad,
  Search,
  ShoppingBag,
  Soup,
  Star,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCOP } from "@/lib/format";
import type { EstadoMesa } from "@/lib/roles";
import { ModalFlip } from "@/components/modal-flip";

import "./mesas.css";

gsap.registerPlugin(useGSAP);

export type ItemDetalle = {
  nombre: string;
  cantidad: number;
  tipo: string;
  conSopa: boolean | null;
  precio: number;
};

export type ComandaDetalle = {
  id: number;
  hora: string;
  estado: string;
  paraLlevar: boolean;
  observaciones: string | null;
  items: ItemDetalle[];
};

export type MesaDetalle = {
  id: number;
  nombre: string;
  estado: string;
  total: number;
  platos: number;
  /** epoch ms del primer pedido activo; null si la mesa está libre */
  desde: number | null;
  comandas: ComandaDetalle[];
};

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

const CHIP_COMANDA: Record<string, string> = {
  ENVIADO: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  EN_PREPARACION: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  PARCIAL_SERVIDO: "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
  SERVIDO: "bg-success/10 text-success-text ring-1 ring-success/20",
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
};

const TXT_COMANDA: Record<string, string> = {
  ENVIADO: "En cocina",
  EN_PREPARACION: "En preparación",
  PARCIAL_SERVIDO: "Parcial",
  SERVIDO: "Lista para servir",
  POR_PAGAR: "Por pagar",
};

const ICONO_TIPO: Record<string, LucideIcon> = {
  PROTEINA: Drumstick,
  PRINCIPIO: Wheat,
  ENSALADA: Salad,
  SOPA: Soup,
  BEBIDA: CupSoda,
  ADICIONAL: Star,
};

const CLASE_TIPO: Record<string, string> = {
  PROTEINA: "bg-amber-brand/10 text-amber-brand",
  PRINCIPIO: "bg-success/10 text-success-text",
  ENSALADA: "bg-menta-text/10 text-menta-text",
  SOPA: "bg-violeta-text/10 text-violeta-text",
  BEBIDA: "bg-info-text/10 text-info-text",
  ADICIONAL: "bg-orange-brand/10 text-orange-brand",
};

type Filtro = "TODAS" | EstadoMesa;

const FILTROS: Array<{ valor: Filtro; etiqueta: string }> = [
  { valor: "TODAS", etiqueta: "Todas" },
  { valor: "LIBRE", etiqueta: "Libres" },
  { valor: "OCUPADA", etiqueta: "Ocupadas" },
  { valor: "POR_PAGAR", etiqueta: "Por pagar" },
];

/** Quita acentos para que «Mesa Á» encuentre también «a» */
function normaliza(t: string): string {
  return t
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Minutos transcurridos desde el pedido; null si la mesa está libre */
function minutosDe(desde: number | null, ahora: number): number | null {
  if (desde === null) return null;
  return Math.max(0, Math.floor((ahora - desde) / 60_000));
}

/** FLIP manual del panel: lo calcula ModalFlip (compartido con Domicilios) */

function TarjetaMesa({
  mesa,
  ahora,
  registrar,
  onAbrir,
}: {
  mesa: MesaDetalle;
  ahora: number;
  registrar: (el: HTMLButtonElement | null) => void;
  onAbrir: (rect: DOMRect) => void;
}) {
  const estado = mesa.estado as EstadoMesa;
  const minutos = minutosDe(mesa.desde, ahora);
  const ocupada = mesa.comandas.length > 0;

  return (
    <button
      ref={registrar}
      type="button"
      onClick={(e) => onAbrir(e.currentTarget.getBoundingClientRect())}
      className="tarjeta-mesa mesas-card group"
      data-estado={estado}
      aria-label={mesa.nombre + ", " + TEXTO_ESTADO[estado] + ". Ver detalle"}
    >
      <div className="mesas-card-top">
        <span className="mesas-card-icon"><UtensilsCrossed size={21} aria-hidden /></span>
        <span className={"mesas-status " + ESTILO_ESTADO[estado]}><span className="mesas-dot" />{TEXTO_ESTADO[estado]}</span>
      </div>
      <span className="mesas-card-name">{mesa.nombre}</span>
      <span className="mesas-card-meta">
        {ocupada ? <><span><Utensils size={14} aria-hidden />{mesa.platos} {mesa.platos === 1 ? "plato" : "platos"}</span>
          {minutos !== null && <span><Clock size={14} aria-hidden />{minutos} min</span>}</>
          : <span>{estado === "LIBRE" ? "Lista para recibir clientes" : "Sin comandas activas"}</span>}
      </span>
      <span className="mesas-card-bottom">
        <span><span className="mesas-card-caption">{ocupada ? "Cuenta actual" : "Sin consumo registrado"}</span>
          <strong>{ocupada ? formatCOP(mesa.total) : estado === "LIBRE" ? "Disponible" : "Ver detalle"}</strong></span>
        <span className="mesas-card-arrow"><ArrowUpRight size={19} aria-hidden /></span>
      </span>
    </button>
  );
}

function Dato({
  etiqueta,
  valor,
  acento,
}: {
  etiqueta: string;
  valor: string;
  acento?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-panel-app px-3 py-3 ring-1 ring-borde-app">
      <p className="text-xs font-bold text-texto-muted/60">{etiqueta}</p>
      <p
        className={
          "mt-1.5 font-display text-xl leading-none " +
          (acento ? "text-amber-brand" : "text-texto-app")
        }
      >
        {valor}
      </p>
    </div>
  );
}

function ModalMesa({
  mesa,
  origen,
  ahora,
  onClose,
}: {
  mesa: MesaDetalle;
  /** rect de la ficha que abrió el modal: el panel nace ahí y allí se pliega */
  origen: { x: number; y: number; w: number; h: number };
  ahora: number;
  onClose: () => void;
}) {
  const estado = mesa.estado as EstadoMesa;
  const minutos = minutosDe(mesa.desde, ahora);
  const ocupada = mesa.comandas.length > 0;

  return (
    // La animación GSAP (apertura FLIP desde la ficha, cascada del contenido
    // y cierre pliegando de regreso) vive en ModalFlip, compartida.
    <ModalFlip
      origen={origen}
      onClose={onClose}
      ariaLabel={`Detalle de la mesa ${mesa.nombre}`}
    >
      {(cerrar) => (
        <>
          {/* Cabecera */}
          <div
            data-anim
            className="flex items-start justify-between gap-3 border-b border-borde-app/50 p-5"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-3xl leading-none text-texto-app">
                {mesa.nombre}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
                    ESTILO_ESTADO[estado]
                  }
                >
                  {TEXTO_ESTADO[estado]}
                </span>
                {minutos !== null ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-texto-muted/60">
                    <Clock className="h-3.5 w-3.5" /> Lleva {minutos} min
                  </span>
                ) : null}
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

          {ocupada ? (
            <>
              <div
                data-anim
                className="grid grid-cols-3 gap-2 border-b border-borde-app/50 px-5 py-4"
              >
                <Dato etiqueta="Platos" valor={String(mesa.platos)} />
                <Dato
                  etiqueta="Comandas"
                  valor={String(mesa.comandas.length)}
                />
                <Dato etiqueta="Total" valor={formatCOP(mesa.total)} acento />
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {mesa.comandas.map((comanda) => (
                    <div
                      key={comanda.id}
                      data-anim
                      className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-texto-app">
                          Comanda #{comanda.id}
                        </span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                            (CHIP_COMANDA[comanda.estado] ??
                              "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
                          }
                        >
                          {TXT_COMANDA[comanda.estado] ?? comanda.estado}
                        </span>
                        {comanda.paraLlevar ? (
                          <span className="flex items-center gap-1 rounded-full bg-orange-brand/10 px-2 py-0.5 text-[10px] font-bold text-orange-brand ring-1 ring-orange-brand/20">
                            <ShoppingBag className="h-3 w-3" /> Para llevar
                          </span>
                        ) : null}
                        <span className="ml-auto flex items-center gap-1 text-[11px] text-texto-muted/45">
                          <Clock className="h-3 w-3" /> {comanda.hora}
                        </span>
                      </div>

                      <ul className="mt-2.5 space-y-1.5">
                        {comanda.items.map((item, i) => {
                          const Icono = ICONO_TIPO[item.tipo] ?? UtensilsCrossed;
                          return (
                            <li
                              key={`${comanda.id}-${i}`}
                              className="flex items-center gap-2.5 text-sm"
                            >
                              <span
                                className={
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg " +
                                  (CLASE_TIPO[item.tipo] ??
                                    "bg-panel-app text-texto-muted/60")
                                }
                              >
                                <Icono className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0 flex-1 font-bold text-texto-app">
                                {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                                {item.nombre}
                              </span>
                              {item.precio > 0 ? (
                                <span className="shrink-0 text-xs font-bold text-texto-muted/70">
                                  {formatCOP(item.precio * item.cantidad)}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>

                      {comanda.observaciones ? (
                        <p className="mt-2 text-xs text-texto-muted/45">
                          {comanda.observaciones}
                        </p>
                      ) : null}
                    </div>
                  ))}
              </div>

              <div data-anim className="border-t border-borde-app/50 p-5">
                <Link
                  href="/admin/caja"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-brand py-3.5 font-display text-lg text-brown-950 transition hover:bg-orange-brand hover:text-texto-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brown-950"
                >
                  <Wallet className="h-5 w-5" /> Cobrar {formatCOP(mesa.total)}
                </Link>
              </div>
            </>
          ) : (
            <div
              data-anim
              className="flex flex-col items-center gap-2 px-5 py-12 text-center"
            >
              <UtensilsCrossed className="h-8 w-8 text-texto-muted/35" />
              <p className="font-display text-xl text-texto-app">Mesa disponible</p>
              <p className="max-w-xs text-sm text-texto-muted/50">
                Aún no hay comandas en esta mesa. El mesero puede tomar el primer
                pedido desde su dispositivo.
              </p>
            </div>
          )}
        </>
      )}
    </ModalFlip>
  );
}

export function TableroMesas({
  mesas,
  ahoraServidor,
}: {
  mesas: MesaDetalle[];
  /** Hora de la solicitud fijada en el servidor: el primer pintado (SSR) y la
      hidratación muestran exactamente los mismos minutos, sin pasos a «null» */
  ahoraServidor: number;
}) {
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [texto, setTexto] = useState("");
  const [seleccion, setSeleccion] = useState<{
    mesa: MesaDetalle;
    origen: { x: number; y: number; w: number; h: number };
  } | null>(null);
  // Nace con la hora del servidor: primera pintura = hidratación, cero
  // cambios de contenido entre lo que revela el HTML y lo que toma JS
  const [ahora, setAhora] = useState(ahoraServidor);

  const gridRef = useRef<HTMLDivElement>(null);
  /** Fichas por mesa.id: al abrir el modal recordamos dónde nace el panel */
  const fichas = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    // El tablero ya nace con la hora correcta; el reloj solo sigue en vivo
    const reloj = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(reloj);
  }, []);

  const textoBusqueda = normaliza(texto);
  const visibles = mesas.filter((m) => {
    const porEstado = filtro === "TODAS" || m.estado === filtro;
    const porNombre = !textoBusqueda || normaliza(m.nombre).includes(textoBusqueda);
    return porEstado && porNombre;
  });

  // Entrada única del tablero: carga inicial, cambio de filtro o de búsqueda
  // se resuelven todos aquí. El HTML de SSR deja las fichas ocultas solo por
  // CSS (globals.css, .escenario-cascada); soltar esa clase y animar sucede
  // en el mismo frame antes del próximo pintado, así nunca existió el paso
  // intermedio «aparecen → se ocultan → cascada» que se notaba como carga doble.
  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;
      const nodos = grid.querySelectorAll<HTMLElement>(".tarjeta-mesa");
      if (nodos.length === 0) return;
      const reducido = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      grid.classList.remove("escenario-cascada");
      if (reducido) return;
      gsap.fromTo(
        nodos,
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
    // visibles.length cubre el regreso desde el estado vacío: al re-crear el
    // grid, ese nodo vuelve con la clase de entrada y aquí se libera otra vez
    { dependencies: [filtro, textoBusqueda, visibles.length], scope: gridRef },
  );

  // Resumen del salón, calculado siempre sobre TODAS las mesas
  const libres = mesas.filter((m) => m.estado === "LIBRE").length;
  const ocupadas = mesas.filter((m) => m.estado === "OCUPADA").length;
  const porPagar = mesas.filter((m) => m.estado === "POR_PAGAR").length;
  const platosVivos = mesas.reduce((suma, m) => suma + m.platos, 0);
  const totalVivo = mesas.reduce((suma, m) => suma + m.total, 0);
  const porEstado: Record<Filtro, number> = {
    TODAS: mesas.length,
    LIBRE: libres,
    OCUPADA: ocupadas,
    POR_PAGAR: porPagar,
  };

  return (
    <>
      {/* sin JS el CSS de entrada dejaría las fichas ocultas: neutralizarlo */}
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            "<style>.escenario-cascada .tarjeta-mesa{opacity:1!important}</style>",
        }}
      />

      <header className="mesas-heading">
        <div><p className="mesas-eyebrow">GESTIÓN DEL SALÓN</p><h1>Mesas</h1>
          <p>Todo tu salón, de un vistazo. Selecciona una mesa para ver su cuenta.</p></div>
        <Link href="/admin/caja" className="mesas-caja"><Wallet size={18} aria-hidden /> Ir a caja <ArrowUpRight size={16} aria-hidden /></Link>
      </header>
      <section className="mesas-stats" aria-label="Resumen del salón">
        {[
          { etiqueta: "Mesas disponibles", valor: String(libres), detalle: mesas.length + " mesas en el salón", Icono: Check, tono: "libres" },
          { etiqueta: "Mesas en servicio", valor: String(ocupadas + porPagar), detalle: platosVivos + " platos en mesas", Icono: Utensils, tono: "servicio" },
          { etiqueta: "Por pagar", valor: String(porPagar), detalle: "Pendientes de cobro", Icono: Banknote, tono: "pagar" },
          { etiqueta: "Total en mesas", valor: formatCOP(totalVivo), detalle: "Consumo activo del salón", Icono: Wallet, tono: "total" },
        ].map(({ etiqueta, valor, detalle, Icono, tono }) => (
          <div key={etiqueta} className="mesas-stat" data-tono={tono}>
            <span className="mesas-stat-icon"><Icono size={21} aria-hidden /></span>
            <div><p>{etiqueta}</p><strong>{valor}</strong><span>{detalle}</span></div>
          </div>
        ))}
      </section>
      <div className="mesas-section-heading"><h2><LayoutGrid size={18} aria-hidden /> Mesas del salón</h2>
        <span aria-live="polite">{visibles.length} de {mesas.length} mesas</span></div>

      {/* Filtrado y búsqueda */}
      <div className="mesas-toolbar">
        <div
          role="group"
          aria-label="Filtrar mesas por estado"
          className="mesas-filters"
        >
          {FILTROS.map(({ valor, etiqueta }) => {
            const activo = filtro === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltro(valor)}
                aria-pressed={activo}
                className={
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 " +
                  (activo
                    ? "bg-amber-brand text-brown-950"
                    : "text-texto-muted hover:text-texto-app")
                }
              >
                {etiqueta}
                <span
                  className={
                    "tabular-nums " + (activo ? "text-brown-950/70" : "text-texto-muted/50")
                  }
                >
                  {porEstado[valor]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mesas-search relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-muted/50"
            aria-hidden
          />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            type="search"
            placeholder="Buscar mesa…"
            aria-label="Buscar mesa por nombre"
            className="h-11 w-full rounded-xl border-0 bg-panel-app pl-9 pr-3 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/30 focus:ring-2 focus:ring-amber-brand/60"
          />
        </div>
      </div>

      {visibles.length > 0 ? (
        <div
          ref={gridRef}
          className="escenario-cascada mesas-grid"
        >
          {visibles.map((mesa) => (
            <TarjetaMesa
              key={mesa.id}
              mesa={mesa}
              ahora={ahora}
              registrar={(el) => {
                if (el) fichas.current.set(mesa.id, el);
                else fichas.current.delete(mesa.id);
              }}
              onAbrir={(rect) =>
                setSeleccion({
                  mesa,
                  origen: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
                })
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[2rem] bg-panel-app p-10 text-center ring-1 ring-borde-app">
          <p className="font-display text-xl text-texto-app">
            {mesas.length > 0 ? "Ninguna mesa coincide" : "Sin mesas visibles"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-texto-muted/60">
            {mesas.length > 0
              ? "Cambiar el filtro o el término de búsqueda vuelve a traer todas las mesas."
              : "Crea el salón desde Configuración en la sección Mesas del salón."}
          </p>
          {mesas.length > 0 && <button type="button" className="mesas-reset" onClick={() => { setFiltro("TODAS"); setTexto(""); }}>Ver todas las mesas</button>}
        </div>
      )}

      {seleccion
        ? createPortal(
            <ModalMesa
              key={seleccion.mesa.id}
              mesa={seleccion.mesa}
              origen={seleccion.origen}
              ahora={ahora}
              onClose={() => setSeleccion(null)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
