"use server";

// ═════════ Acciones de VALES de empleado ═════════
// Un vale es un producto entregado A CUENTA del sueldo: se registra
// EXPRESAMENTE (jamás se descuentan compras de un Cliente) con el precio
// congelado al entregar. Solo el AUTORIZADO se descuenta al liquidar el
// ciclo (lo hace liquidarEmpleadoEnPeriodo); anular conserva el original
// con motivo (trazabilidad, nada se borra).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { exigirAdmin } from "@/lib/session";
import { fechaColombia, fechaNominaValida } from "@/lib/nomina/resumen";

export type EstadoAccionVale = { error: string | null; ok: string | null };

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const entero = (v: unknown): number | null => {
  const limpio = String(v ?? "").trim();
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isSafeInteger(n) && n <= 2_147_483_647 ? n : null;
};

function revalidar() {
  revalidatePath("/admin/nomina", "layout");
}

/** Registrar un vale: producto del catálogo (o libre), cantidad, precio
 *  registrado AL ENTREGAR, empleado activo y (opcional) ciclo de destino. */
export async function registrarVale(
  _antes: EstadoAccionVale,
  form: FormData,
): Promise<EstadoAccionVale> {
  const sesion = await exigirAdmin();

  const empleadoId = entero(form.get("empleadoId"));
  if (!empleadoId) return { error: "Falta el empleado.", ok: null };

  const productoFila = await db.producto.findUnique({
    where: { id: entero(form.get("productoId")) ?? 0 },
  });

  const productoNombre = texto(form.get("productoNombre"), 120) || productoFila?.nombre || "";
  if (!productoNombre) {
    return { error: "Elige un producto del catálogo o escribe el nombre.", ok: null };
  }

  const cantidad = entero(form.get("cantidad"));
  if (cantidad === null || cantidad < 1 || cantidad > 99) {
    return { error: "La cantidad debe estar entre 1 y 99.", ok: null };
  }

  // Precio CONGELADO al entregar (el del catálogo por defecto, editable)
  const precioUnitario = entero(form.get("precioUnitario")) ?? 0;
  if (precioUnitario <= 0 || cantidad * precioUnitario > 2_147_483_647) {
    return { error: "El precio del vale debe ser mayor a $0.", ok: null };
  }

  const fecha = texto(form.get("fecha"), 10) || fechaColombia(new Date());
  if (!fechaNominaValida(fecha)) return { error: "Fecha inválida.", ok: null };

  const cicloId = entero(form.get("cicloId")) ?? 0;
  const ciclo = cicloId ? await db.periodoNomina.findUnique({ where: { id: cicloId } }) : null;
  if (cicloId && !ciclo) return { error: "El ciclo no existe.", ok: null };
  if (ciclo && ciclo.estado !== "ABIERTO") {
    return { error: "Ese ciclo ya está cerrado: elige uno abierto.", ok: null };
  }
  if (ciclo && (fecha < ciclo.fechaDesde || fecha > ciclo.fechaHasta)) {
    return { error: "La fecha de entrega debe pertenecer al ciclo seleccionado.", ok: null };
  }

  const empleado = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado) return { error: "El empleado no existe.", ok: null };
  if (empleado.estado !== "ACTIVO") {
    return { error: "Solo se registran vales a empleados ACTIVOS.", ok: null };
  }

  await db.valeNomina.create({
    data: {
      empleadoId,
      productoId: productoFila?.id ?? null,
      productoNombre,
      cantidad,
      precioUnitario,
      total: cantidad * precioUnitario,
      fecha,
      observaciones: texto(form.get("observaciones"), 200) || null,
      cicloId: ciclo?.id ?? null,
      estado: "PENDIENTE",
      creadoById: sesion.id,
    },
  });

  revalidar();
  return {
    ok: `Vale registrado: ${productoNombre} ×${cantidad} (${formatCOP(cantidad * precioUnitario)}) a cuenta de ${empleado.nombre}.`,
    error: null,
  };
}

/** Autorizar (o devolver a pendiente) un vale: solo si nunca se descontó. */
export async function autorizarVale(
  _antes: EstadoAccionVale,
  form: FormData,
): Promise<EstadoAccionVale> {
  const sesion = await exigirAdmin();
  const id = entero(form.get("valeId"));
  if (!id) return { error: "Falta el vale.", ok: null };

  const vale = await db.valeNomina.findUnique({
    where: { id },
    include: { empleado: true },
  });
  if (!vale) return { error: "El vale no existe.", ok: null };
  if (vale.estado === "DESCONTADO" || vale.estado === "ANULADO") {
    return { error: "Este vale ya está descontado o anulado: su estado es historia.", ok: null };
  }

  const nuevo = vale.estado === "PENDIENTE" ? "AUTORIZADO" : "PENDIENTE";
  const soporte = texto(form.get("soporteAutorizacion"), 120);
  if (nuevo === "AUTORIZADO" && soporte.length < 3) {
    return { error: "Registra la referencia del soporte de autorización escrita del trabajador. Verifica los límites legales antes de descontar.", ok: null };
  }
  const resultado = await db.valeNomina.updateMany({
    where: { id, estado: vale.estado, liquidacionId: null },
    data:
      nuevo === "AUTORIZADO"
        ? { estado: nuevo, autorizadoById: sesion.id, autorizadoAt: new Date(), observaciones: [vale.observaciones, `Autorización escrita: ${soporte} · ${new Date().toISOString()}`].filter(Boolean).join("\n") }
        : { estado: nuevo, autorizadoById: null, autorizadoAt: null },
  });
  if (resultado.count !== 1) return { error: "El vale cambió mientras lo revisabas. Actualiza la página.", ok: null };

  revalidar();
  return {
    ok:
      nuevo === "AUTORIZADO"
        ? `Vale de ${vale.empleado.nombre} autorizado: se descontará al liquidar su ciclo.`
        : `Vale devuelto a pendiente (sin autorización).`,
    error: null,
  };
}

/** Anular un vale con motivo. Se conserva el registro original (auditoría);
 *  un vale DESCONTADO NO se anula: se corrige con novedad o ajuste nuevo. */
export async function anularVale(
  _antes: EstadoAccionVale,
  form: FormData,
): Promise<EstadoAccionVale> {
  await exigirAdmin();
  const id = entero(form.get("valeId"));
  const motivo = texto(form.get("motivo"), 200);
  if (!id) return { error: "Falta el vale.", ok: null };
  if (!motivo) return { error: "El motivo de anulación es obligatorio (auditoría).", ok: null };

  const vale = await db.valeNomina.findUnique({ where: { id } });
  if (!vale) return { error: "El vale no existe.", ok: null };
  if (vale.estado === "DESCONTADO") {
    return {
      error: "Este vale ya quedó DESCONTADO en una liquidación: no se anula. Haz el ajuste con una novedad nueva.",
      ok: null,
    };
  }
  if (vale.estado === "ANULADO") return { error: "Ya está anulado.", ok: null };

  const resultado = await db.valeNomina.updateMany({
    where: { id, estado: vale.estado, liquidacionId: null },
    data: { estado: "ANULADO", anuladoMotivo: motivo },
  });
  if (resultado.count !== 1) return { error: "El vale cambió mientras lo revisabas. Actualiza la página.", ok: null };

  revalidar();
  return { ok: "Vale anulado (el registro original se conserva).", error: null };
}
