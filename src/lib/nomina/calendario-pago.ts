import { fechaNominaValida } from "./resumen";

/** La frecuencia es individual; los rangos son internos, nunca un trámite. */
export function fechaDePago(fecha: string, frecuencia: string) {
  if (!fechaNominaValida(fecha)) throw new Error("Fecha inválida.");
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const fin = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const cortes = frecuencia === "MENSUAL" ? [fin] : frecuencia === "QUINCENAL" ? [15, fin] : [7, 14, 21, fin];
  const indice = cortes.findIndex(corte => corte >= dia);
  const clave = (d: number) => `${fecha.slice(0, 7)}-${String(d).padStart(2, "0")}`;
  return { fechaDesde: clave(indice ? cortes[indice - 1] + 1 : 1), fechaHasta: clave(cortes[indice]), tipo: frecuencia === "MENSUAL" ? "MENSUAL" : frecuencia === "QUINCENAL" ? "QUINCENAL" : "CICLOS" };
}

export function validarCuotas(monto: number, cuotas: { fecha: string; valor: number }[], hoy: string) {
  if (!Number.isSafeInteger(monto) || monto <= 0 || monto > 50_000_000) throw new Error("Indica un importe entre $1 y $50.000.000.");
  if (!cuotas.length || cuotas.length > 60) throw new Error("Registra entre 1 y 60 cuotas.");
  if (cuotas.some(c => !fechaNominaValida(c.fecha) || c.fecha < hoy || !Number.isSafeInteger(c.valor) || c.valor <= 0)) throw new Error("Cada cuota necesita una fecha desde hoy y un importe positivo.");
  if (cuotas.reduce((s, c) => s + c.valor, 0) !== monto) throw new Error("Las cuotas deben sumar exactamente el dinero prestado.");
}

/** Incluye atrasos y adelantos; no vuelve a recordar un sueldo ya pagado. */
export function proximaFechaPendiente(hoy: string, frecuencia: string, pagos: { estadoPago: string; periodo: { fechaDesde: string; fechaHasta: string } }[]) {
  const pendientes = pagos.filter(p => p.estadoPago !== "PAGADO").sort((a, b) => a.periodo.fechaDesde.localeCompare(b.periodo.fechaDesde));
  if (pendientes.length) return pendientes[0].periodo.fechaHasta;
  let rango = fechaDePago(hoy, frecuencia);
  for (const pago of [...pagos].sort((a, b) => a.periodo.fechaDesde.localeCompare(b.periodo.fechaDesde))) {
    if (pago.periodo.fechaDesde > rango.fechaHasta || pago.periodo.fechaHasta < rango.fechaDesde) continue;
    const siguiente = new Date(pago.periodo.fechaHasta + "T12:00:00Z");
    siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    rango = fechaDePago(siguiente.toISOString().slice(0, 10), frecuencia);
  }
  return rango.fechaHasta;
}
