"use server";

// ═════════ Acciones de pagos de nómina ═════════
// Reglas de caja (acordadas):
//  • Una nómina pendiente NO genera egreso: la caja solo se toca cuando se
//    registra un pago EFECTIVO (ahí nace un Gasto categoría NOMINA en la
//    MISMA transacción: nunca dos egresos por el mismo pago).
//  • Transferencia/otro método: queda registrado como pago de nómina SIN
//    descontar el efectivo físico de caja.
//  • No se paga más del saldo pendiente; los cierres de caja no se tocan.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formatCOP, claveDia } from "@/lib/format";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import { prepararLiquidacion } from "@/lib/nomina/preparar-liquidacion";

export type EstadoAccionPago = { error: string | null; ok: string | null };

/** parseo «$30.000»/«30,000»/«30000» → 30000 */
function parseMonto(crudo: unknown): number | null {
  const limpio = String(crudo ?? "").replace(/[^0-9]/g, "");
  if (limpio === "") return null;
  const valor = Number.parseInt(limpio, 10);
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}

function revalidar() {
  revalidatePath("/admin/nomina", "layout");
  revalidatePath("/admin/caja", "layout");
  realtime.broadcast("update");
}

/**
 * Registrar UN pago de nómina (parcial o total) con vínculo a caja en la
 * misma transacción cuando es EFECTIVO.
 */
