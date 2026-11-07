/** Efectivo físico que debería existir al cerrar: solo movimientos que tocan caja. */
export function efectivoEsperadoCaja(args: {
  ventasEfectivo: number;
  propinasEfectivo: number;
  abonosEfectivo: number;
  gastosEfectivo: number;
}): number {
  return args.ventasEfectivo + args.propinasEfectivo + args.abonosEfectivo - args.gastosEfectivo;
}

export function diferenciaEfectivo(contado: number, esperado: number): number {
  return contado - esperado;
}
