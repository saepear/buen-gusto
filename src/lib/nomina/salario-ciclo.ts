/** Cuatro pagos en COP enteros. El último absorbe el redondeo del mes. */
export function salarioDelCiclo(salarioMensual: number, fechaDesde: string): number {
  const cuota = Math.round(salarioMensual / 4);
  return Number(fechaDesde.slice(8, 10)) === 22
    ? salarioMensual - cuota * 3
    : cuota;
}
