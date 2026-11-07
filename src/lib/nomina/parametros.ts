// ═════════ Parámetros laborales — LECTURAS DEL SERVIDOR ═════════
// Los datos y fórmulas viven en `parametros-data.ts` (importable desde
// scripts); aquí van las consultas con base de datos usadas por las páginas
// y acciones de Nómina.

import { db } from "@/lib/db";
import {
  CLAVE_PARAM,
  CLAVE_PARAM_LABEL,
  FACTORES_PRESTACIONES,
  UNIDAD_PARAM,
  type ClaveParam,
  type ParametroSemilla,
} from "./parametros-data";

export {
  CLAVE_PARAM,
  CLAVE_PARAM_LABEL,
  FACTORES_PRESTACIONES,
  UNIDAD_PARAM,
};

export type { ClaveParam, ParametroSemilla };

export type ParametroVigente = {
  clave: string;
  valor: number;
  unidad: string;
  vigenciaDesde: Date;
  fuente: string;
  pendienteVerificar: boolean;
  nota: string | null;
};

/**
 * Carga la fila MÁS RECIENTE con vigenciaDesde ≤ fecha para cada clave.
 * Las liquidaciones guardan exactamente este conjunto como foto JSON, así
 * que reportes y comprobantes no vuelven a leer la tabla.
 */
export async function cargarParametros(fecha: Date): Promise<ParametroVigente[]> {
  const filas = await db.parametroLaboral.findMany({
    where: { vigenciaDesde: { lte: fecha } },
    orderBy: [{ clave: "asc" }, { vigenciaDesde: "desc" }],
  });

  const vistos = new Set<string>();
  const resultado: ParametroVigente[] = [];
  for (const fila of filas) {
    if (vistos.has(fila.clave)) continue; // ya está la más reciente de esa clave
    vistos.add(fila.clave);
    resultado.push({
      clave: fila.clave,
      valor: fila.valor,
      unidad: fila.unidad,
      vigenciaDesde: fila.vigenciaDesde,
      fuente: fila.fuente,
      pendienteVerificar: fila.pendienteVerificar,
      nota: fila.nota,
    });
  }
  return resultado;
}

/** Mapa clave → valor para cálculos */
export function mapaParametros(filas: ParametroVigente[]): Record<string, number> {
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

/** Arma la FOTO JSON de los parámetros guardada en la liquidación */
export function fotoParametros(filas: ParametroVigente[]): string {
  return JSON.stringify(
    filas.map((f) => ({
      clave: f.clave,
      valor: f.valor,
      unidad: f.unidad,
      vigenciaDesde: f.vigenciaDesde.toISOString().slice(0, 10),
      fuente: f.fuente,
      pendienteVerificar: f.pendienteVerificar,
    })),
  );
}
