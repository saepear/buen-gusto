import type { Prisma } from "@prisma/client";

export const seleccionPago = {
  id: true, empleadoId: true, periodoId: true, jornadaId: true, estado: true, estadoPago: true,
  salarioBase: true, totalDevengado: true, totalDeducciones: true, netoAPagar: true, pagado: true, contratoFoto: true,
  empleado: { select: { nombre: true, apellidos: true, cargo: true, metodoPago: true } },
  periodo: { select: { fechaDesde: true, fechaHasta: true, estado: true } },
  jornada: { select: { id: true, fecha: true, estado: true } },
  conceptos: { orderBy: { id: "asc" }, select: { id: true, clave: true, tipo: true, etiqueta: true, valor: true } },
  pagos: { orderBy: { fecha: "desc" }, select: { id: true, fecha: true, monto: true, metodo: true, referencia: true, observaciones: true, registradoPor: { select: { nombre: true } } } },
} satisfies Prisma.LiquidacionNominaSelect;

export function serializarPago(pago: Prisma.LiquidacionNominaGetPayload<{ select: typeof seleccionPago }>) {
  let interno = false;
  try { interno = JSON.parse(pago.contratoFoto).esquemaPago === "INTERNO_V1"; } catch { /* Histórico sin snapshot válido. */ }
  const { contratoFoto: _foto, ...datos } = pago;
  void _foto;
  return { ...datos, interno, pagos: pago.pagos.map(p => ({ ...p, fecha: p.fecha.toISOString() })) };
}
export type DatosPago = ReturnType<typeof serializarPago>;
