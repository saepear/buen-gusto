"use server";

// ═════════ Acciones de obligaciones laborales ═════════
// Prestaciones causadas por período (prima, cesantías, intereses, vacaciones).
// Separación obligatoria:
//  1) CAUSADO: suma de la causación guardada en las liquidaciones (foto).
//  2) PAGADO: pagos registrados de ese concepto.
//  3) PENDIENTE: causado − pagado (NO se marca pagado por estar calculado).
// Un pago EFECTIVO también genera el egreso real de caja (categoria NOMINA).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionObligacion = { error: string | null; ok: string | null };

const CONCEPTOS = ["PRIMA", "CESANTIAS", "INTERESES_CESANTIAS", "VACACIONES"] as const;
export const CONCEPTO_PRESTACION_LABEL: Record<string, string> = {
  PRIMA: "Prima de servicios",
  CESANTIAS: "Cesantías",
  INTERESES_CESANTIAS: "Intereses a las cesantías",
  VACACIONES: "Vacaciones",
};

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

/** Total causado de un concepto para un empleado, con las fotos de las
 *  liquidaciones ya aprobadas o borradores (es lo causado histórico). */
export async function causadoDePrestacion(
  empleadoId: number,
  concepto: (typeof CONCEPTOS)[number],
): Promise<number> {
  const campo = {
    PRIMA: "prestacionPrima",
    CESANTIAS: "prestacionCesantias",
    INTERESES_CESANTIAS: "prestacionIntereses",
    VACACIONES: "prestacionVacaciones",
  }[concepto];
  const suma = await db.liquidacionNomina.aggregate({
    where: { empleadoId },
    _sum: { [campo]: true },
  });
  return suma._sum[campo as "prestacionPrima"] ?? 0;
}

/** Registrar el pago REAL de una prestación (con egreso de caja si efectivo) */
export async function registrarPagoPrestacion(
  _antes: EstadoAccionObligacion,
  form: FormData,
): Promise<EstadoAccionObligacion> {
  const sesion = await exigirAdmin();
  const empleadoId = Number.parseInt(String(form.get("empleadoId") ?? ""), 10);
  const concepto = String(form.get("concepto") ?? "");
  if (!Number.isInteger(empleadoId)) return { error: "Falta el empleado.", ok: null };
  if (!CONCEPTOS.includes(concepto as (typeof CONCEPTOS)[number])) {
    return { error: "Concepto inválido.", ok: null };
  }

  const monto = parseMonto(form.get("monto"));
  if (!monto) return { error: "El monto debe ser mayor a $0.", ok: null };

  const metodo = ["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(String(form.get("metodo") ?? ""))
    ? String(form.get("metodo"))
    : "EFECTIVO";
  const referencia = String(form.get("referencia") ?? "").trim().slice(0, 120) || null;
  const observaciones = String(form.get("observaciones") ?? "").trim().slice(0, 200) || null;

  const resultado = await db.$transaction(async (tx) => {
    const empleado = await tx.empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) throw new Error("El empleado no existe.");

    const campo = {
      PRIMA: "prestacionPrima",
      CESANTIAS: "prestacionCesantias",
      INTERESES_CESANTIAS: "prestacionIntereses",
      VACACIONES: "prestacionVacaciones",
    }[concepto as (typeof CONCEPTOS)[number]] as "prestacionPrima";
    const c = await tx.liquidacionNomina.aggregate({
      where: { empleadoId },
      _sum: { [campo]: true },
    });
    const causado = c._sum[campo as "prestacionPrima"] ?? 0;

    const pagadoAntes = await tx.pagoPrestacion.aggregate({
      where: { empleadoId, concepto },
      _sum: { monto: true },
    });
    const yaPagado = pagadoAntes._sum.monto ?? 0;
    const pendiente = Math.max(causado - yaPagado, 0);

    if (pendiente <= 0) {
      return {
        error: `No queda ${CONCEPTO_PRESTACION_LABEL[concepto]} pendiente de ${empleado.nombre}: no hay nada que pagar.`,
        ok: null,
      };
    }
    if (monto > pendiente) {
      return {
        error: `El pendiente de ${CONCEPTO_PRESTACION_LABEL[concepto]} es ${formatCOP(pendiente)}: no se paga de más.`,
        ok: null,
      };
    }

    let gastoId: number | null = null;
    if (metodo === "EFECTIVO") {
      const gasto = await tx.gasto.create({
        data: {
          descripcion: `Pago de ${CONCEPTO_PRESTACION_LABEL[concepto].toLowerCase()} — ${empleado.nombre} ${empleado.apellidos}`,
          categoria: "NOMINA",
          valor: monto,
          metodo: "EFECTIVO",
          origen: "CAJA",
          usuarioId: sesion.id,
          observaciones: `Generado por pago de prestación (${concepto})`,
        },
      });
      gastoId = gasto.id;
    }

    await tx.pagoPrestacion.create({
      data: {
        empleadoId,
        concepto,
        monto,
        metodo,
        referencia,
        observaciones,
        gastoId,
        usuarioId: sesion.id,
      },
    });

    return {
      ok: `Pago de ${formatCOP(monto)} de ${CONCEPTO_PRESTACION_LABEL[concepto].toLowerCase()} registrado.`,
      error: null,
    };
  });

  revalidar();
  return { error: resultado.error, ok: resultado.ok };
}
