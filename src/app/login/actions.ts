"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ES_ROL_VALIDO, destinoRol } from "@/lib/roles";
import { borrarSesion, guardarSesion } from "@/lib/session";
import { esPinHasheado, hashearPin, verificarPin } from "@/lib/pin";

export type LoginState = { error: string | null };

export async function iniciarSesion(
  _previa: LoginState,
  datos: FormData,
): Promise<LoginState> {
  const rol = String(datos.get("rol") ?? "");
  const pin = String(datos.get("pin") ?? "");

  if (!ES_ROL_VALIDO(rol)) return { error: "Selecciona un rol válido." };
  if (!/^\d{4}$/.test(pin)) return { error: "El PIN debe tener 4 dígitos." };

  // Los PIN están guardados con hash (scrypt): no se puede buscar por
  // PIN en la BD; se comparan los del rol correspondiente uno a uno.
  const delRol = await db.usuario.findMany({ where: { rol, activo: true } });
  const usuario = delRol.find((u) => verificarPin(pin, u.pin));
  if (!usuario) return { error: "PIN incorrecto para ese rol." };

  // Migración suave: los PIN que quedan en texto plano se reescriben con
  // hash al primer ingreso exitoso. Si la reescritura falla (p. ej. la BD
  // está ocupada) el acceso igual sigue: migrará en el próximo ingreso.
  if (!esPinHasheado(usuario.pin)) {
    try {
      await db.usuario.update({
        where: { id: usuario.id },
        data: { pin: hashearPin(pin) },
      });
    } catch (e) {
      console.warn("No se pudo hashear el PIN de", usuario.nombre, ":", e);
    }
  }

  await guardarSesion({ id: usuario.id, nombre: usuario.nombre, rol });
  redirect(destinoRol(rol));
}

export async function cerrarSesion(): Promise<void> {
  await borrarSesion();
  redirect("/login");
}
