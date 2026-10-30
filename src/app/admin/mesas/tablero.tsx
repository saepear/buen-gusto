"use client";

import gsap from "gsap";
import {
  Clock,
  CupSoda,
  Drumstick,
  Salad,
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
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCOP } from "@/lib/format";
import type { EstadoMesa } from "@/lib/roles";

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

/** Minutos transcurridos desde el pedido; null mientras el cliente no ha montado */
function minutosDe(desde: number | null, ahora: number | null): number | null {
  if (desde === null || ahora === null) return null;
  return Math.max(0, Math.floor((ahora - desde) / 60_000));
}

function TarjetaMesa({
  mesa,
  ahora,
  onAbrir,
}: {
  mesa: MesaDetalle;
  ahora: number | null;
  onAbrir: () => void;
}) {
  const estado = mesa.estado as EstadoMesa;
  const minutos = minutosDe(mesa.desde, ahora);
  const ocupada = mesa.comandas.length > 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="group flex flex-col rounded-2xl bg-panel-app p-5 text-left ring-1 ring-borde-app transition duration-200 hover:-translate-y-0.5 hover:ring-amber-brand/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand active:translate-y-0 active:scale-[0.99]"
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

      <span className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-texto-muted/40 transition group-hover:text-amber-brand">
        Ver detalle
      </span>
    </button>
  );
}

function Dato({
  Icono,
  etiqueta,
  valor,
}: {
  Icono: LucideIcon;
  etiqueta: string;
  valor: string;
}) {
  return (
    <div className="rounded-2xl bg-panel-app px-3 py-3 ring-1 ring-borde-app">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-texto-muted/40">
        <Icono className="h-3.5 w-3.5" /> {etiqueta}
      </span>
      <p className="mt-1.5 font-display text-xl leading-none text-texto-app">
        {valor}
      </p>
    </div>
  );
}

function ModalMesa({
  mesa,
  ahora,
  onClose,
}: {
  mesa: MesaDetalle;
  ahora: number | null;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrandoRef = useRef(false);

  const cerrar = useCallback(() => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!overlay || !panel || reducido) {
      onClose();
      return;
    }

    const filas = panel.querySelectorAll<HTMLElement>("[data-anim]");
    gsap
      .timeline({ onComplete: onClose, defaults: { ease: "power2.inOut" } })
      .to(filas, { autoAlpha: 0, y: 8, duration: 0.16, stagger: 0.015 }, 0)
      .to(
        panel,
        { autoAlpha: 0, y: 16, scale: 0.965, duration: 0.34, ease: "power3.in" },
        0.03,
      )
      .to(overlay, { autoAlpha: 0, duration: 0.3, ease: "power2.in" }, 0.05);
  }, [onClose]);

  // useLayoutEffect (no useEffect): aplica el estado inicial ANTES del primer
  // render del navegador, así el modal nunca se ve "aparecer" y luego
  // esconderse (ese parpadeo daba la sensación de recarga).
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const filas = panel.querySelectorAll<HTMLElement>("[data-anim]");

    // Estado inicial aplicado sincrónicamente: nada parpadea al montar
    if (reducido) {
      gsap.set([overlay, panel, ...filas], { autoAlpha: 1 });
      return;
    }
    gsap.set([overlay, panel, ...filas], { autoAlpha: 0 });

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    // Apertura suave: sin rebotes (power4.out) y el contenido entra después,
    // en cascada corta, para que el panel no "salte".
    tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, 0)
      .fromTo(
        panel,
        { autoAlpha: 0, y: 36, scale: 0.96 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.52,
          ease: "power4.out",
        },
        0.04,
      )
      .fromTo(
        filas,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.045, ease: "power3.out" },
        0.15,
      );

    return () => {
      tl.kill();
    };
  }, []);

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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-app text-texto-muted/70 ring-1 ring-borde-app transition hover:bg-danger/15 hover:text-danger-text"
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
              <Dato Icono={Utensils} etiqueta="Platos" valor={String(mesa.platos)} />
              <Dato
                Icono={UtensilsCrossed}
                etiqueta="Comandas"
                valor={String(mesa.comandas.length)}
              />
              <Dato Icono={Wallet} etiqueta="Total" valor={formatCOP(mesa.total)} />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                Qué pidió
              </p>
              <div className="space-y-3">
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
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
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
                        📝 {comanda.observaciones}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div
              data-anim
              className="border-t border-borde-app/50 p-5"
            >
              <Link
                href="/admin/caja"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-brand py-3.5 font-display text-lg text-brown-950 transition hover:bg-orange-brand hover:text-texto-app"
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

export function TableroMesas({ mesas }: { mesas: MesaDetalle[] }) {
  const [seleccionada, setSeleccionada] = useState<MesaDetalle | null>(null);
  // Se llena al montar para evitar diferencias de hidratación con el servidor
  const [ahora, setAhora] = useState<number | null>(null);

  useEffect(() => {
    // El primer tick va async (frame) para no llamar setState sincrónico
    // mientras corre el efecto; luego continúa cada 30 s.
    const primera = requestAnimationFrame(() => setAhora(Date.now()));
    const t = setInterval(() => setAhora(Date.now()), 30_000);
    return () => {
      cancelAnimationFrame(primera);
      clearInterval(t);
    };
  }, []);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {mesas.map((mesa) => (
          <TarjetaMesa
            key={mesa.id}
            mesa={mesa}
            ahora={ahora}
            onAbrir={() => setSeleccionada(mesa)}
          />
        ))}
      </div>

      {seleccionada
        ? createPortal(
            <ModalMesa
              mesa={seleccionada}
              ahora={ahora}
              onClose={() => setSeleccionada(null)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
