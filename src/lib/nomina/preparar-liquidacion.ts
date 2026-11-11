import { db } from "@/lib/db";
import { calcularPago } from "@/lib/nomina/pago";
import { contratoVigente } from "@/lib/nomina/helpers";
import type { NovedadResumen } from "@/lib/nomina/calculo";

export type ResultadoPrepararLiquidacion = { error: string | null; ok: string | null };

/**
 * Crea o actualiza el borrador de un empleado para un ciclo.
 *
 * `soloSiFalta` se usa en la carga automática del módulo: no recalcula cada
 * visita, pero sí incorpora novedades o vales nuevos mientras aún no haya
 * dinero entregado.
 */
export async function prepararLiquidacion({
  periodoId,
  empleadoId,
  usuarioId,
  soloSiFalta = false,
}: {
  periodoId: number;
  empleadoId: number;
  usuarioId: number;
  soloSiFalta?: boolean;
}): Promise<ResultadoPrepararLiquidacion> {
  const periodo = await db.periodoNomina.findUnique({ where: { id: periodoId } });
  if (!periodo) return { error: "El período no existe.", ok: null };
  if (periodo.estado === "CERRADO") return { error: "El período está CERRADO: sus liquidaciones no se recalculan.", ok: null };

  const empleado = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado) return { error: "El empleado no existe.", ok: null };
  if (empleado.fechaIngreso > new Date(`${periodo.fechaHasta}T12:00:00.000Z`)) return { error: `${empleado.nombre} ingresó después del período: no le corresponde esta nómina.`, ok: null };
  if (empleado.estado === "INACTIVO" && empleado.fechaRetiro && empleado.fechaRetiro < new Date(`${periodo.fechaDesde}T12:00:00.000Z`)) return { error: `${empleado.nombre} se hizo retiro antes del período: no le corresponde esta nómina.`, ok: null };

  const anterior = await db.liquidacionNomina.findUnique({ where: { periodoId_empleadoId: { periodoId, empleadoId } } });
  if (soloSiFalta && anterior) {
    if (anterior.pagado > 0 || anterior.estadoPago === "PAGADO") return { error: null, ok: null };
  }
  if (anterior?.estadoPago === "PAGADO") return { error: "Este pago ya está saldado y no se recalcula.", ok: null };
  if (anterior && anterior.pagado > 0) return { error: "La liquidación ya tiene pagos y no se recalcula.", ok: null };

  const contrato = await contratoVigente(empleadoId, periodo.fechaHasta);
  if (!contrato) return { error: "El empleado no tiene contrato vigente para el período.", ok: null };

  const novedades = await db.novedadNomina.findMany({
    where: {
      empleadoId,
      estado: "APROBADA",
      tipo: { in: ["COMISION", "BONIFICACION", "DESCUENTO"] },
      OR: [{ liquidacionId: null }, ...(anterior ? [{ liquidacionId: anterior.id }] : [])],
      fecha: { lte: periodo.fechaHasta },
    },
    orderBy: { fecha: "asc" },
  });
  const vales = await db.valeNomina.findMany({
    where: {
      empleadoId,
      OR: [
        { estado: { in: ["PENDIENTE", "AUTORIZADO"] }, liquidacionId: null, fecha: { lte: periodo.fechaHasta } },
        ...(anterior ? [{ estado: { in: ["AUTORIZADO", "DESCONTADO"] }, liquidacionId: anterior.id }] : []),
      ],
    },
    orderBy: { fecha: "asc" },
  });

  if (soloSiFalta && anterior && !novedades.some((n) => n.liquidacionId === null) && !vales.some((v) => v.liquidacionId === null)) return { error: null, ok: null };

  const novedadesResumen: NovedadResumen[] = novedades.map((n) => ({ id: n.id, tipo: n.tipo, fecha: n.fecha, dias: n.dias, valor: n.valor, descripcion: n.descripcion }));
  for (const vale of vales) novedadesResumen.push({ id: 0, tipo: "DESCUENTO", fecha: "", dias: null, valor: vale.total, descripcion: `Vale: ${vale.productoNombre} ×${vale.cantidad}` });

  const calculoFinal = calcularPago({
    contrato: {
      modalidad: contrato.modalidad,
      remuneracion: contrato.remuneracion,
      salarioMensual: contrato.salarioMensual,
      salarioDiario: contrato.salarioDiario,
      valorHora: contrato.valorHora,
      jornadaSemanalMinutos: contrato.jornadaSemanalMinutos,
      periodicidadPago: contrato.periodicidadPago,
      diaDescanso: contrato.diaDescanso,
      auxilioTransporte: contrato.auxilioTransporte,
      metodoPago: contrato.metodoPago,
      arpClase: empleado.arpClase,
    },
    novedades: novedadesResumen,
    periodoDesde: periodo.fechaDesde,
    periodoHasta: periodo.fechaHasta,
    periodoTipo: periodo.tipo,
  });
  if (calculoFinal.netoAPagar < 0) return { error: "Los descuentos superan el sueldo disponible. Revisa los vales y las cuotas acordadas antes de registrar el pago.", ok: null };

  const contratoFoto = JSON.stringify({
    esquemaPago: "INTERNO_V1",
    modalidad: contrato.modalidad,
    remuneracion: contrato.remuneracion,
    salarioMensual: contrato.salarioMensual,
    salarioDiario: contrato.salarioDiario,
    valorHora: contrato.valorHora,
    jornadaSemanalMinutos: contrato.jornadaSemanalMinutos,
    periodicidadPago: contrato.periodicidadPago,
    diaDescanso: contrato.diaDescanso,
    auxilioTransporte: contrato.auxilioTransporte,
    metodoPago: contrato.metodoPago,
    arpClase: empleado.arpClase,
    contratoVersionId: contrato.id,
    vigenteDesde: contrato.desde.toISOString().slice(0, 10),
  });

  await db.$transaction(async (tx) => {
    const yaExiste = await tx.liquidacionNomina.findUnique({ where: { periodoId_empleadoId: { periodoId, empleadoId } } });
    if (yaExiste && anterior && yaExiste.updatedAt.getTime() !== anterior.updatedAt.getTime()) throw new Error("El pago cambió mientras se calculaba. Actualiza y vuelve a intentarlo.");
    if (yaExiste) {
      if (yaExiste.estadoPago === "PAGADO" || yaExiste.pagado > 0) throw new Error("Ya se registró una entrega. Los nuevos descuentos corresponden al siguiente pago.");
      await tx.novedadNomina.updateMany({ where: { liquidacionId: yaExiste.id }, data: { liquidacionId: null } });
      await tx.valeNomina.updateMany({ where: { liquidacionId: yaExiste.id }, data: { liquidacionId: null, estado: "AUTORIZADO" } });
      await tx.liquidacionConcepto.deleteMany({ where: { liquidacionId: yaExiste.id } });
    }
    const datosPago = {
      periodoId,
      empleadoId,
      estado: "BORRADOR",
      diasTrabajados: calculoFinal.diasTrabajados,
      contratoFoto,
      parametrosFoto: "[]",
      novedadesFoto: JSON.stringify(novedadesResumen.map((n) => ({ id: n.id, tipo: n.tipo, fecha: n.fecha, dias: n.dias, valor: n.valor, descripcion: n.descripcion }))),
      salarioBase: calculoFinal.salarioBase,
      horasExtraRecargos: calculoFinal.horasExtrasRecargos,
      comisionesBonos: calculoFinal.comisionesBonos,
      auxilioTransporte: calculoFinal.auxilioTransporte,
      otrosDevengados: calculoFinal.otrosDevengados,
      totalDevengado: calculoFinal.totalDevengado,
      deduccionSalud: calculoFinal.deduccionSalud,
      deduccionPension: calculoFinal.deduccionPension,
      otrosDescuentos: calculoFinal.otrosDescuentos,
      totalDeducciones: calculoFinal.totalDeducciones,
      netoAPagar: calculoFinal.netoAPagar,
      empresaSalud: calculoFinal.empresaSalud,
      empresaPension: calculoFinal.empresaPension,
      empresaRiesgos: calculoFinal.empresaRiesgos,
      empresaCaja: calculoFinal.empresaCaja,
      costoEmpleador: calculoFinal.costoEmpleador,
      prestacionPrima: calculoFinal.prestacionPrima,
      prestacionCesantias: calculoFinal.prestacionCesantias,
      prestacionIntereses: calculoFinal.prestacionIntereses,
      prestacionVacaciones: calculoFinal.prestacionVacaciones,
      estadoPago: "PENDIENTE",
      creadoById: usuarioId,
      notas: calculoFinal.notasCalculo.join(" · ") || null,
    };
    const liquidacion = await tx.liquidacionNomina.upsert({ where: { periodoId_empleadoId: { periodoId, empleadoId } }, create: datosPago, update: datosPago });
    await tx.liquidacionConcepto.createMany({ data: calculoFinal.conceptos.map((concepto) => ({ liquidacionId: liquidacion.id, tipo: concepto.tipo, clave: concepto.clave, etiqueta: concepto.clave === "DESCUENTO" && concepto.detalle?.startsWith("Vale: ") ? "Vale de empleado" : concepto.etiqueta, valor: concepto.valor, detalle: concepto.detalle })) });
    if (novedades.length > 0) {
      const vinculadas = await tx.novedadNomina.updateMany({ where: { id: { in: novedades.map(n => n.id) }, estado: "APROBADA", OR: [{ liquidacionId: null }, { liquidacionId: liquidacion.id }] }, data: { liquidacionId: liquidacion.id } });
      if (vinculadas.count !== novedades.length) throw new Error("Los descuentos cambiaron. Vuelve a abrir el pago.");
    }
    if (vales.length > 0) {
      const vinculados = await tx.valeNomina.updateMany({ where: { id: { in: vales.map(v => v.id) }, estado: { in: ["PENDIENTE", "AUTORIZADO"] }, liquidacionId: null }, data: { estado: "AUTORIZADO", liquidacionId: liquidacion.id, cicloId: periodoId } });
      if (vinculados.count !== vales.length) throw new Error("Un vale cambió o ya pertenece a otro pago. Vuelve a intentarlo.");
    }
  });

  return { ok: `Pago de ${empleado.nombre} ${empleado.apellidos} preparado (borrador).`, error: null };
}

/** Prepara de forma idempotente todos los empleados activos del ciclo. */
export async function prepararPeriodoAutomaticamente(periodoId: number, usuarioId: number): Promise<void> {
  const periodo = await db.periodoNomina.findUnique({ where: { id: periodoId }, select: { estado: true } });
  if (!periodo || periodo.estado === "CERRADO") return;
  const empleados = await db.empleado.findMany({ where: { estado: "ACTIVO" }, select: { id: true } });
  for (const empleado of empleados) await prepararLiquidacion({ periodoId, empleadoId: empleado.id, usuarioId, soloSiFalta: true });
}
