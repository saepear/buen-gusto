/** Fechas del restaurante, independientes de la zona horaria del servidor. */
export function fechaColombia(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

type LiquidacionResumen = {
  estado: string;
  netoAPagar: number;
  pagado: number;
};
type ValeResumen = {
  estado: string;
  total: number;
  liquidacionId: number | null;
};

export function fechaNominaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const valor = new Date(`${fecha}T12:00:00Z`);
  return (
    !Number.isNaN(valor.getTime()) && valor.toISOString().slice(0, 10) === fecha
  );
}

/** Un vale DESCONTADO ya está incluido en el neto guardado. Solo el borrador
 * puede proyectar nuevos vales autorizados; una aprobación conserva su foto. */
export function resumenEmpleado(
  liquidacion: LiquidacionResumen | null,
  vales: ValeResumen[],
) {
  const valesPendientes = vales
    .filter((v) => v.estado === "PENDIENTE")
    .reduce((s, v) => s + v.total, 0);
  const valesAutorizados = vales
    .filter((v) => v.estado === "AUTORIZADO" && v.liquidacionId === null)
    .reduce((s, v) => s + v.total, 0);
  const valesDescontados = vales
    .filter((v) => v.estado === "DESCONTADO")
    .reduce((s, v) => s + v.total, 0);
  const ajuste = liquidacion?.estado === "BORRADOR" ? valesAutorizados : 0;
  const netoEstimado = liquidacion ? liquidacion.netoAPagar - ajuste : null;
  return {
    valesPendientes,
    valesAutorizados,
    valesDescontados,
    netoEstimado,
    saldoEstimado:
      netoEstimado === null ? null : netoEstimado - (liquidacion?.pagado ?? 0),
    requiereRecalculo: ajuste > 0,
  };
}
