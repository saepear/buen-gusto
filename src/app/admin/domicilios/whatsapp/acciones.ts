"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import {
  borradorDeMensaje,
  alternarBanderaAuto,
} from "./contexto";
import { cargaDeBorrador, crearDomiciliosDeBorrador, type ContactoDomicilio } from "./crear";
import { BANDEJA_VACIA, type EstadoBandeja } from "./estado";
import type { BorradorParseado, LineaExtra, LineaMenu } from "./parser";

/** Resultado de entender un mensaje: o error o el borrador listo para revisar */
export type EstadoAnalisis = {
  error: string | null;
  ok: string | null;
  borrador: BorradorParseado | null;
  /** Si el borrador viene de una entrada de la bandeja (para marcarla al crear) */
  entradaId: number | null;
};

const VACIO: EstadoAnalisis = { error: null, ok: null, borrador: null, entradaId: null };

function revalidarDomicilios() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ordenes", "layout");
  revalidatePath("/domicilios", "layout");
  revalidatePath("/admin/domicilios/whatsapp", "layout");
  realtime.broadcast("update");
}

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Qué pidió el mensaje pegado a mano: el borrador armado contra el menú de HOY */
export async function analizarMensaje(
  _previa: EstadoAnalisis,
  datos: FormData,
): Promise<EstadoAnalisis> {
  try {
    await exigirAdmin();
  } catch {
    return { ...VACIO, error: "Solo el administrador puede usar la bandeja." };
  }

  const mensaje = texto(datos.get("mensaje"), 600);
  if (mensaje.length < 4) {
    return { ...VACIO, error: "Pega el mensaje de WhatsApp (o al menos lo del pedido)." };
  }

  const borrador = await borradorDeMensaje(mensaje);

  return {
    error: null,
    ok: borrador.armable
      ? "Esto entendí del mensaje: revisa el borrador y confirma."
      : "No pude armar el plato del mensaje: revisa las notas y ábrelo a mano.",
    borrador,
    entradaId: null,
  };
}

/**
 * Pasa una entrada de la bandeja al borrador de confirmación: reparsea el
 * texto fresco contra el menú de HOY (por si el menú cambió desde que llegó).
 */
export async function convertirEntrada(
  _previa: EstadoAnalisis,
  datos: FormData,
): Promise<EstadoAnalisis> {
  try {
    await exigirAdmin();
  } catch {
    return { ...VACIO, error: "Solo el administrador puede usar la bandeja." };
  }

  const id = Number.parseInt(String(datos.get("entradaId") ?? ""), 10);
  if (!Number.isInteger(id)) return { ...VACIO, error: "Entrada inválida." };

  const entrada = await db.entradaWhatsapp.findUnique({ where: { id } });
  if (!entrada) return { ...VACIO, error: "Esa entrada ya no existe." };
  if (entrada.estado !== "NUEVO") {
    return { ...VACIO, error: "Esa entrada ya no está pendiente." };
  }

  const borrador = await borradorDeMensaje(entrada.texto);
  borrador.cliente = entrada.remitente || borrador.cliente;
  // El número real del cliente (el que le escribe) vale más que el que
  // quizá dejó dicho en el mensaje: prefiere el del puente si lo hay
  borrador.telefono = entrada.telefono || borrador.telefono;

  return {
    error: null,
    ok: borrador.armable
      ? "Revisa el borrador y confirma para crear el domicilio."
      : "No se pudo armar el plato: revisa las notas o abre el domicilio a mano.",
    borrador,
    entradaId: entrada.id,
  };
}

/** Descarta una entrada pendiente (mensaje sin pedido, saludos, spam…) */
export async function descartarEntrada(
  _previa: EstadoBandeja,
  datos: FormData,
): Promise<EstadoBandeja> {
  try {
    await exigirAdmin();
  } catch {
    return { ...BANDEJA_VACIA, error: "Solo el administrador puede usar la bandeja." };
  }

  const id = Number.parseInt(String(datos.get("entradaId") ?? ""), 10);
  if (!Number.isInteger(id)) return { ...BANDEJA_VACIA, error: "Entrada inválida." };

  const entrada = await db.entradaWhatsapp.findUnique({
    where: { id },
    select: { estado: true },
  });
  if (!entrada) return { ...BANDEJA_VACIA, error: "Esa entrada ya no existe." };
  if (entrada.estado !== "NUEVO") {
    return { ...BANDEJA_VACIA, error: "Esa entrada ya no está pendiente." };
  }

  await db.entradaWhatsapp.update({ where: { id }, data: { estado: "DESCARTADO" } });
  revalidarDomicilios();
  return { ...BANDEJA_VACIA, ok: "Entrada descartada." };
}

/** Enciende/apaga el auto-registro: crear el domicilio en cuanto el mensaje arma */
export async function alternarAutoRegistrar(
  _previa: EstadoBandeja,
  _datos: FormData,
): Promise<EstadoBandeja> {
  try {
    await exigirAdmin();
  } catch {
    return { ...BANDEJA_VACIA, error: "Solo el administrador puede cambiar esto." };
  }
  const auto = await alternarBanderaAuto();
  revalidarDomicilios();
  return {
    error: null,
    ok: auto
      ? "Auto-registro encendido: los mensajes que se entienden se convierten solos."
      : "Auto-registro apagado: cada mensaje queda pendiente de tu confirmación.",
    auto,
  };
}

