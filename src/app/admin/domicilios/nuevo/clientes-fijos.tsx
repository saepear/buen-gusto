"use client";

import {
  ChevronDown,
  ClipboardList,
  Search,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCOP } from "@/lib/format";

/** Cliente con historia de domicilios: su chip precarga el último pedido */
export type ClienteFijo = {
/** Id de su último domicilio (el que precarga el formulario) */
  domicilioId: number;
  cliente: string;
  telefono: string;
  pedidos: number;
  /** Resumen legible de lo que pidió la última vez */
  resumen: string;
  /** Total de aquella última vez */
  total: number;
  /** Dónde vive y cuándo le gusta recibir (de su última entrega) */
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  horaEntrega: string | null;
};

/**
 * Historial de clientes: cerrado por defecto para no tapar el flujo de crear
 * domicilios. Dentro hay buscador y, por cliente, «Realizar pedido» (abre el
 * formulario con sus datos y su último pedido ya cargados, listo para ajustar
 * y confirmar).
 */
export function ClientesFijos({ clientes }: { clientes: ClienteFijo[] }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  // El filtro por nombre y por teléfono (con o sin 3/60): «5500» encuentra
  // «5555»… mejor por dígitos y sin acentos
  const filtro = busqueda.trim().toLowerCase();
  const digitos = filtro.replace(/\D/g, "");
  const visibles = useMemo(() => {
    if (!filtro) return clientes;
    return clientes.filter(
      (c) =>
        c.cliente.toLowerCase().includes(filtro) ||
        (digitos.length > 0 && c.telefono.includes(digitos)),
    );
  }, [clientes, filtro, digitos]);

  if (clientes.length === 0) return null;

  return (
    <section aria-label="Historial de clientes" className="mb-6">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left transition hover:px-2"
      >
        <span className="flex items-center gap-2 font-display text-lg leading-none text-texto-app">
          <UsersRound aria-hidden className="h-4.5 w-4.5 text-amber-brand" />
          Historial de Clientes
          <span className="rounded-full bg-panel-app px-2 py-0.5 text-[10px] font-bold text-texto-muted/60 ring-1 ring-borde-app">
            {clientes.length}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="hidden truncate text-xs text-texto-muted/50 sm:block">
            Vuelven de siempre: «Realizar pedido» los carga solos
          </span>
          <ChevronDown
            aria-hidden
            className={
              "h-4 w-4 shrink-0 text-texto-muted/50 transition-transform duration-200 " +
              (abierto ? "rotate-180" : "")
            }
          />
        </span>
      </button>

      {abierto ? (
        <div className="mt-3">
          {/* Buscador: por nombre o por números del teléfono */}
          <label className="flex items-center gap-2.5 rounded-2xl bg-panel-app px-3.5 py-2.5 ring-1 ring-borde-app focus-within:ring-2 focus-within:ring-amber-brand/60">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-texto-muted/35" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar cliente por nombre o teléfono…"
              aria-label="Buscar cliente en el historial"
              autoComplete="off"
              className="w-full bg-transparent text-sm text-texto-app outline-none placeholder:text-texto-muted/30"
            />
          </label>

          {visibles.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-borde-app bg-panel-app px-4 py-6 text-center text-sm text-texto-muted/50">
              Ningún cliente coincide con «{busqueda.trim()}».
            </p>
          ) : (
            /* Misma fila lateral de siempre: horizontal, sin empujar el
               formulario fuera de la primera pantalla */
            <div className="mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1.5">
              {visibles.map((c) => (
                <article
                  key={c.telefono}
                  className="flex w-[16.5rem] shrink-0 snap-start flex-col rounded-2xl bg-panel-app p-3.5 ring-1 ring-borde-app transition hover:ring-amber-brand/40"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-brand/15 font-display text-lg text-amber-brand ring-1 ring-amber-brand/30"
                    >
                      {c.cliente.trim().charAt(0).toUpperCase() || "·"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold leading-tight text-texto-app">
                        {c.cliente}
                      </p>
                      <p className="text-[10px] font-bold text-texto-muted/40">
                        {c.pedidos}{" "}
                        {c.pedidos === 1
                          ? "pedido con nosotros"
                          : "pedidos con nosotros"}
                      </p>
                    </div>
                  </div>

                  {/* Lo pidió la última vez y dónde: pulso a la vista */}
                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-texto-muted/75">
                    {c.resumen}
                  </p>
                  <p className="mt-1.5 line-clamp-1 text-[11px] text-texto-muted/50">
                    {c.direccion || "Sin dirección registrada"}
                    {c.barrio ? ` · ${c.barrio}` : ""}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                    <span
                      className="min-w-0 truncate text-[11px] font-bold text-texto-muted/45"
                      title={`Tel ${c.telefono}`}
                    >
                      Tel {c.telefono.slice(-4)}
                    </span>
                    <span className="font-display text-md tabular-nums text-texto-app">
                      {formatCOP(c.total)}
                    </span>
                  </div>

                  {/* Realizar pedido: el formulario abre con estos datos */}
                  <Link
                    href={`/admin/domicilios/nuevo?para=${c.domicilioId}`}
                    title="Abre el formulario con los datos de este cliente"
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-success/12 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/25 transition hover:bg-success/25 active:scale-[0.97]"
                  >
                    <ClipboardList aria-hidden className="h-3.5 w-3.5" />
                    Realizar pedido
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
