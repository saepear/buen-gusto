import { cookies } from "next/headers";
import { db } from "./db";

export type Theme = "dark" | "light";

/* ══════════ Tema de la interfaz ══════════
 * Dos niveles:
 *  1. Por DISPOSITIVO (cookie "tema"): cada teléfono/equipo elige el suyo
 *     desde la vista del mesero sin tocar lo demás.
 *  2. Global (BD, Configuración): el modo por defecto del sistema, se
 *     cambia desde el selector de Configuración y hace de respaldo cuando
 *     el dispositivo aún no eligió. */

/** Clave en Configuracion para el tema global por defecto */
export const CLAVE_TEMA = "tema-interfaz";
/** Clave de la cookie por dispositivo */
export const CLAVE_COOKIE_TEMA = "tema";

export function esTemaValido(tema: unknown): tema is Theme {
  return tema === "dark" || tema === "light";
}

/** Modo guardado en la BD (el global); "dark" si aún no se guarda nada */
async function temaGuardado(): Promise<Theme> {
  try {
    const config = await db.configuracion.findUnique({
      where: { clave: CLAVE_TEMA },
    });
    if (config && esTemaValido(config.valor)) return config.valor;
  } catch (error) {
    console.error("Error al leer el tema guardado:", error);
  }
  return "dark";
}

/** Tema global que aplica a todos los dispositivos sin preferencia propia */
export async function getTemaActual(): Promise<Theme> {
  return temaGuardado();
}

/** Guarda el modo por defecto global desde Configuración */
export async function setTema(tema: Theme) {
  return db.configuracion.upsert({
    where: { clave: CLAVE_TEMA },
    update: { valor: tema },
    create: { clave: CLAVE_TEMA, valor: tema },
  });
}

/**
 * Tema de ESTE dispositivo: la cookie manda; sin cookie usa el global de
 * la configuración (y sin nada, oscuro).
 */
export async function temaDelDispositivo(): Promise<Theme> {
  try {
    const galletas = await cookies();
    const tema = galletas.get(CLAVE_COOKIE_TEMA)?.value;
    if (esTemaValido(tema)) return tema;
  } catch (error) {
    /* En el prerender estático del build, Next señala el uso de cookies con
       un error interno de "uso dinámico" (digest DYNAMIC_SERVER-*): hay que
       dejarlo pasar SIN atraparlo para que la ruta se vuelva dinámica y
       cada render lea la cookie real del dispositivo. Solo los fallos reales
       de lectura (sin BD, permisos, etc.) caen en el fallback. */
    const digest = (error as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && digest.startsWith("DYNAMIC_SERVER")) {
      throw error;
    }
    console.error("Error al leer la cookie de tema:", error);
  }
  return temaGuardado();
}

/** Categorías del almuerzo que el propio cliente crea (p. ej. «Especiales»).
 *  Entran al menú del día igual que proteínas, principios, ensaladas y sopas:
 *  cada una tiene su sección con porciones y su espacio en el constructor del
 *  plato. Viven en Configuracion como JSON (lista de {nombre, icono}) porque
 *  los tipos fijos del sistema están en roles.ts y así no hay que migrar la
 *  base. Un producto puede quedar con tipo = nombre de su categoría. */
export const CLAVE_CATEGORIAS = "categorias-personalizadas";
export const MAX_CATEGORIAS = 6;

export type CategoriaPropia = { nombre: string; icono: string };

/** Normaliza: acepta el formato viejo (solo nombres) y el nuevo ({nombre, icono}) */
function normalizar(bruto: unknown): CategoriaPropia[] {
  if (!Array.isArray(bruto)) return [];
  const lista: CategoriaPropia[] = [];
  for (const elementos of bruto) {
    if (typeof elementos === "string" && elementos.trim()) {
      lista.push({ nombre: elementos.trim(), icono: "UtensilsCrossed" });
    } else if (
      elementos &&
      typeof elementos === "object" &&
      typeof (elementos as { nombre?: unknown }).nombre === "string" &&
      (elementos as { nombre: string }).nombre.trim()
    ) {
      const e = elementos as { nombre: string; icono?: unknown };
      lista.push({
        nombre: e.nombre.trim(),
        icono: typeof e.icono === "string" ? e.icono : "UtensilsCrossed",
      });
    }
  }
  return lista.slice(0, MAX_CATEGORIAS);
}

export async function getCategoriasPersonalizadas(): Promise<CategoriaPropia[]> {
  try {
    const config = await db.configuracion.findUnique({
      where: { clave: CLAVE_CATEGORIAS },
    });
    if (!config) return [];
    const lista: unknown = JSON.parse(config.valor);
    return normalizar(lista);
  } catch (error) {
    console.error("Error al leer las categorías personalizadas:", error);
    return [];
  }
}

export async function setCategoriasPersonalizadas(
  categorias: CategoriaPropia[],
) {
  return db.configuracion.upsert({
    where: { clave: CLAVE_CATEGORIAS },
    update: { valor: JSON.stringify(categorias) },
    create: { clave: CLAVE_CATEGORIAS, valor: JSON.stringify(categorias) },
  });
}
