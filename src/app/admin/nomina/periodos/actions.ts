"use server";

// ═════════ Acciones de períodos y liquidaciones ═════════
// • Los cortes del restaurante y los períodos históricos no se superponen.
// • Liquidar un empleado crea (o refresca, solo en BORRADOR) su fila con
//   FOTO de contrato, parámetros y conceptos: el cálculo queda congelado.
// • Aprobar cierra el asunto individual; CERRADO amerita que TODAS estén
//   aprobadas. Una liquidación APROBADA nunca se recalcula (foto sagrada).
// • Una nómina pendiente NO toca la caja: los egresos nacen SOLO del pago.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import { fechaNominaValida } from "@/lib/nomina/resumen";
import { fotoParametros } from "@/lib/nomina/parametros";
import {
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

/** Crear ciclo/período (QUINCENAL 1|2, MENSUAL o CICLOS corte 1–4).
 *  Sin solapamientos con otro. */
export async function crearPeriodo(
  _antes: EstadoAccionPeriodo,
  form: FormData,
): Promise<EstadoAccionPeriodo> {
  const sesion = await exigirAdmin();
  const tipoRaw = texto(form.get("tipo"), 20);
  const tipo = tipoRaw === "MENSUAL" || tipoRaw === "CICLOS" ? tipoRaw : "QUINCENAL";
  const anio = entero(form.get("anio"));
  const mes = entero(form.get("mes"));
  // El mismo campo sirve de quincena (1|2) o de corte del ciclo (1–4)
  let parte = entero(form.get("corte")) ?? (texto(form.get("quincena"), 10) === "2" ? 2 : 1);
  if (tipo === "QUINCENAL" && parte !== 2) parte = 1;
  if (tipo === "CICLOS" && (parte < 1 || parte > 4)) parte = 1;
  if (!anio || !mes || mes < 1 || mes > 12) {
    return { error: "Elige un mes y año válidos.", ok: null };
  }
  const rango = rangoDePeriodo(tipo, anio, mes, parte as 1 | 2 | 3 | 4);
  if (!rango) return { error: "Rango de ciclo inválido.", ok: null };

  const fechaPagoPrevista = texto(form.get("fechaPagoPrevista"), 10);
  if (fechaPagoPrevista && !fechaNominaValida(fechaPagoPrevista)) {
    return { error: "La fecha prevista de pago no es válida.", ok: null };
  }
  try {
    const conflicto = await db.$transaction(async tx => {
      const solapa = await tx.periodoNomina.findFirst({ where: {
        fechaHasta: { gte: rango.desde }, fechaDesde: { lte: rango.hasta },
      } });
      if (solapa) return `Ya existe un período (${solapa.fechaDesde} → ${solapa.fechaHasta}) que se cruza con ese rango.`;
      await tx.periodoNomina.create({ data: {
        fechaDesde: rango.desde, fechaHasta: rango.hasta,
        fechaPagoPrevista: fechaPagoPrevista || rango.hasta,
        tipo, estado: "ABIERTO", creadoById: sesion.id,
      } });
      return null;
    });
    if (conflicto) return { error: conflicto, ok: null };
  } catch (error) {
    const codigo = (error as { code?: string }).code;
    if (["P2002", "P2034", "P1008", "P2028"].includes(codigo ?? "")) return { error: "Otro proceso está creando un ciclo. Actualiza la página y vuelve a revisar el rango.", ok: null };
    throw error;
  }

  revalidar();
  return { ok: `Ciclo ${rango.desde} → ${rango.hasta} creado (abierto).`, error: null };
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
  const anterior = await db.liquidacionNomina.findUnique({
    where: { periodoId_empleadoId: { periodoId, empleadoId } },
  });
  if (anterior && anterior.estado !== "BORRADOR") {
    return { error: "La liquidación ya está aprobada y no se recalcula.", ok: null };
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
      OR: [{ liquidacionId: null }, ...(anterior ? [{ liquidacionId: anterior.id }] : [])],
      fecha: { gte: periodo.fechaDesde, lte: periodo.fechaHasta },
    },
    orderBy: { fecha: "asc" },
  });

  // Vales AUTORIZADOS aún SIN descontar: los asignados a ESTE ciclo, más
  // los sin ciclo cuya fecha cae dentro del rango (nunca se cuentan dos
  // veces: al quedar DESCONTADOS guardan su liquidacionId).
  const vales = await db.valeNomina.findMany({
    where: {
      empleadoId,
      OR: [
        { estado: "AUTORIZADO", liquidacionId: null, OR: [
          { cicloId: periodoId },
          { cicloId: null, fecha: { gte: periodo.fechaDesde, lte: periodo.fechaHasta } },
        ] },
        ...(anterior ? [{ estado: "DESCONTADO", liquidacionId: anterior.id }] : []),
      ],
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

  // ── Vales a cuenta del sueldo ──
  // LABORAL: entran al liquidador como descuentos (el neto sale ya restado).
  // INDEPENDIENTE: honorarios puros, el liquidador no tiene deducciones;
  // aquí se ajustan los totales a mano (mismo resultado, sin tocar el cálculo).
  const esLaboral = contrato.modalidad === "LABORAL";
  const valesResumen = vales.map((v) => ({
    id: v.id,
    productoNombre: v.productoNombre,
    cantidad: v.cantidad,
    total: v.total,
  }));
  let valesAjuste = 0; // solo INDEPENDIENTE (en LABORAL ya los cuenta el calculo)
  if (esLaboral) {
    for (const v of valesResumen) {
      novedadesResumen.push({
        id: 0,
        tipo: "DESCUENTO",
        fecha: "",
        dias: null,
        valor: v.total,
        descripcion: `Vale: ${v.productoNombre} ×${v.cantidad}`,
      });
    }
  } else {
    valesAjuste = valesResumen.reduce((s, v) => s + v.total, 0);
  }

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
    periodoTipo: periodo.tipo,
  });

  // LABORAL: los vales ya restan en el cálculo. INDEPENDIENTE: honorarios
  // puros (el liquidador no tiene deducciones) → se ajustan a mano aquí.
  const calculoFinal = esLaboral
    ? calculo
    : {
        ...calculo,
        otrosDescuentos: calculo.otrosDescuentos + valesAjuste,
        totalDeducciones: calculo.totalDeducciones + valesAjuste,
        netoAPagar: calculo.netoAPagar - valesAjuste,
      };
  if (calculoFinal.netoAPagar < 0) {
    return { error: "Los descuentos superan el neto disponible. Revisa vales y novedades antes de liquidar.", ok: null };
  }

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
      // Desmarcar novedades y vales apuntados a ESTE borrador (va a ser
      // borrado): quedan disponibles para el recálculo, sin perder dinero.
      await tx.novedadNomina.updateMany({
        where: { liquidacionId: yaExiste.id },
        data: { liquidacionId: null },
      });
      await tx.valeNomina.updateMany({
        where: { liquidacionId: yaExiste.id },
        data: { liquidacionId: null, estado: "AUTORIZADO" },
      });
      await tx.liquidacionConcepto.deleteMany({ where: { liquidacionId: yaExiste.id } });
      await tx.liquidacionNomina.delete({ where: { id: yaExiste.id } });
    }

    const liquidacion = await tx.liquidacionNomina.create({
      data: {
        periodoId,
        empleadoId,
        estado: "BORRADOR",
        diasTrabajados: calculoFinal.diasTrabajados,
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
        salarioBase: calculoFinal.salarioBase,
        horasExtraRecargos: calculoFinal.horasExtrasRecargos,
        comisionesBonos: calculoFinal.comisionesBonos,
        auxilioTransporte: calculoFinal.auxilioTransporte,
        otrosDevengados: calculoFinal.otrosDevengados,
        totalDevengado: calculoFinal.totalDevengado,
        deduccionSalud: calculoFinal.deduccionSalud,
        deduccionPension: calculoFinal.deduccionPension,
        otrosDescuentos: calculoFinal.otrosDescuentos,
        totalDeducciones: calculoFinal.totalDeducciones,
        netoAPagar: calculoFinal.netoAPagar,
        empresaSalud: calculoFinal.empresaSalud,
        empresaPension: calculoFinal.empresaPension,
        empresaRiesgos: calculoFinal.empresaRiesgos,
        empresaCaja: calculoFinal.empresaCaja,
        costoEmpleador: calculoFinal.costoEmpleador,
        prestacionPrima: calculoFinal.prestacionPrima,
        prestacionCesantias: calculoFinal.prestacionCesantias,
        prestacionIntereses: calculoFinal.prestacionIntereses,
        prestacionVacaciones: calculoFinal.prestacionVacaciones,
        estadoPago: "PENDIENTE",
        creadoById: sesion.id,
        notas: calculoFinal.notasCalculo.join(" · ") || null,
      },
    });

    // Conceptos del liquidador. Los descuentos de vales aparecen con detalle
    // «Vale: …»: se rotulan con su propia etiqueta en el comprobante.
    const conceptosVales = esLaboral
      ? []
      : valesResumen.map((v) => ({
          liquidacionId: liquidacion.id,
          tipo: "DEDUCCION",
          clave: "DESCUENTO",
          etiqueta: "Vale de empleado",
          valor: v.total,
          detalle: `Vale: ${v.productoNombre} ×${v.cantidad}`,
        }));
    await tx.liquidacionConcepto.createMany({
      data: [
        ...calculoFinal.conceptos.map((c) => ({
          liquidacionId: liquidacion.id,
          tipo: c.tipo,
          clave: c.clave,
          etiqueta:
            c.clave === "DESCUENTO" && c.detalle?.startsWith("Vale: ")
              ? "Vale de empleado"
              : c.etiqueta,
          valor: c.valor,
          detalle: c.detalle,
        })),
        ...conceptosVales,
      ],
    });

    // Marca de no-duplicidad: estas novedades ya quedaron contadas aquí
    if (novedades.length > 0) {
      await tx.novedadNomina.updateMany({
        where: { id: { in: novedades.map((n) => n.id) } },
        data: { liquidacionId: liquidacion.id },
      });
    }

    // Los vales pasaron a DESCONTADO: conservan producto, cantidad, precio
    // y autorización; el vínculo a la liquidación evita contarlos dos veces.
    if (vales.length > 0) {
      await tx.valeNomina.updateMany({
        where: { id: { in: vales.map((v) => v.id) } },
        data: { estado: "DESCONTADO", liquidacionId: liquidacion.id, cicloId: periodoId },
      });
    }
  });

  revalidar();
  return {
    ok: `Liquidación de ${empleado.nombre} ${empleado.apellidos} generada (borrador)${
      vales.length > 0 ? ` · ${vales.length} vale(s) descontado(s)` : ""
    }.`,
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
