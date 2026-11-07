"use server";

// ═════════ Acciones del personal (Nómina) ═════════
// • El empleado NUNCA se borra: desactivar conserva historial financiero.
// • El salario se cambia NACIENDO una ContratoVersion: las liquidaciones
//   anteriores guardan su foto, así que el pasado no se modifica.
// • Todo con exigirAdmin y transacciones.

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { exigirAdmin } from "@/lib/session";
import { aplicaAuxilioTransporte, parametrosDelPeriodo, hoy } from "@/lib/nomina/helpers";

export type EstadoAccionPersona = { error: string | null; ok: string | null };

const TIPO_DOCUMENTO = ["CC", "CE", "TI", "PE", "OTRO"] as const;

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const entero = (v: unknown): number | null => {
  const limpio = String(v ?? "").replace(/[^0-9]/g, "");
  if (limpio === "") return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isInteger(n) ? n : null;
};
/** yyyy-mm-dd válido */
const fechaISO = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

function revalidar() {
  revalidatePath("/admin/nomina", "layout");
}

/** Contrato inicial SIEMPRE nace una versión (historial desde el día 1) */
async function crearVersionInicialTx(
  tx: Prisma.TransactionClient,
  empleadoId: number,
  datos: DatosContrato,
  usuarioId: number,
  desde: string,
) {
  await tx.contratoVersion.create({
    data: {
      empleadoId,
      desde: new Date(`${desde}T12:00:00.000Z`),
      hasta: null,
      modalidad: datos.modalidad,
      remuneracion: datos.remuneracion,
      salarioMensual: datos.salarioMensual,
      salarioDiario: datos.salarioDiario,
      valorHora: datos.valorHora,
      jornadaSemanalMinutos: datos.jornadaSemanalMinutos,
      periodicidadPago: datos.periodicidadPago,
      diaDescanso: datos.diaDescanso,
      auxilioTransporte: datos.auxilioTransporte,
      metodoPago: datos.metodoPago,
      motivo: "Contrato inicial al registrar el empleado",
      creadoById: usuarioId,
    },
  });
}

type DatosContrato = {
  modalidad: string;
  remuneracion: string;
  salarioMensual: number;
  salarioDiario: number;
  valorHora: number;
  jornadaSemanalMinutos: number;
  periodicidadPago: string;
  diaDescanso: number;
  auxilioTransporte: boolean;
  metodoPago: string;
};

function datosContratoDeFormulario(
  form: FormData,
): { datos: DatosContrato; remuneracionValida: boolean } {
  const modalidad = ["LABORAL", "INDEPENDIENTE"].includes(texto(form.get("modalidad"), 20))
    ? texto(form.get("modalidad"), 20)
    : "LABORAL";
  const remuneracion = ["MENSUAL", "DIARIO", "HORARIO"].includes(texto(form.get("remuneracion"), 20))
    ? texto(form.get("remuneracion"), 20)
    : "MENSUAL";
  const jornada = entero(form.get("jornadaSemanalMinutos")) ?? 2640;
  const datos: DatosContrato = {
    modalidad,
    remuneracion,
    salarioMensual: Math.max(entero(form.get("salarioMensual")) ?? 0, 0),
    salarioDiario: Math.max(entero(form.get("salarioDiario")) ?? 0, 0),
    valorHora: Math.max(entero(form.get("valorHora")) ?? 0, 0),
    jornadaSemanalMinutos: Math.min(Math.max(jornada, 120), 4800),
    periodicidadPago: ["QUINCENAL", "MENSUAL", "CICLOS"].includes(texto(form.get("periodicidadPago"), 20))
      ? texto(form.get("periodicidadPago"), 20)
      : "QUINCENAL",
    diaDescanso: Math.min(Math.max(entero(form.get("diaDescanso")) ?? 0, 0), 6),
    auxilioTransporte: form.get("auxilioTransporte") === "on",
    metodoPago: ["EFECTIVO", "TRANSFERENCIA", "OTRO"].includes(texto(form.get("metodoPago"), 20))
      ? texto(form.get("metodoPago"), 20)
      : "EFECTIVO",
  };
  return { datos, remuneracionValida: true };
}

