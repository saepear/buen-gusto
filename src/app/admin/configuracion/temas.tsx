"use client";

import { useActionState, startTransition } from "react";
import { Moon, Sun } from "lucide-react";
import { cambiarTema, type EstadoAccionConfig } from "./acciones-tema";

type Theme = "dark" | "light";

/**
 * Selector de tema en versión compacta: vive en la cabecera de
 * Configuración como un control segmentado, no como un panel propio.
 */
export function SelectorTema({ temaActual }: { temaActual: Theme }) {
  const [estado, dispatch, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    cambiarTema,
    { error: null, ok: null },
  );

  function cambiar(nuevoTema: Theme) {
    if (nuevoTema === temaActual || pendiente) return;
    const datos = new FormData();
    datos.set("tema", nuevoTema);
    startTransition(() => dispatch(datos));
  }

  const opciones: Array<{ valor: Theme; etiqueta: string; Icono: typeof Moon }> = [
    { valor: "light", etiqueta: "Claro", Icono: Sun },
    { valor: "dark", etiqueta: "Oscuro", Icono: Moon },
  ];

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div
        role="group"
        aria-label="Tema de la interfaz"
        className="inline-flex gap-1 rounded-xl bg-campo-app p-1 ring-1 ring-borde-app"
      >
        {opciones.map(({ valor, etiqueta, Icono }) => {
          const activo = temaActual === valor;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => cambiar(valor)}
              disabled={pendiente}
              aria-pressed={activo}
              className={
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-60 " +
                (activo
                  ? "bg-amber-brand text-brown-950"
                  : "text-texto-muted hover:text-texto-app")
              }
            >
              <Icono className="h-4 w-4" /> {etiqueta}
            </button>
          );
        })}
      </div>
      {estado.error ? (
        <p className="text-xs font-bold text-danger-text">{estado.error}</p>
      ) : null}
    </div>
  );
}