/** Píldoras del plato dentro de la carga del borrador (+notas hora, para sobrevivir a un error) */
type CargaBorrador = {
  cantidad: number;
  conSopa: boolean;
  proteina: LineaMenu | null;
  principios: LineaMenu[];
  ensaladas: LineaMenu[];
  sopa: LineaMenu | null;
  extras: LineaExtra[];
  notas: string[];
  hora?: string | null;
};

const esCargaBorrador = (x: unknown): x is CargaBorrador => {
  if (typeof x !== "object" || x === null) return false;
  const b = x as Record<string, unknown>;
  return (
    typeof b.cantidad === "number" &&
    typeof b.conSopa === "boolean" &&
    Array.isArray(b.principios) &&
    Array.isArray(b.ensaladas) &&
    Array.isArray(b.extras) &&
    Array.isArray(b.notas)
  );
};

/** Al fallar: reconstruye el borrador fiel (plato + contacto y hora tecleados + notas) */
async function borradorDeRetorno(
  base: CargaBorrador,
  datos: FormData,
): Promise<BorradorParseado> {
  const cliente = texto(datos.get("cliente"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  const direccion = texto(datos.get("direccion"), 120);
  const barrio = texto(datos.get("barrio"), 60) || null;
  const referencia = texto(datos.get("referencia"), 120) || null;
  const hora = texto(datos.get("horaEntrega"), 40) || base.hora || "";
  const entradaId = Number.parseInt(String(datos.get("entradaId") ?? ""), 10);
  return {
    cantidad: base.cantidad,
    conSopa: base.conSopa,
    armable: base.proteina !== null,
    proteina: base.proteina,
    principios: base.principios,
    ensaladas: base.ensaladas,
    sopa: base.sopa,
    hora: hora || null,
    extras: base.extras,
    cliente,
    telefono,
    direccion,
    barrio: barrio ?? "",
    referencia: referencia ?? "",
    telefonoDelMensaje: false,
    notas: base.notas ?? [],
  };
}

const contactoDe = (datos: FormData, base: CargaBorrador): ContactoDomicilio => {
  const cliente = texto(datos.get("cliente"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  const direccion = texto(datos.get("direccion"), 120);
  const barrio = texto(datos.get("barrio"), 60) || null;
  const referencia = texto(datos.get("referencia"), 120) || null;
  const observaciones = texto(datos.get("observaciones"), 140) || null;
  const horaEntrega = texto(datos.get("horaEntrega"), 40) || base.hora || null;
  return {
    // Los clientes sin contacto quedan genéricos pero nítidos en el tablero
    cliente: cliente || "Cliente WhatsApp",
    telefono,
    direccion,
    barrio,
    referencia,
    horaEntrega,
    observaciones,
  };
};

/** Marca la entrada de la bandeja como convertida (si existe y sigue pendiente) */
async function marcarConvertida(entradaId: number | null, pedidoId: number | null) {
  if (entradaId === null) return;
  const entrada = await db.entradaWhatsapp.findUnique({
    where: { id: entradaId },
    select: { estado: true },
  });
  if (!entrada || entrada.estado !== "NUEVO") return;
  await db.entradaWhatsapp.update({
    where: { id: entradaId },
    data: { estado: "CONVERTIDO", pedidoId },
  });
}

/**
 * Confirma el borrador (pegado a mano o de una entrada de la bandeja):
 * crea N comandas idénticas sobre la mesa virtual de domicilios y sus filas
 * de entrega. Si a mitad del lote se agota algo, reporta cuántos quedaron
 * creados para no perder la cuenta.
 */
export async function crearDomiciliosDesdeBorrador(
  _previa: EstadoAnalisis,
  datos: FormData,
): Promise<EstadoAnalisis> {
  try {
    await exigirAdmin();
  } catch {
    return { ...VACIO, error: "Solo el administrador puede registrar domicilios." };
  }

  let base: CargaBorrador | null = null;
  try {
    base = JSON.parse(String(datos.get("borrador") ?? "")) as CargaBorrador;
  } catch {
    base = null;
  }
  if (!base || !esCargaBorrador(base) || !base.proteina) {
    return {
      ...VACIO,
      error: "El borrador se dañó o no tiene proteína: analiza el mensaje otra vez.",
    };
  }

  const entradaIdCrudo = String(datos.get("entradaId") ?? "").trim();
  const entradaId = /^\d+$/.test(entradaIdCrudo) ? Number.parseInt(entradaIdCrudo, 10) : null;

  const borrador = await borradorDeRetorno(base, datos);
  const contacto = contactoDe(datos, base);

  const resultado = await crearDomiciliosDeBorrador(cargaDeBorrador(borrador), contacto);

  if (resultado.creados === 0) {
    return {
      error: resultado.error ?? "No se pudo crear el domicilio. Intenta otra vez.",
      ok: null,
      borrador,
      entradaId,
    };
  }

  // La entrada de la bandeja queda convertida y enlazada a la comanda
  await marcarConvertida(entradaId, resultado.pedidoIds[0] ?? null);

  if (resultado.error) {
    // Lote a medias: la bandeja refresca y el mensaje cuenta lo ocurrido
    revalidarDomicilios();
    return {
      error: null,
      ok: `Se crearon ${resultado.creados}: ${resultado.error} El resto está en el tablero para repetir.`,
      borrador: null,
      entradaId: null,
    };
  }

  revalidarDomicilios();
  // El nuevo domicilio salta al tablero para asignar repartidor ahí mismo
  redirect("/admin/domicilios");
}