/** Crear empleado + contrato inicial en transacción */
export async function crearEmpleado(
  _antes: EstadoAccionPersona,
  form: FormData,
): Promise<EstadoAccionPersona> {
  const sesion = await exigirAdmin();
  const nombre = texto(form.get("nombre"), 60);
  const apellidos = texto(form.get("apellidos"), 60);
  const documentoTipo = TIPO_DOCUMENTO.includes(texto(form.get("documentoTipo"), 8) as "CC")
    ? texto(form.get("documentoTipo"), 8)
    : "CC";
  const documentoNumero = texto(form.get("documentoNumero"), 30);
  const cargo = texto(form.get("cargo"), 60);
  const fechaIngreso = fechaISO(form.get("fechaIngreso"));
  if (!nombre || !apellidos || !documentoNumero || !cargo || !fechaIngreso) {
    return { error: "Nombre, apellidos, documento, cargo y fecha de ingreso son obligatorios.", ok: null };
  }

  const empleadoPosee = await db.empleado.findUnique({ where: { documentoNumero } });
  if (empleadoPosee) return { error: `Ya existe un empleado con documento ${documentoNumero}.`, ok: null };

  const { datos } = datosContratoDeFormulario(form);
  // Marca auto del auxilio: salario ≤ 2 SMMLV (según parámetros vigentes hoy)
  const potestad = await parametrosDelPeriodo(hoy(), hoy());
  datos.auxilioTransporte =
    datos.modalidad === "LABORAL" && aplicaAuxilioTransporte(datos.salarioMensual, potestad.mapa);

  const arpClase = Math.min(Math.max(entero(form.get("arpClase")) ?? 2, 1), 6);
  const limiteEntrada = entero(form.get("horaLimiteEntradaMinutos"));

  await db.$transaction(async (tx) => {
    const empleado = await tx.empleado.create({
      data: {
        nombre,
        apellidos,
        documentoTipo,
        documentoNumero,
        telefono: texto(form.get("telefono"), 20) || null,
        direccion: texto(form.get("direccion"), 120) || null,
        cargo,
        fechaIngreso: new Date(`${fechaIngreso}T12:00:00.000Z`),
        estado: "ACTIVO",
        epsNombre: texto(form.get("epsNombre"), 80) || null,
        fondoPensionName: texto(form.get("fondoPensionName"), 80) || null,
        arpClase,
        modalidad: datos.modalidad,
        remuneracion: datos.remuneracion,
        salarioMensual: datos.salarioMensual,
        salarioDiario: datos.salarioDiario,
        valorHora: datos.valorHora,
        jornadaSemanalMinutos: datos.jornadaSemanalMinutos,
        periodicidadPago: datos.periodicidadPago,
        diaDescanso: datos.diaDescanso,
        auxilioTransporte: datos.auxilioTransporte,
        metodoPago: datos.metodoPago,
        horaLimiteEntradaMinutos: limiteEntrada != null && limiteEntrada > 0 ? limiteEntrada : null,
        creadoById: sesion.id,
      },
    });
    await crearVersionInicialTx(tx, empleado.id, datos, sesion.id, fechaIngreso);
  });

  revalidar();
  return { ok: `${nombre} ${apellidos} quedó registrado con su contrato inicial.`, error: null };
}

/** Datos NO contractuales (contacto, cargo, seguridad social, ARP) */
export async function editarEmpleado(
  _antes: EstadoAccionPersona,
  form: FormData,
): Promise<EstadoAccionPersona> {
  await exigirAdmin();
  const empleadoId = entero(form.get("empleadoId"));
  if (!empleadoId) return { error: "Falta el empleado.", ok: null };

  const empleado = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado) return { error: "El empleado no existe.", ok: null };

  await db.$transaction(async (tx) => {
    await tx.empleado.update({
      where: { id: empleadoId },
      data: {
        nombre: texto(form.get("nombre"), 60) || empleado.nombre,
        apellidos: texto(form.get("apellidos"), 60) || empleado.apellidos,
        telefono: texto(form.get("telefono"), 20) || null,
        direccion: texto(form.get("direccion"), 120) || null,
        cargo: texto(form.get("cargo"), 60) || empleado.cargo,
        epsNombre: texto(form.get("epsNombre"), 80) || null,
        fondoPensionName: texto(form.get("fondoPensionName"), 80) || null,
        arpClase: Math.min(Math.max(entero(form.get("arpClase")) ?? empleado.arpClase, 1), 6),
      },
    });
  });

  revalidar();
  return { ok: "Datos del empleado actualizados.", error: null };
}

