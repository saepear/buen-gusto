"use server";

// ═════════ Acciones de períodos y liquidaciones ═════════
// • Un período es QUINCENAL o MENSUAL con rango fijo y SIN superponer otro.
// • Liquidar un empleado crea (o refresca, solo en BORRADOR) su fila con
//   FOTO de contrato, parámetros y conceptos: el cálculo queda congelado.
// • Aprobar cierra el asunto individual; CERRADO amerita que TODAS estén
//   aprobadas. Una liquidación APROBADA nunca se recalcula (foto sagrada).
// • Una nómina pendiente NO toca la caja: los egresos nacen SOLO del pago.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import { fotoParametros } from "@/lib/nomina/parametros";
import {
  aplicaAuxilioTransporte,
  contratoVigente,
  parametrosDelPeriodo,
  rangoDePeriodo,
} from "@/lib/nomina/helpers";
import {
  liquidarEmpleado,
  type JornadaResumen,
  type NovedadResumen,
} from "@/lib/nomina/calculo";

export type EstadoAccionPeriodo = { error: string | null; ok: string | null };

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const entero = (v: unknown): number | null => {
  const limpio = String(v ?? "").replace(/[^0-9]/g, "");
  if (limpio === "") return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isInteger(n) ? n : null;
};

function revalidar() {
  revalidatePath("/admin/nomina", "layout");
  realtime.broadcast("update");
}

/** Crear período (QUINCENAL 1|2 o MENSUAL). Sin solapamientos con otro. */
export async function crearPeriodo(
  _antes: EstadoAccionPeriodo,
  form: FormData,
): Promise<EstadoAccionPeriodo> {
  const sesion = await exigirAdmin();
  const tipo = texto(form.get("tipo"), 20) === "MENSUAL" ? "MENSUAL" : "QUINCENAL";
  const anio = entero(form.get("anio"));
  const mes = entero(form.get("mes"));
  const quincena = texto(form.get("quincena"), 10) === "2" ? 2 : 1;
  if (!anio || !mes || mes < 1 || mes > 12) {
    return { error: "Elige un mes y año válidos.", ok: null };
  }
  const rango = rangoDePeriodo(tipo, anio, mes, quincena as 1 | 2);
  if (!rango) return { error: "Rango de período inválido.", ok: null };

  const solapa = await db.periodoNomina.findFirst({
    where: {
      fechaHasta: { gte: rango.desde },
      fechaDesde: { lte: rango.hasta },
    },
  });
  if (solapa) {
    return {
      error: `Ya existe un período (${solapa.fechaDesde} → ${solapa.fechaHasta}) que se cruza con ese rango.`,
      ok: null,
    };
  }

  const fechaPagoPrevista = texto(form.get("fechaPagoPrevista"), 10);
  await db.periodoNomina.create({
    data: {
      fechaDesde: rango.desde,
      fechaHasta: rango.hasta,
      fechaPagoPrevista: /^\d{4}-\d{2}-\d{2}$/.test(fechaPagoPrevista) ? fechaPagoPrevista : null,
      tipo,
      estado: "ABIERTO",
      creadoById: sesion.id,
    },
  });

  revalidar();
  return { ok: `Período ${rango.desde} → ${rango.hasta} creado (abierto).`, error: null };
}

/** Refresca (o crea) la liquidación BORRADOR de un empleado en el período,
 *  con FOTO de contrato vigente, parámetros del período y conceptos. */
