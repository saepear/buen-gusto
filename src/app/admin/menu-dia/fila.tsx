"use client";

import { CheckCircle2, Eye, EyeOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatCOP } from "@/lib/format";
import { guardarPorcion, guardarPrecioEspecial, alternarVisible, quitarDelMenu } from "./actions";

type Item = {
  id: number;
  stockPorciones: number | null;
  vendidos: number;
  visible: boolean;
  /** null = hoy rige el precio normal; > 0 = especial (asados del domingo) */
  precioEspecial: number | null;
  producto: { nombre: string; tipo: string };
};

export function FilaPorciones({ item }: { item: Item }) {
  const [ilimitado, setIlimitado] = useState(item.stockPorciones === null);
  // El precio especial del plato solo vive en la proteína (ella cobra el
  // almuerzo entero); los demás tipos no lo necesitan.
  const esProteina = item.producto.tipo === "PROTEINA";

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
        "rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app lg:p-5 " +
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

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2.5">
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
            className="w-24 rounded-lg border-0 bg-panel-app px-2.5 py-2 text-right text-sm text-texto-app ring-1 ring-borde-app focus:ring-amber-brand/60 disabled:opacity-40"
          />
          <button
            type="submit"
            aria-label={`Guardar porciones de ${item.producto.nombre}`}
            title="Guardar porciones"
            className="rounded-lg bg-panel-app p-2 text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand/30"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </form>
        {esProteina ? (
          <form action={guardarPrecioEspecial} className="flex items-center gap-1.5">
            <input type="hidden" name="itemId" value={item.id} />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-texto-muted/70">
              Precio
              <span className="sr-only">
                especial de {item.producto.nombre} para hoy
              </span>
              <input
                type="number"
                name={`precio_${item.id}`}
                min={0}
                max={999999}
                step={1}
                defaultValue={item.precioEspecial ?? ""}
                placeholder="Especial"
                inputMode="numeric"
                className="w-28 rounded-lg border-0 bg-panel-app px-2.5 py-2 text-right text-sm text-texto-app ring-1 ring-borde-app focus:ring-amber-brand/60"
              />
            </label>
            <button
              type="submit"
              aria-label={`Guardar el precio especial de ${item.producto.nombre}`}
              title="Guardar el precio especial de hoy (el plato cobra este precio con o sin sopa)"
              className="rounded-lg bg-panel-app p-2 text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand/30"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </form>
        ) : null}
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
      {esProteina && item.precioEspecial !== null && item.precioEspecial > 0 ? (
        <p className="mt-2 rounded-lg bg-amber-brand/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-brand">
          Especial de hoy: {formatCOP(item.precioEspecial)} · el plato cobra
          este precio con o sin sopa (+ icopor si va para llevar)
        </p>
      ) : null}
    </li>
  );
}

