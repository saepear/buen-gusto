"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import { registrarEntregaNomina } from "@/lib/nomina/entregas";

export type EstadoAccionPago = { error: string | null; ok: string | null };

export async function registrarPagoNomina(
  _antes: EstadoAccionPago,
  form: FormData,
): Promise<EstadoAccionPago> {
  const sesion = await exigirAdmin();
  const liquidacionId = Number(form.get("liquidacionId"));
  const crudo = String(form.get("monto") ?? "").trim();
  if (!Number.isSafeInteger(liquidacionId) || liquidacionId <= 0) return { error: "Falta el pago del empleado.", ok: null };
  // Permite separadores de miles; rechaza signos negativos y texto arbitrario.
  if (!/^\d[\d.,\s]*$/.test(crudo)) return { error: "Indica un importe positivo en pesos.", ok: null };
  const monto = Number(crudo.replace(/[.,\s]/g, ""));
  try {
    const resultado = await registrarEntregaNomina({
      liquidacionId, monto, metodo: String(form.get("metodo") ?? ""), usuarioId: sesion.id,
      netoRevisado: form.has("netoRevisado") ? Number(form.get("netoRevisado")) : NaN,
      referencia: String(form.get("referencia") ?? "").trim().slice(0, 120) || null,
      observaciones: String(form.get("observaciones") ?? "").trim().slice(0, 200) || null,
    });
    revalidatePath("/admin/nomina", "layout");
    revalidatePath("/admin/caja", "layout");
    realtime.broadcast("update");
    return resultado;
  } catch (error) {
    return { error: error instanceof Error && !("code" in error) ? error.message : "El pago cambió o no pudo guardarse. Actualiza antes de volver a intentarlo.", ok: null };
  }
}
