"use server";

import { revalidatePath } from "next/cache";
import { fechaColombia } from "@/lib/nomina/resumen";
import { crearJornadaPago } from "@/lib/nomina/jornadas";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoJornadaPago = { error: string | null; ok: string | null };

export async function abrirJornadaPago(
  _previa: EstadoJornadaPago,
  form: FormData,
): Promise<EstadoJornadaPago> {
  const sesion = await exigirAdmin();
  const fecha = String(form.get("fecha") ?? "") || fechaColombia(new Date());
  try {
    const resultado = await crearJornadaPago(fecha, sesion.id);
    revalidatePath("/admin/nomina", "layout");
    realtime.broadcast("update");
    return { error: null, ok: resultado.cerrada
      ? "La jornada quedó saldada con los descuentos; no había dinero por entregar."
      : `Jornada abierta: ${resultado.preparados} pagos preparados${resultado.yaPagados ? ` y ${resultado.yaPagados} personas ya estaban al día` : ""}.` };
  } catch (error) {
    const mensaje = error instanceof Error && !("code" in error) ? error.message : "No se pudo abrir la jornada. Actualiza y vuelve a intentarlo.";
    return { error: mensaje, ok: null };
  }
}
