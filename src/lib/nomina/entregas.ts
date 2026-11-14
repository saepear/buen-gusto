import { db } from "@/lib/db";
import { claveDia, formatCOP } from "@/lib/format";
import { prepararLiquidacion } from "./preparar-liquidacion";
import { cerrarJornadaSaldada } from "./jornadas";

export async function registrarEntregaNomina(datos: {
  liquidacionId: number; monto: number; metodo: string; usuarioId: number;
  netoRevisado: number; referencia?: string | null; observaciones?: string | null;
}) {
  const { liquidacionId, monto, metodo, usuarioId } = datos;
  if (!Number.isSafeInteger(monto) || monto < 0 || monto > 2147483647) throw new Error("Indica un valor de pago válido.");
  if (!["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(metodo)) throw new Error("Selecciona un método de pago válido.");
  return db.$transaction(async tx => {
    const antes = await tx.liquidacionNomina.findUnique({ where: { id: liquidacionId }, include: { jornada: true } });
    if (!antes?.jornadaId || antes.jornada?.estado !== "ABIERTA") throw new Error("Abre una jornada de pagos para registrar esta entrega.");
    if (antes.estadoPago === "PAGADO") throw new Error("Este pago ya está completo. No se puede pagar dos veces.");
    if (antes.pagado === 0) {
      const actualizado = await prepararLiquidacion({ periodoId: antes.periodoId, empleadoId: antes.empleadoId, usuarioId, soloSiFalta: true, cliente: tx });
      if (actualizado.error) throw new Error(actualizado.error);
    }
    const pago = await tx.liquidacionNomina.findUniqueOrThrow({ where: { id: liquidacionId }, include: { empleado: true, periodo: true } });
    if (pago.periodo.estado === "CERRADO") throw new Error("El período está cerrado. Revisa su historial antes de registrar una entrega.");
    if (datos.netoRevisado !== pago.netoAPagar) {
      // Se conserva el cálculo nuevo para que la UI pueda mostrarlo.
      return { error: "Los descuentos cambiaron. Revisa el nuevo total antes de pagar.", ok: null };
    }
    const saldo = pago.netoAPagar - pago.pagado;
    if (monto > saldo) throw new Error(`El saldo pendiente es ${formatCOP(saldo)}. No se puede entregar más.`);
    if (monto === 0 && pago.netoAPagar !== 0) throw new Error("El importe de la entrega debe ser mayor a cero.");
    if (monto > 0 && metodo === "EFECTIVO" && await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) } })) throw new Error("La caja de hoy está cerrada. No se puede entregar efectivo.");
    const totalPagado = pago.pagado + monto;
    const completo = totalPagado === pago.netoAPagar;
    // La guardia compara el saldo leído: una segunda solicitud, incluso desde
    // otra pestaña, debe volver a comprobarlo antes de generar un egreso.
    const reservado = await tx.liquidacionNomina.updateMany({
      where: { id: pago.id, pagado: pago.pagado, netoAPagar: pago.netoAPagar, estadoPago: { not: "PAGADO" }, jornada: { estado: "ABIERTA" } },
      data: { pagado: totalPagado, estadoPago: completo ? "PAGADO" : "PARCIALMENTE", estado: "APROBADA" },
    });
    if (reservado.count !== 1) throw new Error("Este pago cambió en otra pestaña. Actualiza antes de pagar.");
    if (monto > 0) {
      const gasto = metodo === "EFECTIVO" ? await tx.gasto.create({ data: {
        descripcion: `Pago de nómina ${pago.empleado.nombre} ${pago.empleado.apellidos} · ${pago.periodo.fechaDesde} → ${pago.periodo.fechaHasta}`,
        categoria: "NOMINA", valor: monto, metodo, origen: "CAJA", usuarioId,
        observaciones: `Generado por pago de nómina #${pago.id}`,
      } }) : null;
      await tx.pagoNomina.create({ data: { liquidacionId, monto, metodo, usuarioId, gastoId: gasto?.id, referencia: datos.referencia, observaciones: datos.observaciones } });
    }
    if (completo) {
      await tx.valeNomina.updateMany({ where: { liquidacionId, estado: "AUTORIZADO" }, data: { estado: "DESCONTADO" } });
      await cerrarJornadaSaldada(tx, antes.jornadaId, usuarioId);
    }
    return { error: null, ok: completo ? "Pago completo. La entrega quedó registrada." : `Abono registrado. Queda ${formatCOP(pago.netoAPagar - totalPagado)} por entregar.` };
  }, { timeout: 30000 });
}
