"use client";

import { useActionState, startTransition } from "react";
import { Moon, Sun, Check } from "lucide-react";
import { cambiarTema, type EstadoAccionConfig } from "./acciones-tema";
import { Aviso } from "./usuarios";

type Theme = "dark" | "light";

export function PanelTemas({ temaActual }: { temaActual: Theme }) {
  const [estado, dispatch, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    cambiarTema,
    { error: null, ok: null }
  );

  function manejarCambio(nuevoTema: Theme) {
    if (nuevoTema === temaActual || pendiente) return;
    const datos = new FormData();
    datos.set("tema", nuevoTema);
    startTransition(() => dispatch(datos));
  }

  return (
    <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
      <h2 className="font-display text-xl text-texto-app">Temas</h2>
      <p className="mt-1 text-sm text-texto-muted">
        Personaliza la apariencia visual del sistema.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {/* Modo Oscuro */}
        <button
          onClick={() => manejarCambio("dark")}
          disabled={pendiente}
          className={`relative flex flex-col items-center gap-3 rounded-2xl p-4 transition-all ${
            temaActual === "dark"
              ? "bg-amber-brand text-brown-950 ring-2 ring-amber-brand shadow-lg shadow-amber-brand/20"
              : "bg-panel-app text-texto-muted ring-1 ring-borde-app hover:bg-panel-hover"
          }`}
        >
          <Moon className="h-8 w-8" />
          <span className="font-bold">Modo Oscuro</span>
          {temaActual === "dark" && (
            <div className="absolute top-2 right-2">
              <Check className="h-4 w-4" />
            </div>
          )}
        </button>

        {/* Modo Claro */}
        <button
          onClick={() => manejarCambio("light")}
          disabled={pendiente}
          className={`relative flex flex-col items-center gap-3 rounded-2xl p-4 transition-all ${
            temaActual === "light"
              ? "bg-amber-brand text-brown-950 ring-2 ring-amber-brand shadow-lg shadow-amber-brand/20"
              : "bg-panel-app text-texto-muted ring-1 ring-borde-app hover:bg-panel-hover"
          }`}
        >
          <Sun className="h-8 w-8" />
          <span className="font-bold">Modo Claro</span>
          {temaActual === "light" && (
            <div className="absolute top-2 right-2">
              <Check className="h-4 w-4" />
            </div>
          )}
        </button>
      </div>

      <div className="mt-2">
        <Aviso estado={estado} />
      </div>
    </section>
  );
}

