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
  ADMIN: "bg-amber-brand/20 text-amber-800",
  MESERO: "bg-[#4aa3ff]/15 text-[#2b7dc0]",
  COCINA: "bg-[#b06fd0]/15 text-[#8d4bab]",
};

const ROL_TXT: Record<string, string> = {
  ADMIN: "Administrador",
  MESERO: "Mesero",
  COCINA: "Cocina",
};

export function Aviso({ estado }: { estado: EstadoAccionConfig }) {
  if (estado.error) {
    return (
      <p className="mt-2 rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-danger">
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p className="mt-2 rounded-lg bg-success/10 px-2.5 py-1.5 text-xs font-bold text-success-dark">
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
        (usuario.activo ? "bg-white ring-cream-300" : "bg-cream-100 ring-cream-200 opacity-80")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-brown-800">{usuario.nombre}</span>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
            (CHIP_ROL[usuario.rol] ?? "bg-cream-200 text-brown-600")
          }
        >
          {ROL_TXT[usuario.rol] ?? usuario.rol}
        </span>
        <span
          className={
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
            (usuario.activo
              ? "bg-success/15 text-success-dark"
              : "bg-brown-800/10 text-brown-500")
          }
        >
          {usuario.activo ? "Activo" : "Inactivo"}
        </span>
        <span className="ml-auto font-mono text-xs font-bold text-brown-500">
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
            className="w-28 rounded-xl border-0 bg-cream-50 px-3 py-2 text-sm font-bold text-brown-800 ring-1 ring-cream-300 focus:ring-2 focus:ring-amber-brand"
          />
          <button
            type="submit"
            disabled={pinPendiente}
            className="rounded-xl bg-brown-800 px-3.5 py-2 text-xs font-bold text-cream-100 transition hover:bg-brown-700 disabled:opacity-50"
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
              "rounded-xl px-3.5 py-2 text-xs font-bold transition disabled:opacity-50 " +
              (usuario.activo
                ? "border border-danger/40 bg-white text-danger hover:bg-danger/10"
                : "bg-success/20 text-success-dark hover:bg-success/30")
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
    <section className="rounded-2xl bg-white p-5 ring-1 ring-cream-300">
      <h2 className="font-display text-xl text-brown-800">
        Usuarios y PINs
      </h2>
      <p className="mt-1 text-sm text-brown-600">
        Cada integrante entra con su rol y su PIN de 4 dígitos. El PIN se puede
        repetir entre roles distintos, pero no entre personas del mismo rol.
      </p>

      {/* Crear usuario */}
      <form action={accion} className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-cream-50 p-3.5 ring-1 ring-cream-200">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brown-800/10 text-brown-700">
          <UserPlus className="h-4.5 w-4.5" />
        </span>
        <input
          name="nombre"
          placeholder="Nombre (ej: Andrés)"
          maxLength={40}
          className="w-36 rounded-xl border-0 bg-white px-3 py-2 text-sm font-bold text-brown-800 ring-1 ring-cream-300 focus:ring-2 focus:ring-amber-brand"
        />
        <select
          name="rol"
          className="rounded-xl border-0 bg-white px-2.5 py-2 text-sm font-bold text-brown-800 ring-1 ring-cream-300 focus:ring-2 focus:ring-amber-brand"
        >
          <option value="MESERO">Mesero</option>
          <option value="COCINA">Cocina</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <input
          name="pin"
          inputMode="numeric"
          maxLength={4}
          placeholder="PIN 4 dígitos"
          className="w-28 rounded-xl border-0 bg-white px-3 py-2 text-sm font-bold text-brown-800 ring-1 ring-cream-300 focus:ring-2 focus:ring-amber-brand"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-orange-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-brand disabled:opacity-50"
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