export async function registrarPagoNomina(
  _antes: EstadoAccionPago,
  form: FormData,
): Promise<EstadoAccionPago> {
  const sesion = await exigirAdmin();
  const liquidacionId = Number.parseInt(String(form.get("liquidacionId") ?? ""), 10);
  if (!Number.isInteger(liquidacionId)) return { error: "Falta la liquidación.", ok: null };

  const monto = String(form.get("monto")) === "0" ? 0 : parseMonto(form.get("monto"));
  if (monto === null) return { error: "El monto no es válido.", ok: null };

  const metodo = ["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(
    String(form.get("metodo") ?? ""),
  )
    ? String(form.get("metodo"))
    : "EFECTIVO";

  const referencia = String(form.get("referencia") ?? "").trim().slice(0, 120) || null;
  const observaciones = String(form.get("observaciones") ?? "").trim().slice(0, 200) || null;

  try {
  const anterior = await db.liquidacionNomina.findUnique({ where: { id: liquidacionId } });
  if (!anterior?.jornadaId) {
    return { error: "Abre una jornada de pagos antes de registrar entregas. Así cada pago queda ordenado dentro de su día de nómina.", ok: null };
  }
  if (anterior && anterior.estadoPago !== "PAGADO" && anterior.pagado === 0) {
    const actualizado = await prepararLiquidacion({ periodoId: anterior.periodoId, empleadoId: anterior.empleadoId, usuarioId: sesion.id, soloSiFalta: true });
    if (actualizado.error) return actualizado;
  }

  const resultado = await db.$transaction(async (tx) => {
    if (monto > 0 && metodo === "EFECTIVO" && await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) {
      return { error: "La caja de hoy ya está cerrada: no se pueden registrar pagos de nómina en efectivo posteriores.", ok: null };
    }
    const liquidacion = await tx.liquidacionNomina.findUnique({
      where: { id: liquidacionId },
      include: { empleado: true, periodo: true, jornada: true },
    });
    if (!liquidacion) throw new Error("La liquidación no existe.");
    if (!liquidacion.jornadaId || liquidacion.jornada?.estado !== "ABIERTA") {
      return { error: "Esta jornada ya está cerrada. Abre una nueva jornada para registrar otro pago.", ok: null };
    }
    if (form.has("netoRevisado") && Number(form.get("netoRevisado")) !== liquidacion.netoAPagar) {
      revalidar();
      return { error: "Se actualizaron los descuentos. Vuelve a abrir el pago y revisa el nuevo total.", ok: null };
    }
    if (liquidacion.periodo.estado === "CERRADO") {
      return { error: "El período ya está cerrado: abre un corte nuevo para registrar pagos.", ok: null };
    }

    const pendiente = liquidacion.netoAPagar - liquidacion.pagado;
    if (liquidacion.pagado === 0 && liquidacion.estadoPago !== "PAGADO") {
      const nuevosVales = await tx.valeNomina.count({ where: { empleadoId: liquidacion.empleadoId, liquidacionId: null, estado: { in: ["PENDIENTE", "AUTORIZADO"] }, fecha: { lte: liquidacion.periodo.fechaHasta } } });
      const nuevasCuotas = await tx.novedadNomina.count({ where: { empleadoId: liquidacion.empleadoId, liquidacionId: null, estado: "APROBADA", tipo: { in: ["BONIFICACION", "COMISION", "DESCUENTO"] }, fecha: { lte: liquidacion.periodo.fechaHasta } } });
      if (nuevosVales || nuevasCuotas) return { error: "Hay movimientos nuevos. Vuelve a abrir el pago para incluirlos.", ok: null };
    }
    if (monto === 0 && liquidacion.netoAPagar === 0 && liquidacion.estadoPago !== "PAGADO") {
      await tx.liquidacionNomina.update({ where: { id: liquidacionId }, data: { estadoPago: "PAGADO", estado: "APROBADA" } });
      await tx.valeNomina.updateMany({ where: { liquidacionId, estado: "AUTORIZADO" }, data: { estado: "DESCONTADO" } });
      const faltan = await tx.liquidacionNomina.count({ where: { jornadaId: liquidacion.jornadaId, estadoPago: { not: "PAGADO" } } });
      if (faltan === 0) await tx.jornadaPagoNomina.update({ where: { id: liquidacion.jornadaId }, data: { estado: "CERRADA", claveAbierta: null, cerradoById: sesion.id, cerradoAt: new Date() } });
      return { error: null, ok: "Pago saldado con descuentos. No se registró salida de dinero." };
    }
    if (pendiente <= 0 || monto === 0) {
      return { error: "Esta liquidación ya está pagada completa: no se puede pagar dos veces.", ok: null };
    }
    if (monto > pendiente) {
      return {
        error: `El saldo pendiente es ${formatCOP(pendiente)}: para entregar más se necesita un ajuste justificado, no este pago.`,
        ok: null,
      };
    }

    // Gasto ÚNICO solo cuando sale dinero REAL de caja (efectivo)
    let gastoId: number | null = null;
    if (metodo === "EFECTIVO") {
      const gasto = await tx.gasto.create({
        data: {
          descripcion: `Pago de nómina ${liquidacion.empleado.nombre} ${liquidacion.empleado.apellidos} · período ${liquidacion.periodo.fechaDesde} → ${liquidacion.periodo.fechaHasta}`,
          categoria: "NOMINA",
          valor: monto,
          metodo: "EFECTIVO",
          origen: "CAJA",
          usuarioId: sesion.id,
          observaciones: `Generado por pago de nómina (liquidación #${liquidacion.id})`,
        },
      });
      gastoId = gasto.id;
    }

    const pago = await tx.pagoNomina.create({
      data: {
        liquidacionId,
        monto,
        metodo,
        referencia,
        observaciones,
        gastoId,
        usuarioId: sesion.id,
      },
    });

    const totalPagado = liquidacion.pagado + monto;
    const estadoPago = totalPagado >= liquidacion.netoAPagar ? "PAGADO" : "PARCIALMENTE";
    await tx.liquidacionNomina.update({
      where: { id: liquidacionId },
      data: { pagado: totalPagado, estadoPago },
    });
    if (estadoPago === "PAGADO") await tx.valeNomina.updateMany({ where: { liquidacionId, estado: "AUTORIZADO" }, data: { estado: "DESCONTADO" } });
    if (estadoPago === "PAGADO") {
      const faltan = await tx.liquidacionNomina.count({ where: { jornadaId: liquidacion.jornadaId, estadoPago: { not: "PAGADO" } } });
      if (faltan === 0) {
        await tx.jornadaPagoNomina.update({
          where: { id: liquidacion.jornadaId },
          data: { estado: "CERRADA", claveAbierta: null, cerradoById: sesion.id, cerradoAt: new Date() },
        });
      }
    }

    return {
      ok: `Pago de ${formatCOP(monto)} registrado (${estadoPago === "PAGADO" ? "liquidación completa" : "queda saldo pendiente"}).`,
      error: null,
      pagoId: pago.id,
    };
  });

  revalidar();
  return { error: resultado.error, ok: resultado.ok };
  } catch (e) {
    return { error: e instanceof Error && !("code" in e) ? e.message : "El pago cambió o no pudo guardarse. Vuelve a abrirlo antes de intentarlo otra vez.", ok: null };
  }
}
