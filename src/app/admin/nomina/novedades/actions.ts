"use server";

// ═════════ Acciones de novedades de nómina ═════════
// Comisiones, bonos, ausencias, incapacidades, permisos, vacaciones y
// descuentos autorizados. Solo se incorporan a liquidar si quedan APROBADAS
// y jamás se cuentan dos veces (la liquidación les estampa liquidacionId).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/session";
import { TIPO_NOVEDAD, ESTADO_NOVEDAD } from "./constantes";

export type EstadoAccionNovedad = { error: string | null; ok: string | null };

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const entero = (v: unknown): number | null => {
  const limpio = String(v ?? "").replace(/[^0-9]/g, "");
  if (limpio === "") return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isInteger(n) ? n : null;
};

function revalidar() {
  revalidatePath("/admin/nomina", "layout");
}

export async function crearNovedad(
  _antes: EstadoAccionNovedad,
  form: FormData,
): Promise<EstadoAccionNovedad> {
  const sesion = await exigirAdmin();
  const empleadoId = entero(form.get("empleadoId"));
  const fecha = texto(form.get("fecha"), 10);
  const tipo = texto(form.get("tipo"), 30);
  const descripcion = texto(form.get("descripcion"), 200);

  if (!empleadoId) return { error: "Falta el empleado.", ok: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida.", ok: null };
  if (!(tipo in TIPO_NOVEDAD)) return { error: "Tipo de novedad inválido.", ok: null };
  if (!descripcion) return { error: "Describe la novedad.", ok: null };

  const empleadoPosee = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleadoPosee) return { error: "El empleado no existe.", ok: null };

  // Campos según tipo: días (ausencias/permisos/vacaciones) o valor (comisiones/bonos/descuentos)
  const dias = entero(form.get("dias"));
  const valor = entero(form.get("valor"));
  const pideDias = ["AUSENCIA", "INCAPACIDAD", "PERMISO_REMUNERADO", "PERMISO_NO_REMUNERADO", "VACACIONES"].includes(tipo);
  const pideValor = ["COMISION", "BONIFICACION", "DESCUENTO"].includes(tipo);
  if (pideDias && (dias == null || dias <= 0)) {
    return { error: "Especifica la cantidad de días (mínimo 1).", ok: null };
  }
  if (pideValor && (valor == null || valor <= 0)) {
    return { error: "Especifica el valor (mínimo $1).", ok: null };
  }

  await db.novedadNomina.create({
    data: {
      empleadoId,
      fecha,
      tipo,
      dias: pideDias ? (dias ?? null) : null,
      valor: pideValor ? (valor ?? null) : null,
      descripcion,
      estado: ESTADO_NOVEDAD.PENDIENTE,
      creadoById: sesion.id,
    },
  });

  revalidar();
  return { ok: "Novedad registrada (queda pendiente de aprobar).", error: null };
}

/** Aprobar: es la puerta para que una liquidación la incorpore. */
export async function aprobarNovedad(
  _antes: EstadoAccionNovedad,
  form: FormData,
): Promise<EstadoAccionNovedad> {
  const sesion = await exigirAdmin();
  const novedadId = entero(form.get("novedadId"));
  if (!novedadId) return { error: "Falta la novedad.", ok: null };

  const novedad = await db.novedadNomina.findUnique({ where: { id: novedadId } });
  if (!novedad) return { error: "La novedad no existe.", ok: null };
  if (novedad.estado !== ESTADO_NOVEDAD.PENDIENTE) {
    return { error: "Solo las novedades pendientes se pueden aprobar.", ok: null };
  }

  await db.novedadNomina.update({
    where: { id: novedadId },
    data: {
      estado: ESTADO_NOVEDAD.APROBADA,
      aprobadoById: sesion.id,
      aprobadoAt: new Date(),
    },
  });

  revalidar();
  return { ok: "Novedad aprobada.", error: null };
}

/** Rechazar con motivo: queda visible pero jamás se liquida. */
export async function rechazarNovedad(
  _antes: EstadoAccionNovedad,
  form: FormData,
): Promise<EstadoAccionNovedad> {
  const sesion = await exigirAdmin();
  const novedadId = entero(form.get("novedadId"));
  const motivo = texto(form.get("motivo"), 200);
  if (!novedadId) return { error: "Falta la novedad.", ok: null };
  if (!motivo) return { error: "El motivo del rechazo es obligatorio.", ok: null };

  const novedad = await db.novedadNomina.findUnique({ where: { id: novedadId } });
  if (!novedad) return { error: "La novedad no existe.", ok: null };
  if (novedad.estado !== ESTADO_NOVEDAD.PENDIENTE) {
    return { error: "Solo las novedades pendientes se pueden rechazar.", ok: null };
  }

  await db.novedadNomina.update({
    where: { id: novedadId },
    data: {
      estado: ESTADO_NOVEDAD.RECHAZADA,
      aprobadoById: sesion.id,
      aprobadoAt: new Date(),
      rechazoMotivo: motivo,
    },
  });

  revalidar();
  return { ok: "Novedad rechazada.", error: null };
}
