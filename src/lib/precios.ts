// Lógica de precios del almuerzo del día (Fase 7)
// Todos los valores van en COP enteros. Si el negocio cambia precios,
// se cambian SOLO estas constantes y toda la app se ajusta.

// Almuerzo COMPLETO (con sopa) servido en mesa
export const PRECIO_COMPLETO = 13_000;

// SOLO BANDEJA (sin sopa) servido en mesa
export const PRECIO_BANDEJA = 12_000;

// Recargo por LLEVAR el completo (domicilio): se cobra el icopor
export const PRECIO_ICOPOR = 1_500;

// Recargo por LLEVAR la bandeja (sin sopa): empaquetado más ligero
export const PRECIO_EMPAQUE_BANDEJA = 1_000;

// Precio del HUEVO adicional (juega como producto del catálogo tipo ADICIONAL)
export const PRECIO_HUEVO = 1_000;

// Precio del ADICIONAL DE CARNE (mitad extra dentro de la bandeja)
export const PRECIO_CARNE_EXTRA = 5_000;

/**
 * Precio del almuerzo principal:
 *   completa en mesa $13.000 · bandeja en mesa $12.000
 *   completa para llevar $14.500 ($13.000 + $1.500 de icopor)
 *   bandeja para llevar $13.000 ($12.000 + $1.000 de empaque, SIN
 *   icopor: ese recipiente es de la sopa; la bandeja paga su empaque
 *   propio y más ligero).
 */
export function precioAlmuerzo(
  conSopa: boolean,
  paraLlevar: boolean,
): number {
  if (!paraLlevar) return conSopa ? PRECIO_COMPLETO : PRECIO_BANDEJA;
  return (
    (conSopa ? PRECIO_COMPLETO + PRECIO_ICOPOR : PRECIO_BANDEJA + PRECIO_EMPAQUE_BANDEJA)
  );
}

/**
 * El plato con precio especial del día (asados del domingo, gallina,
 * pescados): vale lo mismo en mesa y para llevar, con o sin sopa — solo el
 * COMPLETO para llevar suma el icopor ($1.500, el vaso de la sopa). La
 * bandeja para llevar NO lo suma (no se apilan $1.500 de más: la bandeja
 * ya paga su propio empaque).
 */
export function precioEspecialDelDia(
  precioEspecial: number,
  conSopa: boolean,
  paraLlevar: boolean,
): number {
  return precioEspecial + (paraLlevar && conSopa ? PRECIO_ICOPOR : 0);
}

/**
 * Precio por unidad de una línea de comanda: el fijado al ordenar
 * (proteína del día, extras) o el del catálogo para lo antiguo.
 */
export function precioUnitarioItem(
  item: { precio: number | null; producto: { precio: number } },
): number {
  return item.precio ?? item.producto.precio;
}
