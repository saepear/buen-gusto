/**
 * Orden natural de las mesas del salón: "Mesa 2" va antes que "Mesa 10" y
 * "Ventana 3" antes que "Ventana 11". La base de datos compara los nombres
 * como texto puro (por eso "Mesa 10" caía entre "Mesa 1" y "Mesa 2"), así
 * que el orden numérico se hace aquí, en JS, para todas las vistas.
 */
export function ordenMesasPorNombre<T extends { nombre: string }>(
  mesas: T[],
): T[] {
  return [...mesas].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}
