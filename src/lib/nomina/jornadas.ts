import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fechaDePago } from "./calendario-pago";
import { fechaNominaValida } from "./resumen";
import { prepararLiquidacion } from "./preparar-liquidacion";

/** Todo el equipo se prepara de forma atómica: nunca queda una jornada a medias. */
export async function crearJornadaPago(fecha: string, usuarioId: number) {
  if (!fechaNominaValida(fecha)) throw new Error("Escoge una fecha válida para la jornada.");
  return db.$transaction(async tx => {
    if (await tx.jornadaPagoNomina.findUnique({ where: { claveAbierta: "ABIERTA" } })) {
      throw new Error("Ya hay una jornada abierta. Termina sus pagos antes de abrir otra.");
    }
    const empleados = await tx.empleado.findMany({ where: { estado: "ACTIVO" }, orderBy: { nombre: "asc" } });
    if (!empleados.length) throw new Error("No hay empleados activos para pagar.");
    const jornada = await tx.jornadaPagoNomina.create({ data: { fecha, claveAbierta: "ABIERTA", abiertoById: usuarioId } });
    let preparados = 0;
    let yaPagados = 0;
    for (const empleado of empleados) {
      // Un saldo previo tiene prioridad; se incluyen empleados retirados
      // después de abrir la jornada desde el historial, conservando su pago.
      const anterior = await tx.liquidacionNomina.findFirst({
        where: { empleadoId: empleado.id, estadoPago: { not: "PAGADO" } },
        include: { periodo: true, jornada: true }, orderBy: { periodo: { fechaDesde: "asc" } },
      });
      if (anterior?.jornadaId && anterior.jornada?.estado === "CERRADA") throw new Error(`${empleado.nombre} tiene un saldo dentro de una jornada cerrada. Revisa su historial.`);
      const rango = fechaDePago(fecha, empleado.periodicidadPago);
      const existe = anterior ?? await tx.liquidacionNomina.findFirst({
        where: { empleadoId: empleado.id, periodo: { fechaDesde: { lte: rango.fechaHasta }, fechaHasta: { gte: rango.fechaDesde } } },
        include: { periodo: true, jornada: true },
      });
      if (existe?.estadoPago === "PAGADO") { yaPagados += 1; continue; }
      const periodo = existe?.periodo ?? await tx.periodoNomina.upsert({
        where: { fechaDesde_fechaHasta: { fechaDesde: rango.fechaDesde, fechaHasta: rango.fechaHasta } },
        update: {}, create: { ...rango, fechaPagoPrevista: rango.fechaHasta, creadoById: usuarioId },
      });
      if (periodo.estado === "CERRADO") throw new Error(`${empleado.nombre} tiene un saldo en un período cerrado. Revisa su historial.`);
      const resultado = await prepararLiquidacion({ periodoId: periodo.id, empleadoId: empleado.id, usuarioId, soloSiFalta: true, cliente: tx });
      if (resultado.error) throw new Error(`${empleado.nombre}: ${resultado.error}`);
      await tx.liquidacionNomina.update({ where: { periodoId_empleadoId: { periodoId: periodo.id, empleadoId: empleado.id } }, data: { jornadaId: jornada.id } });
      preparados += 1;
    }
    if (!preparados) throw new Error("Los pagos correspondientes a esta fecha ya están completos. No se creará otro sueldo para el mismo rango.");
    // Solo los netos en cero están saldados. Los demás vales permanecen
    // autorizados hasta que se registre efectivamente el último abono.
    const ceros = await tx.liquidacionNomina.findMany({ where: { jornadaId: jornada.id, netoAPagar: 0 }, select: { id: true } });
    if (ceros.length) {
      const ids = ceros.map(p => p.id);
      await tx.liquidacionNomina.updateMany({ where: { id: { in: ids } }, data: { estadoPago: "PAGADO", estado: "APROBADA" } });
      await tx.valeNomina.updateMany({ where: { liquidacionId: { in: ids }, estado: "AUTORIZADO" }, data: { estado: "DESCONTADO" } });
    }
    const cerrada = await cerrarJornadaSaldada(tx, jornada.id, usuarioId);
    return { jornadaId: jornada.id, preparados, yaPagados, cerrada };
  }, { timeout: 30000 });
}

export async function cerrarJornadaSaldada(tx: Prisma.TransactionClient, jornadaId: number, usuarioId: number) {
  const faltan = await tx.liquidacionNomina.count({ where: { jornadaId, estadoPago: { not: "PAGADO" } } });
  if (faltan) return false;
  await tx.jornadaPagoNomina.updateMany({ where: { id: jornadaId, estado: "ABIERTA" }, data: { estado: "CERRADA", claveAbierta: null, cerradoById: usuarioId, cerradoAt: new Date() } });
  return true;
}