/**
 * Actualizar CONTRATO: cierra la versión vigente y nace una nueva desde la
 * fecha dada. Las nóminas liquidadas quedan con su foto intacta.
 */
export async function actualizarContrato(
  _antes: EstadoAccionPersona,
  form: FormData,
): Promise<EstadoAccionPersona> {
  const sesion = await exigirAdmin();
  const empleadoId = entero(form.get("empleadoId"));
  const desde = fechaISO(form.get("desde"));
  const motivo = texto(form.get("motivo"), 140);
  if (!empleadoId || !desde || !motivo) {
    return { error: "Faltan la fecha desde la que aplica o el motivo del cambio.", ok: null };
  }

  const empleado = await db.empleado.findUnique({
    where: { id: empleadoId },
    include: { contratoVersiones: { orderBy: { desde: "desc" }, take: 1 } },
  });
  if (!empleado || empleado.contratoVersiones.length === 0) {
    return { error: "El empleado no existe o no tiene contrato.", ok: null };
  }
  const vigente = empleado.contratoVersiones[0];
  if (vigente.hasta) return { error: "El contrato vigente ya está cerrado.", ok: null };

  const { datos } = datosContratoDeFormulario(form);
  if (
    datos.salarioMensual === vigente.salarioMensual &&
    datos.salarioDiario === vigente.salarioDiario &&
    datos.valorHora === vigente.valorHora &&
    datos.modalidad === vigente.modalidad &&
    datos.remuneracion === vigente.remuneracion &&
    datos.jornadaSemanalMinutos === vigente.jornadaSemanalMinutos &&
    datos.diaDescanso === vigente.diaDescanso &&
    datos.auxilioTransporte === vigente.auxilioTransporte &&
    datos.metodoPago === vigente.metodoPago &&
    datos.periodicidadPago === vigente.periodicidadPago
  ) {
    return { error: "El contrato nuevo es igual al vigente: no hay nada que cambiar.", ok: null };
  }

  // Marca auto del auxilio según vigencia a la fecha del cambio
  const potestad = await parametrosDelPeriodo(desde, desde);
  datos.auxilioTransporte =
    datos.modalidad === "LABORAL" && aplicaAuxilioTransporte(datos.salarioMensual, potestad.mapa);

  await db.$transaction(async (tx) => {
    //Cerrar la versión vigente: aplica HASTA el día ANTERIOR al nuevo desde
    const cierre = new Date(`${desde}T12:00:00.000Z`);
    cierre.setDate(cierre.getDate() - 1);
    await tx.contratoVersion.update({
      where: { id: vigente.id },
      data: { hasta: cierre },
    });
    await tx.contratoVersion.create({
      data: {
        empleadoId,
        desde: new Date(`${desde}T12:00:00.000Z`),
        hasta: null,
        modalidad: datos.modalidad,
        remuneracion: datos.remuneracion,
        salarioMensual: datos.salarioMensual,
        salarioDiario: datos.salarioDiario,
        valorHora: datos.valorHora,
        jornadaSemanalMinutos: datos.jornadaSemanalMinutos,
        periodicidadPago: datos.periodicidadPago,
        diaDescanso: datos.diaDescanso,
        auxilioTransporte: datos.auxilioTransporte,
        metodoPago: datos.metodoPago,
        motivo,
        creadoById: sesion.id,
      },
    });
    // Espejo de consulta rápida (las liquidaciones NO leen de aquí: leen su foto)
    await tx.empleado.update({
      where: { id: empleadoId },
      data: {
        modalidad: datos.modalidad,
        remuneracion: datos.remuneracion,
        salarioMensual: datos.salarioMensual,
        salarioDiario: datos.salarioDiario,
        valorHora: datos.valorHora,
        jornadaSemanalMinutos: datos.jornadaSemanalMinutos,
        periodicidadPago: datos.periodicidadPago,
        diaDescanso: datos.diaDescanso,
        auxilioTransporte: datos.auxilioTransporte,
        metodoPago: datos.metodoPago,
      },
    });
  });

  revalidar();
  return { ok: "Contrato actualizado con historial: las nóminas anteriores quedan intactas.", error: null };
}

