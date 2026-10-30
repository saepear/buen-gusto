"use client";

import { UserPlus } from "lucide-react";
import { useActionState } from "react";
import {
  alternarUsuario,
  crearUsuario,
  guardarPin,
  type EstadoAccionConfig,
} from "./acciones";

const INICIAL: EstadoAccionConfig = { error: null, ok: null };

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
      <p className="mt-2 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="mt-2 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/20">
        ✅ {estado.ok}
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

  return (
    <div
      className={
        "rounded-2xl p-4 ring-1 " +
        (usuario.activo ? "bg-panel-app ring-borde-app" : "bg-panel-app ring-borde-app opacity-80")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-texto-app">{usuario.nombre}</span>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
            (CHIP_ROL[usuario.rol] ?? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
          }
        >
          {ROL_TXT[usuario.rol] ?? usuario.rol}
        </span>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
            (usuario.activo
              ? "bg-success/10 text-success-text ring-1 ring-success/20"
              : "bg-panel-app text-texto-muted/45 ring-1 ring-borde-app")
          }
        >
          {usuario.activo ? "Activo" : "Inactivo"}
        </span>
        <span className="ml-auto font-mono text-xs font-bold text-texto-muted/45">
          PIN: {usuario.pin}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-2">
        {/* Cambiar PIN */}
        <form action={pinAccion} className="flex items-center gap-2">
          <input type="hidden" name="usuarioId" value={usuario.id} />
          <input
            name="nuevoPin"
            inputMode="numeric"
            maxLength={4}
            placeholder="Nuevo PIN"
            className="w-28 rounded-2xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
          <button
            type="submit"
            disabled={pinPendiente}
            className="rounded-2xl bg-panel-app px-3.5 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover hover:text-texto-app disabled:opacity-50"
          >
            {pinPendiente ? "Guardando…" : "Guardar PIN"}
          </button>
        </form>

        {/* Activar / desactivar */}
        <form action={altAccion}>
          <input type="hidden" name="usuarioId" value={usuario.id} />
          <button
            type="submit"
            disabled={altPendiente}
            className={
              "rounded-2xl px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 " +
              (usuario.activo
                ? "border border-danger/40 bg-panel-app text-danger-text hover:bg-danger/10"
                : "bg-success/10 text-success-text ring-1 ring-success/20 hover:bg-success/25")
            }
          >
            {altPendiente ? "…" : usuario.activo ? "Desactivar" : "Activar"}
          </button>
        </form>
      </div>

      <Aviso estado={pinEstado} />
      <Aviso estado={altEstado} />
    </div>
  );
}

export function PanelUsuarios({ usuarios }: { usuarios: UsuarioDetalle[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    crearUsuario,
    INICIAL,
  );

  return (
    <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
      <h2 className="font-display text-xl text-texto-app">
        Usuarios y PINs
      </h2>
      <p className="mt-1 text-sm text-texto-muted/70">
        Cada integrante entra con su rol y su PIN de 4 dígitos. El PIN se puede
        repetir entre roles distintos, pero no entre personas del mismo rol.
      </p>

      {/* Crear usuario */}
      <form action={accion} className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-panel-app p-3.5 ring-1 ring-borde-app">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-panel-app text-texto-app">
          <UserPlus className="h-4.5 w-4.5" />
        </span>
        <input
          name="nombre"
          placeholder="Nombre (ej: Andrés)"
          maxLength={40}
          className="w-36 rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
        />
        <select
          name="rol"
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
          className="w-28 rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
        >
          {pendiente ? "Creando…" : "Crear usuario"}
        </button>
        <div className="w-full">
          <Aviso estado={estado} />
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {usuarios.map((u) => (
          <FilaUsuario key={u.id} usuario={u} />
        ))}
      </div>
    </section>
  );
}

