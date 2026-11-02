"use client";

import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { fijarTemaDelDispositivo } from "@/app/tema/acciones";
import type { Theme } from "@/lib/config";

const OPCIONES: Array<{ valor: Theme; titulo: string; Icono: typeof Sun }> = [
  { valor: "light", titulo: "Modo claro", Icono: Sun },
  { valor: "dark", titulo: "Modo oscuro", Icono: Moon },
];

/**
 * Selector compacto de claro/oscuro para las cabeceras (mesero). Guarda el
 * modo en la cookie del dispositivo y refresca para repintar la pantalla.
 */
export function SelectorTemaDispositivo({ temaActual }: { temaActual: Theme }) {
  const [pendiente, empezar] = useTransition();
  const refrescar = useRouter();

  function cambiar(nuevo: Theme) {
    if (nuevo === temaActual || pendiente) return;
    empezar(async () => {
      await fijarTemaDelDispositivo(nuevo);
      refrescar.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Modo de la pantalla"
      className="flex items-center gap-1.5"
    >
      {OPCIONES.map(({ valor, titulo, Icono }) => {
        const activo = temaActual === valor;
        return (
          <button
            key={valor}
            type="button"
            onClick={() => cambiar(valor)}
            disabled={pendiente}
            aria-pressed={activo}
            title={titulo}
            aria-label={titulo}
            className={
              "flex h-10 w-10 items-center justify-center rounded-full ring-1 transition disabled:opacity-60 " +
              (activo
                ? "bg-amber-brand text-brown-950 ring-amber-brand/60"
                : "bg-panel-app text-texto-muted/60 ring-borde-app hover:text-texto-app")
            }
          >
            <Icono aria-hidden className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