/** Desactivar (retiro o inactividad): la persona sale de liquidaciones nuevas
 *  y su historial queda completo. Motivo obligatorio (auditoría). */
export async function desactivarEmpleado(
  _antes: EstadoAccionPersona,
  form: FormData,
): Promise<EstadoAccionPersona> {
  await exigirAdmin();
  const empleadoId = entero(form.get("empleadoId"));
  const motivo = texto(form.get("motivo"), 200);
  if (!empleadoId) return { error: "Falta el empleado.", ok: null };
  if (!motivo) return { error: "El motivo es obligatorio (queda registrado para auditoría).", ok: null };
  const fechaRetiro = fechaISO(form.get("fechaRetiro")) ?? hoy();

  const empleado = await db.empleado.findUnique({ where: { id: empleadoId } });
  if (!empleado) return { error: "El empleado no existe.", ok: null };
  if (empleado.estado === "INACTIVO") return { error: "Ya está inactivo.", ok: null };

  await db.$transaction(async (tx) => {
    await tx.empleado.update({
      where: { id: empleadoId },
      data: {
        estado: "INACTIVO",
        estadoMotivo: motivo,
        fechaRetiro: new Date(`${fechaRetiro}T12:00:00.000Z`),
      },
    });
    // Cierra la versión de contrato vigente (si sigue abierta)
    const vigente = await tx.contratoVersion.findFirst({
      where: { empleadoId, hasta: null },
      orderBy: { desde: "desc" },
    });
    if (vigente) {
      const cierre = new Date(`${fechaRetiro}T12:00:00.000Z`);
      void cierre;
      await tx.contratoVersion.update({
        where: { id: vigente.id },
        data: { hasta: new Date(`${fechaRetiro}T12:00:00.000Z`) },
      });
    }
  });

  revalidar();
  return { ok: "Empleado desactivado: conserva todo su historial.", error: null };
}

/** Reactivar sin borrar nada */
export async function activarEmpleado(
  _antes: EstadoAccionPersona,
  form: FormData,
): Promise<EstadoAccionPersona> {
  const sesion = await exigirAdmin();
  const empleadoId = entero(form.get("empleadoId"));
  if (!empleadoId) return { error: "Falta el empleado.", ok: null };
  await db.$transaction(async (tx) => {
    const empleado = await tx.empleado.findUnique({ where: { id: empleadoId } });
    if (!empleado) throw new Error("El empleado no existe.");
    const fecha = claveDia(new Date());
    await tx.empleado.update({
      where: { id: empleadoId },
      data: {
        estado: "ACTIVO",
        estadoMotivo: "Reactivado",
        fechaIngreso:
          empleado.fechaIngreso ?? new Date(`${fecha}T12:00:00.000Z`),
        fechaRetiro: null,
      },
    });
    // Nace versión nueva si no hay abierta (el contrato se reinicia igual
    // salvo que se edite las salarios con «Actualizar contrato»)
    const vigente = await tx.contratoVersion.findFirst({
      where: { empleadoId, hasta: null },
      orderBy: { desde: "desc" },
    });
    if (!vigente) {
      const ultima = await tx.contratoVersion.findFirst({
        where: { empleadoId },
        orderBy: { desde: "desc" },
      });
      if (!ultima) throw new Error("El empleado no tiene versiones de contrato.");
      await tx.contratoVersion.create({
        data: {
          empleadoId,
          desde: new Date(`${fecha}T12:00:00.000Z`),
          hasta: null,
          modalidad: ultima.modalidad,
          remuneracion: ultima.remuneracion,
          salarioMensual: ultima.salarioMensual,
          salarioDiario: ultima.salarioDiario,
          valorHora: ultima.valorHora,
          jornadaSemanalMinutos: ultima.jornadaSemanalMinutos,
          periodicidadPago: ultima.periodicidadPago,
          diaDescanso: ultima.diaDescanso,
          auxilioTransporte: ultima.auxilioTransporte,
          metodoPago: ultima.metodoPago,
          motivo: "Reactivación (contrato reabierto igual)",
          creadoById: sesion.id,
        },
      });
    }
  });
  revalidar();
  return { ok: "Empleado reactivado.", error: null };
}
