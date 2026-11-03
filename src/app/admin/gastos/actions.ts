"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import {
  CATEGORIA_GASTO,
  ES_METODO_PAGO,
  ORIGEN_GASTO,
} from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionGasto = { error: string | null; ok: string | null };

class ErrorDeGasto extends Error {}

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** «$45.000», «45,000» o «45000» → 45000 */
function parseMonto(crudo: unknown): number | null {
  const limpio = String(crudo ?? "").replace(/[^0-9]/g, "");
  if (limpio === "") return null;
  const valor = Number.parseInt(limpio, 10);
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/reportes", "layout");
  realtime.broadcast("update");
}

/**
 * Registra un gasto del negocio. Con origen CAJA y método EFECTIVO el dinero
 * sale hoy del efectivo de caja; con EXTERNO queda auditado sin tocar caja.
 */
export async function crearGasto(
  _previa: EstadoAccionGasto,
  datos: FormData,
): Promise<EstadoAccionGasto> {
  let adminId: number;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador registra gastos.", ok: null };
  }

  const descripcion = texto(datos.get("descripcion"), 140);
  if (descripcion.length < 3) {
    return { error: "Escribe qué se compró (descripción).", ok: null };
  }
  const categoria = String(datos.get("categoria") ?? "");
  if (!Object.values(CATEGORIA_GASTO).includes(categoria as never)) {
    return { error: "Escoge la categoría del gasto.", ok: null };
  }
  const valor = parseMonto(datos.get("valor"));
  if (valor === null || valor > 20_000_000) {
    return { error: "El valor del gasto no es válido.", ok: null };
  }
  const metodo = String(datos.get("metodo") ?? "");
  if (!ES_METODO_PAGO(metodo)) {
    return { error: "Escoge cómo se pagó.", ok: null };
  }
  const origen = String(datos.get("origen") ?? "");
  if (origen !== ORIGEN_GASTO.CAJA && origen !== ORIGEN_GASTO.EXTERNO) {
    return { error: "Aclara si pagaron con dinero de caja o externo.", ok: null };
  }
  const observaciones = texto(datos.get("observaciones"), 240) || null;

  await db.gasto.create({
    data: {
      descripcion,
      categoria,
      valor,
      metodo,
      origen,
      usuarioId: adminId,
      observaciones,
    },
  });

  revalidar();
  return {
    error: null,
    ok:
      origen === ORIGEN_GASTO.CAJA
        ? `Gasto de ${formatCOP(valor)} registrado${
            metodo === "EFECTIVO" ? " y descontado del efectivo de hoy" : ""
          }.`
        : `Gasto de ${formatCOP(valor)} registrado (dinero externo, auditable).`,
  };
}

/**
 * Anula un gasto con motivo: el registro queda para auditoría con quién y
 * cuándo lo anuló (nunca se borra).
 */
export async function anularGasto(
  _previa: EstadoAccionGasto,
  datos: FormData,
): Promise<EstadoAccionGasto> {
  let adminId: number;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador anula gastos.", ok: null };
  }

  const gastoId = Number.parseInt(String(datos.get("gastoId") ?? ""), 10);
  if (!Number.isInteger(gastoId)) {
    return { error: "Gasto inválido.", ok: null };
  }
  const motivo = texto(datos.get("motivo"), 200);
  if (motivo.length < 4) {
    return { error: "Explica brevemente por qué se anula.", ok: null };
  }

  try {
    await db.$transaction(async (tx) => {
      const gasto = await tx.gasto.findUnique({
        where: { id: gastoId },
        select: { anulado: true },
      });
      if (!gasto) throw new ErrorDeGasto("Ese gasto ya no existe.");
      if (gasto.anulado) throw new ErrorDeGasto("Ese gasto ya estaba anulado.");
      await tx.gasto.update({
        where: { id: gastoId },
        data: {
          anulado: true,
          anuladoById: adminId,
          anuladoAt: new Date(),
          anuladoMotivo: motivo,
        },
      });
    });
  } catch (e) {
    if (e instanceof ErrorDeGasto) return { error: e.message, ok: null };
    return { error: "No se pudo anular el gasto. Intenta otra vez.", ok: null };
  }

  revalidar();
  return { error: null, ok: "Gasto anulado. El registro queda para auditoría." };
}