export async function liquidarEmpleadoEnPeriodo(
  _antes: EstadoAccionPeriodo,
  form: FormData,
): Promise<EstadoAccionPeriodo> {
  const sesion = await exigirAdmin();
  const periodoId = entero(form.get("periodoId"));
  const empleadoId = entero(form.get("empleadoId"));
  if (!periodoId || !empleadoId) return { error: "Falta el período o el empleado.", ok: null };

  const periodo = await db.periodoNomina.findUnique({ where: { id: periodoId } });
  if (!periodo) return { error: "El período no existe.", ok: null };
  if (periodo.estado === "CERRADO") {
    return { error: "El período está CERRADO: sus liquidaciones no se recalculan.", ok: null };
  }

  const empleado = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado) return { error: "El empleado no existe.", ok: null };

  if (empleado.fechaIngreso > new Date(`${periodo.fechaHasta}T12:00:00.000Z`)) {
    return {
      error: `${empleado.nombre} ingresó después del período: no le corresponde esta nómina.`,
      ok: null,
    };
  }
  if (
    empleado.estado === "INACTIVO" &&
    empleado.fechaRetiro &&
    empleado.fechaRetiro < new Date(`${periodo.fechaDesde}T12:00:00.000Z`)
  ) {
    return {
      error: `${empleado.nombre} se hizo retiro antes del período: no le corresponde esta nómina.`,
      ok: null,
    };
  }

  const contrato = await contratoVigente(empleadoId, periodo.fechaHasta);
  if (!contrato) {
    return { error: "El empleado no tiene contrato vigente para el período.", ok: null };
  }

  const { filas, mapa } = await parametrosDelPeriodo(periodo.fechaDesde, periodo.fechaHasta);
  if (Object.keys(mapa).length === 0) {
    return {
      error: "No hay parámetros laborales sembrados: corre «npm run db:nomina» para instalarlos.",
      ok: null,
    };
  }

  // Jornadas del período (fecha ≤ hasta; una que cruza medianoche hasta el
  // día siguiente SIGUE perteneciendo al día de ENTRADA).
  const jornadas = await db.jornadaLaboral.findMany({
    where: {
      empleadoId,
      fecha: { gte: periodo.fechaDesde, lte: periodo.fechaHasta },
    },
    orderBy: { fecha: "asc" },
  });

  // Novedades APROBADAS del período que TODAVÍA no se contaron
  const novedades = await db.novedadNomina.findMany({
    where: {
      empleadoId,
      estado: "APROBADA",
      liquidacionId: null,
      fecha: { gte: periodo.fechaDesde, lte: periodo.fechaHasta },
    },
    orderBy: { fecha: "asc" },
  });

  const jornadasResumen: JornadaResumen[] = jornadas.map((j) => ({
    fecha: j.fecha,
    minutosOrdinarios: j.minutosOrdinarios,
    minutosNocturnos: j.minutosNocturnos,
    minutosFestivos: j.minutosFestivos,
    minutosExtraDiurnas: j.minutosExtraDiurnas,
    minutosExtraNocturnas: j.minutosExtraNocturnas,
    minutosExtraFestivasDiurnas: j.minutosExtraFestivasDiurnas,
    minutosExtraFestivasNocturnas: j.minutosExtraFestivasNocturnas,
    minutosTrabajados: j.minutosTrabajados,
  }));
  const novedadesResumen: NovedadResumen[] = novedades.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    fecha: n.fecha,
    dias: n.dias,
    valor: n.valor,
    descripcion: n.descripcion,
  }));

  const calculo = liquidarEmpleado({
    contrato: {
      modalidad: contrato.modalidad,
      remuneracion: contrato.remuneracion,
      salarioMensual: contrato.salarioMensual,
      salarioDiario: contrato.salarioDiario,
      valorHora: contrato.valorHora,
      jornadaSemanalMinutos: contrato.jornadaSemanalMinutos,
      periodicidadPago: contrato.periodicidadPago,
      diaDescanso: contrato.diaDescanso,
      auxilioTransporte: contrato.auxilioTransporte,
      metodoPago: contrato.metodoPago,
      arpClase: empleado.arpClase,
    },
    parametros: mapa,
    jornadas: jornadasResumen,
    novedades: novedadesResumen,
    periodoDesde: periodo.fechaDesde,
    periodoHasta: periodo.fechaHasta,
  });

  // Foto de contrato (de la ContratoVersion, con la clase ARP del empleado)
  const contratoFoto = JSON.stringify({
    modalidad: contrato.modalidad,
    remuneracion: contrato.remuneracion,
    salarioMensual: contrato.salarioMensual,
    salarioDiario: contrato.salarioDiario,
    valorHora: contrato.valorHora,
    jornadaSemanalMinutos: contrato.jornadaSemanalMinutos,
    periodicidadPago: contrato.periodicidadPago,
    diaDescanso: contrato.diaDescanso,
    auxilioTransporte: contrato.auxilioTransporte,
    metodoPago: contrato.metodoPago,
    arpClase: empleado.arpClase,
    contratoVersionId: contrato.id,
    vigenteDesde: contrato.desde.toISOString().slice(0, 10),
  });

  await db.$transaction(async (tx) => {
    const yaExiste = await tx.liquidacionNomina.findUnique({
      where: { periodoId_empleadoId: { periodoId, empleadoId } },
    });
    if (yaExiste) {
      if (yaExiste.estado !== "BORRADOR") {
        throw new Error(
          "La liquidación ya está APROBADA: su foto no se recalcula. Usa un período posterior para ajustes.",
        );
      }
      await tx.liquidacionConcepto.deleteMany({ where: { liquidacionId: yaExiste.id } });
      await tx.liquidacionNomina.delete({ where: { id: yaExiste.id } });
    }

    const liquidacion = await tx.liquidacionNomina.create({
      data: {
        periodoId,
        empleadoId,
        estado: "BORRADOR",
        diasTrabajados: calculo.diasTrabajados,
        contratoFoto,
        parametrosFoto: fotoParametros(filas),
        novedadesFoto: JSON.stringify(
          novedadesResumen.map((n) => ({
            id: n.id,
            tipo: n.tipo,
            fecha: n.fecha,
            dias: n.dias,
            valor: n.valor,
            descripcion: n.descripcion,
          })),
        ),
        salarioBase: calculo.salarioBase,
        horasExtraRecargos: calculo.horasExtrasRecargos,
        comisionesBonos: calculo.comisionesBonos,
        auxilioTransporte: calculo.auxilioTransporte,
        otrosDevengados: calculo.otrosDevengados,
        totalDevengado: calculo.totalDevengado,
        deduccionSalud: calculo.deduccionSalud,
        deduccionPension: calculo.deduccionPension,
        otrosDescuentos: calculo.otrosDescuentos,
        totalDeducciones: calculo.totalDeducciones,
        netoAPagar: calculo.netoAPagar,
        empresaSalud: calculo.empresaSalud,
        empresaPension: calculo.empresaPension,
        empresaRiesgos: calculo.empresaRiesgos,
        empresaCaja: calculo.empresaCaja,
        costoEmpleador: calculo.costoEmpleador,
        prestacionPrima: calculo.prestacionPrima,
        prestacionCesantias: calculo.prestacionCesantias,
        prestacionIntereses: calculo.prestacionIntereses,
        prestacionVacaciones: calculo.prestacionVacaciones,
        estadoPago: "PENDIENTE",
        creadoById: sesion.id,
        notas: calculo.notasCalculo.join(" · ") || null,
      },
    });

    await tx.liquidacionConcepto.createMany({
      data: calculo.conceptos.map((c) => ({
        liquidacionId: liquidacion.id,
        tipo: c.tipo,
        clave: c.clave,
        etiqueta: c.etiqueta,
        valor: c.valor,
        detalle: c.detalle,
      })),
    });

    // Marca de no-duplicidad: estas novedades ya quedaron contadas aquí
    if (novedades.length > 0) {
      await tx.novedadNomina.updateMany({
        where: { id: { in: novedades.map((n) => n.id) } },
        data: { liquidacionId: liquidacion.id },
      });
    }
  });

  revalidar();
  return {
    ok: `Liquidación de ${empleado.nombre} ${empleado.apellidos} generada (borrador).`,
    error: null,
  };
}

