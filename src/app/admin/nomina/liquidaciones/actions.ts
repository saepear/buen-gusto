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

  const monto = parseMonto(form.get("monto"));
  if (!monto) return { error: "El monto debe ser mayor a $0.", ok: null };

  const metodo = ["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(
    String(form.get("metodo") ?? ""),
  )
    ? String(form.get("metodo"))
    : "EFECTIVO";

  const referencia = String(form.get("referencia") ?? "").trim().slice(0, 120) || null;
  const observaciones = String(form.get("observaciones") ?? "").trim().slice(0, 200) || null;

  const resultado = await db.$transaction(async (tx) => {
    if (metodo === "EFECTIVO" && await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) {
      return { error: "La caja de hoy ya está cerrada: no se pueden registrar pagos de nómina en efectivo posteriores.", ok: null };
    }
    const liquidacion = await tx.liquidacionNomina.findUnique({
      where: { id: liquidacionId },
      include: { empleado: true, periodo: true },
    });
    if (!liquidacion) throw new Error("La liquidación no existe.");
    if (liquidacion.estado !== "APROBADA") {
      return {
        error:
          "Solo se paga una liquidación APROBADA: apruébala primero (sus valores deben quedar congelados antes de entregar dinero).",
        ok: null,
      };
    }

    const pendiente = liquidacion.netoAPagar - liquidacion.pagado;
    if (pendiente <= 0) {
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

    return {
      ok: `Pago de ${formatCOP(monto)} registrado (${estadoPago === "PAGADO" ? "liquidación completa" : "queda saldo pendiente"}).`,
      error: null,
      pagoId: pago.id,
    };
  });

  revalidar();
  return { error: resultado.error, ok: resultado.ok };
}
