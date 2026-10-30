"use client";

import { CheckCircle2, Plus, Power, Trash2 } from "lucide-react";
import { useActionState } from "react";
import { formatCOP } from "@/lib/format";
import {
  TIPO_PRODUCTO,
  TIPO_PRODUCTO_LABEL,
  type TipoProducto,
} from "@/lib/roles";
import {
  crearProducto,
  editarProducto,
  eliminarProducto,
  reactivarProducto,
  type EstadoAccion,
} from "./actions";

const ESTADO_INICIAL: EstadoAccion = { error: null };
const TIPOS: TipoProducto[] = [
  TIPO_PRODUCTO.PROTEINA,
  TIPO_PRODUCTO.PRINCIPIO,
  TIPO_PRODUCTO.ENSALADA,
  TIPO_PRODUCTO.SOPA,
  TIPO_PRODUCTO.BEBIDA,
  TIPO_PRODUCTO.ADICIONAL,
];

export function FormularioNuevoProducto() {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    crearProducto,
    ESTADO_INICIAL,
  );

  return (
    <form
      action={accion}
      className="rounded-[2rem] bg-glass-app p-6 text-texto-app ring-1 ring-borde-app"
    >
      <h2 className="font-display text-xl text-amber-brand">Nuevo producto</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="block text-sm">
          <span className="mb-1 block text-texto-muted/85">Nombre</span>
          <input
            name="nombre"
            required
            maxLength={40}
            placeholder="Ej: Costilla ahumada"
            className="w-full rounded-2xl border-0 bg-panel-app px-3 py-2.5 text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-texto-muted/85">Tipo</span>
          <select
            name="tipo"
            required
            className="rounded-2xl border-0 bg-panel-app px-3 py-2.5 text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_PRODUCTO_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-texto-muted/85">Precio (COP)</span>
          <input
            name="precio"
            type="number"
            min={0}
            max={9999999}
            step={1}
            defaultValue={0}
            className="w-32 rounded-2xl border-0 bg-panel-app px-3 py-2.5 text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60"
          />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="flex items-center justify-center gap-2 rounded-2xl bg-amber-brand px-4 py-2.5 font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Crear
        </button>
      </div>
      {estado.error && (
        <p className="mt-3 text-sm font-semibold text-[#ffb4a9]">{estado.error}</p>
      )}
      {estado.ok && !estado.error && (
        <p className="mt-3 text-sm font-semibold text-[#b9d98a]">{estado.ok}</p>
      )}
    </form>
  );
}

export function TarjetaProducto({
  id,
  nombre,
  precio,
  activo,
}: {
  id: number;
  nombre: string;
  precio: number;
  activo: boolean;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    editarProducto,
    ESTADO_INICIAL,
  );

  return (
    <div
      className={
        "rounded-2xl bg-panel-app p-4 ring-1 transition " +
        (activo ? "ring-borde-app" : "ring-danger/30 opacity-60")
      }
    >
      <form
        action={accion}
        className="grid grid-cols-[1fr_auto] items-end gap-2"
      >
        <input type="hidden" name="id" value={id} />
        <label className="block">
          <span className="sr-only">Nombre</span>
          <input
            name="nombre"
            defaultValue={nombre}
            maxLength={40}
            className="w-full rounded-lg border-0 bg-panel-app px-2.5 py-1.5 font-bold text-texto-app ring-1 ring-inset ring-borde-app focus:ring-amber-brand/60"
          />
        </label>
        <label className="block w-28">
          <span className="sr-only">Precio</span>
          <input
            name="precio"
            type="number"
            min={0}
            step={1}
            defaultValue={precio}
            className="w-full rounded-lg border-0 bg-panel-app px-2.5 py-1.5 text-right text-sm text-texto-app ring-1 ring-inset ring-borde-app focus:ring-amber-brand/60"
          />
        </label>
        <div className="col-span-2 flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-texto-muted/45">
            {precio > 0
              ? `${formatCOP(precio)} · con precio propio`
              : "Incluido en el almuerzo"}
          </span>
          <button
            type="submit"
            aria-label={`Guardar cambios de ${nombre}`}
            disabled={pendiente}
            title="Guardar cambios"
            className="rounded-lg bg-panel-app px-2.5 py-1.5 text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover hover:text-texto-app"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </div>
      </form>
      {estado.error && (
        <p className="mt-1 text-xs font-semibold text-danger-text">{estado.error}</p>
      )}
      <form action={activo ? eliminarProducto : reactivarProducto} className="mt-2">
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          aria-label={activo ? `Eliminar ${nombre}` : `Reactivar ${nombre}`}
          title={
            activo
              ? "Eliminar: se oculta del catálogo y del menú del día; el historial no se toca"
              : "Reactivar"
          }
          className={
            "flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition " +
            (activo
              ? "bg-danger/10 text-danger-text ring-1 ring-danger/20 hover:bg-danger/20"
              : "bg-success/10 text-success-text ring-1 ring-success/20 hover:bg-success/25")
          }
        >
          {activo ? (
            <>
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </>
          ) : (
            <>
              <Power className="h-3.5 w-3.5" /> Reactivar
            </>
          )}
        </button>
      </form>
    </div>
  );
}