/** Aprobar la liquidación: congelación formal de la foto. */
export async function aprobarLiquidacion(
  _antes: EstadoAccionPeriodo,
  form: FormData,
): Promise<EstadoAccionPeriodo> {
  const sesion = await exigirAdmin();
  const liquidacionId = entero(form.get("liquidacionId"));
  if (!liquidacionId) return { error: "Falta la liquidación.", ok: null };

  const liq = await db.liquidacionNomina.findUnique({
    where: { id: liquidacionId },
    include: { empleado: true, periodo: true },
  });
  if (!liq) return { error: "La liquidación no existe.", ok: null };
  if (liq.periodo.estado === "CERRADO") {
    return { error: "El período ya está cerrado.", ok: null };
  }
  if (liq.estado !== "BORRADOR") return { error: "Ya está aprobada.", ok: null };

  await db.liquidacionNomina.update({
    where: { id: liquidacionId },
    data: {
      estado: "APROBADA",
      aprobadoById: sesion.id,
      aprobadoAt: new Date(),
    },
  });

  revalidar();
  return {
    ok: `Liquidación de ${liq.empleado.nombre} aprobada (${liq.periodo.fechaDesde} → ${liq.periodo.fechaHasta}).`,
    error: null,
  };
}

/** Cerrar el período: exige TODAS las liquidaciones aprobadas. Los valores
 *  históricos quedan intocables (fotos inmutables). */
