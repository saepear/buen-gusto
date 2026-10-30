"use server";

import { setTema, type Theme } from "@/lib/config";
import { revalidatePath } from "next/cache";

export type EstadoAccionConfig = {
  error: string | null;
  ok: string | null;
};

export async function cambiarTema(
  _previo: EstadoAccionConfig,
  datos: FormData
): Promise<EstadoAccionConfig> {
  const nuevoTema = datos.get("tema") as Theme;

  if (!nuevoTema || (nuevoTema !== "dark" && nuevoTema !== "light")) {
    return { error: "Tema no válido", ok: null };
  }

  try {
    await setTema(nuevoTema);
    revalidatePath("/", "layout"); // Revalida todo el árbol para que el layout tome el nuevo tema
    return { error: null, ok: `Tema ${nuevoTema === "dark" ? "oscuro" : "claro"} aplicado` };
  } catch (error) {
    console.error("Error al cambiar tema:", error);
    return { error: "No se pudo guardar la configuración", ok: null };
  }
}
