"use server";

// ═════════ Acciones de asistencia y jornadas ═════════
// Registro administrativo manual (no hay reloj biométrico). Cada jornada se
// CLASIFICA al guardar y los minutos quedan CONGELADOS en la fila: las
// liquidaciones leen esos números guardados, nunca recalculan.
// Modificaciones posteriores exigen motivo (auditoría).

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/session";
import {
  CLAVE_PARAM,
  cargarParametros,
  mapaParametros,
} from "@/lib/nomina/parametros";
import { clasificarJornada, esDiaRecargado } from "@/lib/nomina/calculo";

export type EstadoAccionJornada = { error: string | null; ok: string | null };

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const entero = (v: unknown): number | null => {
  const limpio = String(v ?? "").replace(/[^0-9]/g, "");
  if (limpio === "") return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isInteger(n) ? n : null;
};

/** «HH:MM» o «HHMM» → minutos desde medianoche */
function minutosDeHora(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const h = Number.parseInt(s.slice(0, s.length - 2), 10);
  const m = Number.parseInt(s.slice(-2), 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function revalidar() {
  revalidatePath("/admin/nomina", "layout");
}

/**
 * Registrar (o sobrescribir sin auditoría si es creación) UNA jornada.
 * El inicioNocturno y la jornada semanal salen de los parámetros vigentes;
 * el festivo sale de la tabla Festivo; el descanso semanal del empleado.
 */
export async function guardarJornada(
  _antes: EstadoAccionJornada,
  form: FormData,
): Promise<EstadoAccionJornada> {
  const sesion = await exigirAdmin();
  const empleadoId = entero(form.get("empleadoId"));
  const fecha = texto(form.get("fecha"), 10);
  const entrada = minutosDeHora(form.get("entrada"));
  const salida = minutosDeHora(form.get("salida"));
  const descanso = Math.max(entero(form.get("descansoMinutos")) ?? 0, 0);

  if (!empleadoId) return { error: "Falta el empleado.", ok: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Fecha inválida.", ok: null };
  if (entrada == null || salida == null) {
    return { error: "Horas de entrada y salida inválidas (formato HH:MM).", ok: null };
  }

  const empleado = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado) return { error: "El empleado no existe.", ok: null };

  const filas = await cargarParametros(new Date(`${fecha}T12:00:00.000Z`));
  const params = mapaParametros(filas);
  const jornadaSemanal = params[CLAVE_PARAM.JORNADA_SEMANAL_MIN] ?? empleado.jornadaSemanalMinutos;
  const inicioNocturno = params[CLAVE_PARAM.HORA_INICIO_NOCTURNO] ?? 1320;

  const festivos = await db.festivo.findUnique({ where: { fecha } });
  const esFestivo = Boolean(festivos);
  const conRecargo = esDiaRecargado(fecha, empleado.diaDescanso, new Set(esFestivo ? [fecha] : []));

  const minutos = clasificarJornada(
    entrada,
    salida,
    descanso,
    conRecargo,
    jornadaSemanal,
    inicioNocturno,
  );

  const existente = await db.jornadaLaboral.findUnique({
    where: { empleadoId_fecha: { empleadoId, fecha } },
  });
  if (existente) {
    const motivo = texto(form.get("motivo"), 200);
    if (!motivo) {
      return {
        error:
          "Ya existe una jornada ese día: para cambiarla escribe el motivo de la corrección (queda auditado).",
        ok: null,
      };
    }
  }

  // Upsert por (empleadoId, fecha): una fila por día
  await db.jornadaLaboral.upsert({
    where: { empleadoId_fecha: { empleadoId, fecha } },
    create: {
      empleadoId,
      fecha,
      entradaMinutos: entrada,
      salidaMinutos: salida,
      descansoMinutos: descanso,
      esFestivo,
      esDiaDescanso: conRecargo && !esFestivo,
      ...minutos,
      observaciones: texto(form.get("observaciones"), 200) || null,
      creadoById: sesion.id,
    },
    update: {
      entradaMinutos: entrada,
      salidaMinutos: salida,
      descansoMinutos: descanso,
      esFestivo,
      esDiaDescanso: conRecargo && !esFestivo,
      ...minutos,
      observaciones: texto(form.get("observaciones"), 200) || null,
      modificadoById: sesion.id,
      modificadoAt: new Date(),
      modificadoMotivo: texto(form.get("motivo"), 200) || "Actualización de la jornada",
    },
  });

  revalidar();
  return { ok: "Jornada guardada y clasificada.", error: null };
}

/** Corregir una jornada: EXIGE motivo y queda auditada (quién y cuándo). */
export async function corregirJornada(
  antes: EstadoAccionJornada,
  form: FormData,
): Promise<EstadoAccionJornada> {
  const motivo = String(form.get("motivo") ?? "").trim();
  if (!motivo) {
    return { error: "El motivo de la corrección es obligatorio (quedaría auditado).", ok: null };
  }
  // La corrección es guardar la jornada con motivo obligatorio.
  return guardarJornada(antes, form);
}

/** Borrar una jornada solo se admite si NINGUNA liquidación la consumió:
 *  los períodos cerrados no se tocan. */
export async function eliminarJornada(
  _antes: EstadoAccionJornada,
  form: FormData,
): Promise<EstadoAccionJornada> {
  await exigirAdmin();
  const jornadaId = entero(form.get("jornadaId"));
  if (!jornadaId) return { error: "Falta la jornada.", ok: null };
  const jornada = await db.jornadaLaboral.findUnique({
    where: { id: jornadaId },
    include: { empleado: true },
  });
  if (!jornada) return { error: "No existe esa jornada.", ok: null };
  // Guarda de seguridad: liquidar consume por rango de fechas, así que solo
  // impedimos borrar si el día pertenece a un período con liquidaciones ya
  // generadas del empleado.
  const conflictos = await db.liquidacionNomina.count({
    where: {
      empleadoId: jornada.empleadoId,
      periodo: {
        fechaDesde: { lte: jornada.fecha },
        fechaHasta: { gte: jornada.fecha },
      },
    },
  });
  if (conflictos > 0) {
    return {
      error:
        "Ese día ya está dentro de un período con liquidaciones: cámbialo registrando la jornada correcta, no borrando.",
      ok: null,
    };
  }
  await db.jornadaLaboral.delete({ where: { id: jornadaId } });
  revalidar();
  return { ok: "Jornada eliminada.", error: null };
}
