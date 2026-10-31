"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
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
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCOP } from "@/lib/format";
import type { EstadoMesa } from "@/lib/roles";

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
  EN_PREPARACION: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  PARCIAL_SERVIDO: "bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20",
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
  ENSALADA: "bg-[#4ec27e]/10 text-[#8fdcae]",
  SOPA: "bg-[#b06fd0]/10 text-[#d3a7e8]",
  BEBIDA: "bg-[#4aa3ff]/10 text-[#8fc6ff]",
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

/** FLIP manual: rectángulo de origen vs. final */
function centroDe(r: DOMRect) {
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

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
      className="tarjeta-mesa group flex flex-col rounded-2xl bg-panel-app p-5 text-left ring-1 ring-borde-app transition duration-200 hover:-translate-y-0.5 hover:ring-amber-brand/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand active:translate-y-0 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-display text-2xl text-texto-app">
          {mesa.nombre}
        </span>
        <span
          className={
            "shrink-0 rounded-full px-3 py-1 text-xs font-bold " +
            ESTILO_ESTADO[estado]
          }
        >
          {TEXTO_ESTADO[estado]}
        </span>
      </div>

      {ocupada ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-texto-muted/60">
            <span className="flex items-center gap-1">
              <Utensils className="h-3.5 w-3.5" /> {mesa.platos}{" "}
              {mesa.platos === 1 ? "plato" : "platos"}
            </span>
            {minutos !== null ? (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {minutos} min
              </span>
            ) : null}
          </div>
          <p className="mt-3 font-display text-xl text-texto-app">
            {formatCOP(mesa.total)}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-texto-muted/45">
          Disponible para clientes
        </p>
      )}

      <span className="mt-4 h-1 w-8 rounded-full bg-amber-brand/30 transition-all duration-200 group-hover:w-14 group-hover:bg-amber-brand" />
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrandoRef = useRef(false);

  const { contextSafe } = useGSAP(
    () => {
      const panel = panelRef.current;
      const overlay = overlayRef.current;
      if (!panel || !overlay) return;

      const filas = panel.querySelectorAll<HTMLElement>("[data-anim]");
      const reducido = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reducido || !origen) {
        gsap.set([overlay, panel, ...filas], { autoAlpha: 1 });
        return;
      }

      // El panel mide su posición final ANTES de pintarse (useGSAP corre en
      // layout effect): sin parpadeo del panel en el centro.
      const final = panel.getBoundingClientRect();
      const fc = centroDe(final);
      gsap.set(panel, {
        transformOrigin: "50% 50%",
        x: origen.x + origen.w / 2 - fc.cx,
        y: origen.y + origen.h / 2 - fc.cy,
        scaleX: origen.w / final.width,
        scaleY: origen.h / final.height,
        autoAlpha: 1, // la superficie nace donde está la mesa y crece de ahí
      });
      gsap.set([overlay, ...filas], { autoAlpha: 0 });

      // Apertura: mesa → superficie expansión y luego el contenido en cascada
      gsap
        .timeline()
        .to(overlay, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, 0)
        .to(
          panel,
          { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.55, ease: "power4.inOut" },
          0.06,
        )
        .fromTo(
          filas,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.38,
            ease: "power3.out",
            stagger: 0.05,
          },
          0.32,
        );
    },
    { scope: panelRef },
  );

  // Cierre asimétrico: el contenido se recoge primero y el panel se pliega
  // de regreso hacia la ficha que abrió el modal.
  const cerrar = useCallback(() => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;

    const panel = panelRef.current;
    const overlay = overlayRef.current;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!panel || !overlay || !origen || reducido) {
      onClose();
      return;
    }

    contextSafe(() => {
      const filas = panel.querySelectorAll<HTMLElement>("[data-anim]");
      const r = panel.getBoundingClientRect();
      const c = centroDe(r);
      gsap
        .timeline({ onComplete: onClose })
        .to(
          filas,
          {autoAlpha: 0, y: -8, duration: 0.13, stagger: 0.012, ease: "power2.in"},
          0,
        )
        .to(
          panel,
          {
            x: origen.x + origen.w / 2 - c.cx,
            y: origen.y + origen.h / 2 - c.cy,
            scaleX: origen.w / r.width,
            scaleY: origen.h / r.height,
            duration: 0.42,
            ease: "power3.inOut",
            overwrite: "auto",
          },
          0.08,
        )
        .to(overlay, { autoAlpha: 0, duration: 0.26, ease: "power2.in" }, 0.16);
    })();
  }, [contextSafe, onClose, origen]);

  // Escape para cerrar y bloqueo del scroll de fondo mientras está abierto
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = anterior;
    };
  }, [cerrar]);

  const estado = mesa.estado as EstadoMesa;
  const minutos = minutosDe(mesa.desde, ahora);
  const ocupada = mesa.comandas.length > 0;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de la mesa ${mesa.nombre}`}
      onClick={cerrar}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-brown-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-fondo-app shadow-pop ring-1 ring-borde-app"
      >
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
                            {item.tipo === "PROTEINA" && item.conSopa === false ? (
                              <span className="shrink-0 rounded-md bg-panel-app px-1.5 py-0.5 text-[10px] font-bold text-texto-muted/60 ring-1 ring-borde-app">
                                sin sopa
                              </span>
                            ) : null}
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
      </div>
    </div>
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

      {/* Resumen del salón: cuatro cifras, un solo acento */}
      <div className="mb-5 flex flex-wrap items-stretch gap-x-7 gap-y-4">
        {[
          { etiqueta: "Ocupadas", valor: `${ocupadas} de ${mesas.length}` },
          { etiqueta: "Por pagar", valor: String(porPagar) },
          { etiqueta: "Platos en mesas", valor: String(platosVivos) },
        ].map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="min-w-[7.5rem] border-l border-borde-app pl-4 first:border-l-0 first:pl-0">
            <p className="font-display text-2xl leading-none text-texto-app">
              {valor}
            </p>
            <p className="mt-1.5 text-xs text-texto-muted/70">{etiqueta}</p>
          </div>
        ))}
        <div className="min-w-[9.5rem] border-l border-borde-app pl-4">
          <p className="font-display text-2xl leading-none text-amber-brand">
            {formatCOP(totalVivo)}
          </p>
          <p className="mt-1.5 text-xs text-texto-muted/70">Total en mesas</p>
        </div>
      </div>

      {/* Filtrado y búsqueda */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filtrar mesas por estado"
          className="inline-flex flex-wrap gap-1 rounded-xl bg-campo-app p-1 ring-1 ring-borde-app"
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

        <div className="relative min-w-0 flex-1 sm:max-w-56">
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
            className="h-9 w-full rounded-xl border-0 bg-panel-app pl-9 pr-3 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/30 focus:ring-2 focus:ring-amber-brand/60"
          />
        </div>
      </div>

      {visibles.length > 0 ? (
        <div
          ref={gridRef}
          className="escenario-cascada grid items-start gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
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
