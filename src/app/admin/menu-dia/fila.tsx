"use client";

import { CheckCircle2, Eye, EyeOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { guardarPorcion, alternarVisible, quitarDelMenu } from "./actions";

type Item = {
  id: number;
  stockPorciones: number | null;
  vendidos: number;
  visible: boolean;
  producto: { nombre: string };
};

export function FilaPorciones({ item }: { item: Item }) {
  const [ilimitado, setIlimitado] = useState(item.stockPorciones === null);

  const restante =
    item.stockPorciones === null
      ? null
      : Math.max(0, item.stockPorciones - item.vendidos);

  const chipClase =
    restante === null
      ? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app"
      : restante === 0
        ? "bg-danger/10 text-danger-text ring-1 ring-danger/20"
        : restante <= 5
          ? "bg-warning/10 text-warning-text ring-1 ring-warning/20"
          : "bg-success/10 text-success-text ring-1 ring-success/20";

  return (
    <li
      className={
        "rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app " +
        (item.visible ? "" : "opacity-70")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 flex-1 font-bold leading-snug text-texto-app">
          {item.producto.nombre}
        </span>
        {!item.visible ? (
          <span className="shrink-0 rounded-full bg-warning/10 px-2.5 py-1 text-[10px] font-bold text-warning-text ring-1 ring-warning/20">
            El mesero no lo ve
          </span>
        ) : null}
        <span
          className={
            "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold " +
            chipClase
          }
        >
          {restante === null ? (
            <>
              Ilimitado
              <span aria-hidden>∞</span>
            </>
          ) : restante === 0 ? (
            "Agotado"
          ) : (
            `Quedan ${restante}`
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2.5">
        <form action={guardarPorcion} className="flex items-center gap-1.5">
          <input type="hidden" name="itemId" value={item.id} />
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-texto-muted/70">
            <input
              type="checkbox"
              name={`ilim_${item.id}`}
              checked={ilimitado}
              onChange={(e) => setIlimitado(e.target.checked)}
              className="h-4 w-4 accent-[#ed7d1f]"
            />
            Sin límite
          </label>
          <input
            type="number"
            name={`stock_${item.id}`}
            min={0}
            max={999}
            step={1}
            defaultValue={item.stockPorciones ?? ""}
            disabled={ilimitado}
            placeholder="Porciones"
            className="w-20 rounded-lg border-0 bg-panel-app px-2 py-1.5 text-right text-sm text-texto-app ring-1 ring-borde-app focus:ring-amber-brand/60 disabled:opacity-40"
          />
          <button
            type="submit"
            aria-label={`Guardar porciones de ${item.producto.nombre}`}
            title="Guardar porciones"
            className="rounded-lg bg-panel-app px-2 py-1.5 text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand/30"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </form>
        <form action={alternarVisible}>
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            aria-label={
              item.visible
                ? `Ocultar ${item.producto.nombre} al mesero`
                : `Mostrar ${item.producto.nombre} al mesero`
            }
            title={
              item.visible
                ? "Ocultar al mesero (p. ej. se acabó antes de tiempo)"
                : "Volver a mostrarle al mesero"
            }
            className="rounded-lg p-2 text-texto-muted/45 transition hover:bg-amber-brand/25 hover:text-texto-app"
          >
            {item.visible ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </form>
        <form action={quitarDelMenu}>
          <input type="hidden" name="itemId" value={item.id} />
          <button
            type="submit"
            aria-label={`Quitar ${item.producto.nombre} del menú`}
            title="Quitar del menú de hoy"
            className="rounded-lg p-2 text-danger-text/70 transition hover:bg-danger/10 hover:text-danger-text"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>
      {item.vendidos > 0 && (
        <p className="mt-2 text-[11px] text-texto-muted/45">
          Vendidas hoy: {item.vendidos}
        </p>
      )}
    </li>
  );
}

