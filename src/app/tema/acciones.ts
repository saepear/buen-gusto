"use server";

import { cookies } from "next/headers";
import { CLAVE_COOKIE_TEMA, esTemaValido, type Theme } from "@/lib/config";

/**
 * Elige el tema de ESTE dispositivo (cookie): el mesero cambia claro/oscuro
 * desde su teléfono sin afectar el modo de la pantalla del admin ni el
 * global guardado en la configuración.
 */
export async function fijarTemaDelDispositivo(
  tema: Theme,
): Promise<{ error: string | null }> {
  if (!esTemaValido(tema)) return { error: "Tema no válido" };

  const galletas = await cookies();
  galletas.set(CLAVE_COOKIE_TEMA, tema, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // un año: la preferencia del equipo se queda
    sameSite: "lax",
  });
  return { error: null };
}