export async function cerrarPeriodo(
  _antes: EstadoAccionPeriodo,
  form: FormData,
): Promise<EstadoAccionPeriodo> {
  const sesion = await exigirAdmin();
  const periodoId = entero(form.get("periodoId"));
  if (!periodoId) return { error: "Falta el período.", ok: null };

  const liquidaciones = await db.liquidacionNomina.findMany({ where: { periodoId } });
  const sinAprobar = liquidaciones.filter((l) => l.estado !== "APROBADA");
  if (sinAprobar.length > 0) {
    return {
      error: `Faltan ${sinAprobar.length} liquidación(es) por aprobar antes de cerrar el período.`,
      ok: null,
    };
  }

  await db.periodoNomina.update({
    where: { id: periodoId },
    data: {
      estado: "CERRADO",
      cerradoById: sesion.id,
      cerradoAt: new Date(),
    },
  });

  revalidar();
  return { ok: "Período cerrado: sus valores quedan como historia permanente.", error: null };
}

/** Reapertura controlada: se NECESITA motivo, no borra valores (las
 *  liquidaciones APROBADAS regresan a BORRADOR y pueden recalcularse con
 *  auditoría). Solo si aún NO se ha pagado nada. */
export async function abrirPeriodo(
  _antes: EstadoAccionPeriodo,
  form: FormData,
): Promise<EstadoAccionPeriodo> {
  await exigirAdmin();
  const periodoId = entero(form.get("periodoId"));
  const motivo = texto(form.get("motivo"), 200);
  if (!periodoId) return { error: "Falta el período.", ok: null };
  if (!motivo) return { error: "El motivo de la reapertura es obligatorio (auditoría).", ok: null };

  const pagos = await db.pagoNomina.count({ where: { liquidacion: { periodoId } } });
  if (pagos > 0) {
    return {
      error:
        "Este período ya tiene pagos de nómina: no se puede reabrir. Los ajustes van en un período nuevo, no tocando el pasado.",
      ok: null,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.periodoNomina.update({
      where: { id: periodoId },
      data: {
        estado: "ABIERTO",
        cerradoById: null,
        cerradoAt: null,
      },
    });
    // Las aprobadas regresan a borrador (se pueden recalcular con auditoría)
    await tx.liquidacionNomina.updateMany({
      where: { periodoId },
      data: { estado: "BORRADOR", aprobadoById: null, aprobadoAt: null },
    });
  });

  revalidar();
  return { ok: "Período reabierto con auditoría (motivo registrado).", error: null };
}
