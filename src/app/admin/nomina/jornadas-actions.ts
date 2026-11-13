"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fechaColombia, fechaNominaValida } from "@/lib/nomina/resumen";
import { fechaDePago } from "@/lib/nomina/calendario-pago";
import { prepararLiquidacion } from "@/lib/nomina/preparar-liquidacion";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoJornadaPago = { error: string | null; ok: string | null };

function revalidarJornadas() {
  revalidatePath("/admin/nomina", "layout");
  revalidatePath("/admin/caja", "layout");
  realtime.broadcast("update");
}

async function liquidacionParaJornada(
  empleado: { id: number; periodicidadPago: string },
  fechaInicial: string,
  jornadaId: number,
  usuarioId: number,
) {
  // Primero se resuelve cualquier pago anterior que siga pendiente. Así una
  // jornada no salta deudas y tampoco crea otro sueldo para la misma persona.
  const pendiente = await db.liquidacionNomina.findFirst({
    where: {
      empleadoId: empleado.id,
      estadoPago: { not: "PAGADO" },
      periodo: { estado: "ABIERTO" },
    },
    orderBy: { periodo: { fechaDesde: "asc" } },
    select: { id: true, periodoId: true, jornadaId: true },
  });
  if (pendiente) {
    if (pendiente.jornadaId && pendiente.jornadaId !== jornadaId) {
      throw new Error("Este pago ya pertenece a otra jornada.");
    }
    const resultado = await prepararLiquidacion({
      periodoId: pendiente.periodoId,
      empleadoId: empleado.id,
      usuarioId,
      soloSiFalta: true,
    });
    if (resultado.error) throw new Error(resultado.error);
    await db.liquidacionNomina.update({
      where: { id: pendiente.id },
      data: { jornadaId },
    });
    return pendiente.id;
  }

  // La fecha de la jornada decide el único rango que puede abrirse. Si ese
  // rango ya se pagó, no adelantamos automáticamente al siguiente: evita la
  // cadena infinita de pagos al volver a pulsar el botón el mismo día.
  const rango = fechaDePago(fechaInicial, empleado.periodicidadPago);
  const existente = await db.liquidacionNomina.findFirst({
    where: {
      empleadoId: empleado.id,
      periodo: {
        fechaDesde: { lte: rango.fechaHasta },
        fechaHasta: { gte: rango.fechaDesde },
      },
    },
    include: { periodo: true },
    orderBy: { periodo: { fechaHasta: "desc" } },
  });
  if (existente) {
    if (existente.estadoPago === "PAGADO") {
      throw new Error(`El pago ${rango.fechaDesde} → ${rango.fechaHasta} ya está completo.`);
    }
    if (existente.periodo.estado === "CERRADO") {
      throw new Error("Tiene un pago pendiente dentro de un registro histórico cerrado.");
    }
    await db.liquidacionNomina.update({
      where: { id: existente.id },
      data: { jornadaId },
    });
    return existente.id;
  }

  const periodo = await db.periodoNomina.upsert({
    where: {
      fechaDesde_fechaHasta: {
        fechaDesde: rango.fechaDesde,
        fechaHasta: rango.fechaHasta,
      },
    },
    update: {},
    create: {
      ...rango,
      fechaPagoPrevista: rango.fechaHasta,
      creadoById: usuarioId,
    },
  });
  if (periodo.estado === "CERRADO") {
    throw new Error("Estas fechas tienen un cierre histórico.");
  }
  const resultado = await prepararLiquidacion({
    periodoId: periodo.id,
    empleadoId: empleado.id,
    usuarioId,
    soloSiFalta: true,
  });
  if (resultado.error) throw new Error(resultado.error);
  const liquidacion = await db.liquidacionNomina.findUniqueOrThrow({
    where: { periodoId_empleadoId: { periodoId: periodo.id, empleadoId: empleado.id } },
    select: { id: true },
  });
  await db.liquidacionNomina.update({
    where: { id: liquidacion.id },
    data: { jornadaId },
  });
  return liquidacion.id;
}

/** Abre la única jornada operativa y prepara una ficha de pago por empleado. */
export async function abrirJornadaPago(
  _previa: EstadoJornadaPago,
  form: FormData,
): Promise<EstadoJornadaPago> {
  const sesion = await exigirAdmin();
  const fecha = String(form.get("fecha") ?? "") || fechaColombia(new Date());
  if (!fechaNominaValida(fecha)) {
    return { error: "Escoge una fecha válida para la jornada.", ok: null };
  }

  try {
    const empleados = await db.empleado.findMany({
      where: { estado: "ACTIVO" },
      select: { id: true, nombre: true, apellidos: true, periodicidadPago: true },
      orderBy: { nombre: "asc" },
    });
    if (!empleados.length) return { error: "No hay empleados activos para pagar.", ok: null };

    const jornada = await db.jornadaPagoNomina.create({
      data: { fecha, estado: "ABIERTA", claveAbierta: "ABIERTA", abiertoById: sesion.id },
    });
    const errores: string[] = [];
    const liquidaciones: number[] = [];
    for (const empleado of empleados) {
      try {
        liquidaciones.push(await liquidacionParaJornada(empleado, fecha, jornada.id, sesion.id));
      } catch (error) {
        errores.push(`${empleado.nombre}: ${error instanceof Error ? error.message : "no se pudo preparar"}`);
      }
    }
    if (!liquidaciones.length) {
      await db.jornadaPagoNomina.delete({ where: { id: jornada.id } });
      return { error: errores[0] ?? "No se pudo preparar ningún pago.", ok: null };
    }

    // Un descuento puede dejar el neto en cero: no requiere una entrega
    // manual y por ello queda saldado desde que se prepara la jornada.
    await db.liquidacionNomina.updateMany({
      where: { id: { in: liquidaciones }, netoAPagar: 0, pagado: 0 },
      data: { estadoPago: "PAGADO", estado: "APROBADA" },
    });
    await db.valeNomina.updateMany({
      where: { liquidacionId: { in: liquidaciones }, estado: "AUTORIZADO" },
      data: { estado: "DESCONTADO" },
    });
    const faltan = await db.liquidacionNomina.count({
      where: { jornadaId: jornada.id, estadoPago: { not: "PAGADO" } },
    });
    if (faltan === 0) {
      await db.jornadaPagoNomina.update({
        where: { id: jornada.id },
        data: { estado: "CERRADA", claveAbierta: null, cerradoById: sesion.id, cerradoAt: new Date() },
      });
    }
    revalidarJornadas();
    if (errores.length) {
      return {
        error: `La jornada quedó abierta con ${liquidaciones.length} pago(s) preparados, pero ${errores.length} empleado(s) requieren revisión: ${errores.join(" ")}`,
        ok: null,
      };
    }
    return {
      error: null,
      ok: faltan === 0
        ? "La jornada quedó saldada automáticamente: no había dinero por entregar."
        : `Jornada abierta para ${liquidaciones.length} empleado(s). Quedan ${faltan} pago(s) por entregar.`,
    };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo abrir la jornada de pagos.";
    if (mensaje.includes("Unique constraint") || mensaje.includes("P2002")) {
      return { error: "Ya hay una jornada de pagos abierta. Termínala antes de abrir otra.", ok: null };
    }
    return { error: mensaje, ok: null };
  }
}
