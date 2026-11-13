"use server";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/session";
import { fechaColombia } from "@/lib/nomina/resumen";
import { validarCuotas } from "@/lib/nomina/calendario-pago";
import { seleccionPago, serializarPago } from "./pagos/datos-pago";
import { revalidatePath } from "next/cache";
import { claveDia } from "@/lib/format";

export async function abrirPagoEmpleado(empleadoId: number, jornadaId: number) {
  await exigirAdmin();
  if (!Number.isInteger(empleadoId) || !Number.isInteger(jornadaId)) {
    throw new Error("Falta el empleado o la jornada de pagos.");
  }
  const pago = await db.liquidacionNomina.findFirst({
    where: {
      empleadoId,
      jornadaId,
      jornada: { estado: "ABIERTA" },
    },
    select: seleccionPago,
  });
  if (!pago) {
    throw new Error("Este empleado no pertenece a una jornada de pagos abierta.");
  }
  revalidatePath("/admin/nomina", "layout");
  return serializarPago(pago);
}

export async function registrarCredito(_: { error: string | null; ok: string | null }, form: FormData): Promise<{ error: string | null; ok: string | null }> {
  const usuario = await exigirAdmin();
  try {
    const empleadoId = Number(form.get("empleadoId"));
    if (!Number.isSafeInteger(empleadoId) || empleadoId <= 0) throw new Error("Selecciona un empleado.");
    const monto = Number(form.get("monto"));
    const motivo = String(form.get("motivo") ?? "").trim().slice(0, 200);
    const metodo = String(form.get("metodo") ?? "");
    if (!["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(metodo)) throw new Error("Selecciona cómo entregas el préstamo.");
    const cuotas: { fecha: string; valor: number }[] = JSON.parse(String(form.get("cuotas")));
    if (!Array.isArray(cuotas) || cuotas.some(c => !c || typeof c !== "object")) throw new Error("Plan de cuotas inválido.");
    validarCuotas(monto, cuotas, fechaColombia(new Date()));
    if (!motivo) throw new Error("Escribe el motivo del crédito.");
    await db.$transaction(async tx => {
      const empleado = await tx.empleado.findUnique({ where: { id: empleadoId } });
      if (!empleado || empleado.estado !== "ACTIVO") throw new Error("Selecciona un empleado activo.");
      let gastoId: number | null = null;
      if (metodo === "EFECTIVO") {
        if (await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) } })) throw new Error("La caja está cerrada. No puedes entregar un crédito en efectivo.");
        const gasto = await tx.gasto.create({ data: { descripcion: `Crédito a ${empleado.nombre} ${empleado.apellidos}: ${motivo}`, categoria: "NOMINA", valor: monto, metodo, origen: "CAJA", usuarioId: usuario.id } });
        gastoId = gasto.id;
      }
      await tx.creditoNomina.create({ data: { empleadoId, monto, motivo, metodo, gastoId, creadoById: usuario.id, cuotas: { create: cuotas.map((c, i) => ({ empleadoId, fecha: c.fecha, valor: c.valor, tipo: "DESCUENTO", descripcion: `Crédito: ${motivo} · cuota ${i + 1}/${cuotas.length}`, estado: "APROBADA", creadoById: usuario.id, aprobadoById: usuario.id, aprobadoAt: new Date() })) } } });
    });
    revalidatePath("/admin/nomina", "layout");
    revalidatePath("/admin/caja");
    revalidatePath("/admin/reportes");
    return { error: null, ok: "Crédito registrado. Las cuotas se descontarán en los pagos acordados." };
  } catch (e) {
    return { error: e instanceof Error && !("code" in e) && !(e instanceof SyntaxError) ? e.message : "No se pudo registrar el crédito. Revisa los datos e inténtalo otra vez.", ok: null };
  }
}
