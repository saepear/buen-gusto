import { db } from "./db";

export type Theme = "dark" | "light";

export async function getTemaActual(): Promise<Theme> {
  try {
    const config = await db.configuracion.findUnique({
      where: { clave: "tema" },
    });
    return (config?.valor as Theme) || "dark";
  } catch (error) {
    console.error("Error al obtener el tema:", error);
    return "dark";
  }
}

export async function setTema(tema: Theme) {
  return db.configuracion.upsert({
    where: { clave: "tema" },
    update: { valor: tema },
    create: { clave: "tema", valor: tema },
  });
}
