"use client";

import { UserCog } from "lucide-react";
import { useActionState } from "react";
import {
  alternarUsuario,
  crearUsuario,
  guardarPin,
  type EstadoAccionConfig,
} from "./acciones";

const INICIAL: EstadoAccionConfig = { error: null, ok: null };

const ACENTO_ROL: Record<string, string> = {
  ADMIN: "bg-amber-brand/12 text-amber-brand",
  MESERO: "bg-[#4aa3ff]/12 text-[#8fc6ff]",
  DOMICILIARIO: "bg-orange-brand/12 text-orange-brand",
};
const CHIP_ROL: Record<string, string> = {
  ADMIN: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  MESERO: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  DOMICILIARIO: "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
};

const ROL_TXT: Record<string, string> = {
  ADMIN: "Administrador",
  MESERO: "Mesero",
  DOMICILIARIO: "Domiciliario",
};

export function Aviso({ estado }: { estado: EstadoAccionConfig }) {
  if (estado.error) {
    return (
      <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/15">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/15">
        {estado.ok}
      </p>
    );
  }
  return null;
}

export type UsuarioDetalle = {
  id: number;
  nombre: string;
  rol: string;
  pin: string;
  activo: boolean;
};

function FilaUsuario({ usuario }: { usuario: UsuarioDetalle }) {
  const [pinEstado, pinAccion, pinPendiente] = useActionState<
    EstadoAccionConfig,
    FormData
  >(guardarPin, INICIAL);
  const [altEstado, altAccion, altPendiente] = useActionState<
    EstadoAccionConfig,
    FormData
  >(alternarUsuario, INICIAL);

  // Inicial con el acento del rol: la lista se escanea por color, no por lectura
  const inicial = usuario.nombre.trim().charAt(0).toUpperCase() || "·";

  return (
    <div
      className={
        "border-b border-borde-app py-4 " + (usuario.activo ? "" : "opacity-60")
      }
    >
      {/* Identidad: quién es, con qué rol y su PIN alineado a la derecha */}
      <div className="flex items-center gap-3">
        <span
          className={
            "grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-base " +
            (ACENTO_ROL[usuario.rol] ??
              "bg-panel-app text-texto-muted ring-1 ring-borde-app")
          }
          aria-hidden
        >
          {inicial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-texto-app">{usuario.nombre}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
                (CHIP_ROL[usuario.rol] ??
                  "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
              }
            >
              {ROL_TXT[usuario.rol] ?? usuario.rol}
            </span>
            <span
              className={
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
                (usuario.activo
                  ? "bg-success/10 text-success-text ring-1 ring-success/20"
                  : "bg-panel-app text-texto-muted/45 ring-1 ring-borde-app")
              }
            >
              {usuario.activo ? "Activo" : "Inactivo"}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-panel-app px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums text-texto-muted ring-1 ring-borde-app">
          PIN {usuario.pin}
        </span>
      </div>

      {/* Gestión: misma indentación que el nombre, alineada como fila de ajustes */}
      <div className="mt-3 flex flex-wrap items-center gap-2 sm:ml-[3.25rem]">
        <form action={pinAccion} className="flex items-center gap-2">
          <input type="hidden" name="usuarioId" value={usuario.id} />
          <input
            name="nuevoPin"
            inputMode="numeric"
            maxLength={4}
            placeholder="Nuevo PIN"
            aria-label={`Nuevo PIN para ${usuario.nombre}`}
            className="w-28 rounded-xl border-0 bg-campo-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
          <button
            type="submit"
            disabled={pinPendiente}
            className="rounded-lg bg-panel-app px-3.5 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover hover:text-texto-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50"
          >
            {pinPendiente ? "Guardando…" : "Guardar PIN"}
          </button>
        </form>

        <form action={altAccion}>
          <input type="hidden" name="usuarioId" value={usuario.id} />
          <button
            type="submit"
            disabled={altPendiente}
            className={
              "rounded-lg px-3.5 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50 " +
              (usuario.activo
                ? "border border-danger/40 bg-panel-app text-danger-text hover:bg-danger/10"
                : "bg-success/10 text-success-text ring-1 ring-success/20 hover:bg-success/25")
            }
          >
            {altPendiente ? "…" : usuario.activo ? "Desactivar" : "Activar"}
          </button>
        </form>
      </div>

      <div className="mt-2 space-y-1.5 sm:ml-[3.25rem]">
        <Aviso estado={pinEstado} />
        <Aviso estado={altEstado} />
      </div>
    </div>
  );
}

export function PanelUsuarios({ usuarios }: { usuarios: UsuarioDetalle[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    crearUsuario,
    INICIAL,
  );

  return (
    <section className="overflow-hidden rounded-[2rem] bg-panel-app ring-1 ring-borde-app">
      {/* Cabecera del módulo */}
      <div className="flex items-start justify-between gap-3 border-b border-borde-app px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-campo-app ring-1 ring-borde-app">
            <UserCog className="h-5 w-5 text-texto-muted" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl text-texto-app">
              Usuarios y PINs
            </h2>
            <p className="mt-0.5 text-sm text-texto-muted/75">
              Cada integrante entra con su rol y su PIN de 4 dígitos. El PIN se
              puede repetir entre roles distintos, pero no entre personas del
              mismo rol.
            </p>
          </div>
        </div>
        <p className="shrink-0 pt-1.5 text-xs font-bold text-texto-muted/70">
          {usuarios.length} {usuarios.length === 1 ? "integrante" : "integrantes"}
        </p>
      </div>

      <div className="px-5 py-2 sm:px-6">
        {/* Alta de personal: fila fija con las casillas alineadas */}
        <form
          action={accion}
          className="mt-4 grid gap-2 rounded-2xl bg-campo-app p-2.5 sm:grid-cols-[minmax(0,1fr)_8.5rem_7rem_auto] sm:items-center"
        >
          <input
            name="nombre"
            placeholder="Nombre (ej: Andrés)"
            maxLength={40}
            aria-label="Nombre del usuario nuevo"
            className="rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
          <select
            name="rol"
            aria-label="Rol del usuario nuevo"
            className="rounded-xl border-0 bg-panel-app px-2.5 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60"
          >
            <option value="MESERO">Mesero</option>
            <option value="DOMICILIARIO">Domiciliario</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <input
            name="pin"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN 4 dígitos"
            aria-label="PIN del usuario nuevo"
            className="rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50"
          >
            {pendiente ? "Creando…" : "Crear usuario"}
          </button>
          <div className="sm:col-span-full">
            <Aviso estado={estado} />
          </div>
        </form>

        {/* Listado: dos columnas de filas alineadas con divisores, como reglón
            de ajustes; nada de fichas dentro de fichas */}
        <div className="mt-2 grid items-start gap-x-8 gap-y-0 pt-2 lg:grid-cols-2">
          {usuarios.map((u) => (
            <FilaUsuario key={u.id} usuario={u} />
          ))}
        </div>
      </div>
    </section>
  );
}
