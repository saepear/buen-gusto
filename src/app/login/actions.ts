"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ES_ROL_VALIDO, destinoRol } from "@/lib/roles";
import { borrarSesion, guardarSesion } from "@/lib/session";

export type LoginState = { error: string | null };

export async function iniciarSesion(
  _previa: LoginState,
  datos: FormData,
): Promise<LoginState> {
  const rol = String(datos.get("rol") ?? "");
  const pin = String(datos.get("pin") ?? "");

  if (!ES_ROL_VALIDO(rol)) return { error: "Selecciona un rol válido." };
  if (!/^\d{4}$/.test(pin)) return { error: "El PIN debe tener 4 dígitos." };

  const usuario = await db.usuario.findFirst({ where: { pin, rol, activo: true } });
  if (!usuario) return { error: "PIN incorrecto para ese rol." };

  await guardarSesion({ id: usuario.id, nombre: usuario.nombre, rol });
  redirect(destinoRol(rol));
}

export async function cerrarSesion(): Promise<void> {
  await borrarSesion();
  redirect("/login");
}
