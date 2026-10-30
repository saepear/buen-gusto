"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { crearPedido, ErrorDePedido, type CargaPedido } from "@/lib/pedido";
import { ESTADO_DOMICILIO, ESTADO_PEDIDO } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionDomicilio = { error: string | null; ok: string | null };

function revalidarDomicilios() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ordenes", "layout");
  revalidatePath("/domicilios", "layout");
  realtime.broadcast("update");
}

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * El administrador crea un domicilio: una comanda normal sobre la mesa virtual
 * "Domicilios" (para reutilizar stock) más los datos de entrega del cliente.
 */
export async function crearDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede crear domicilios.", ok: null };
  }

  const cliente = texto(datos.get("cliente"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  const direccion = texto(datos.get("direccion"), 120);
  const barrio = texto(datos.get("barrio"), 60) || null;
  const referencia = texto(datos.get("referencia"), 120) || null;

  if (cliente.length < 2) {
    return { error: "Escribe el nombre del cliente.", ok: null };
  }
  if (telefono.replace(/\D/g, "").length < 7) {
    return { error: "Escribe un teléfono de contacto válido.", ok: null };
  }
  if (direccion.length < 5) {
    return { error: "Escribe la dirección de entrega.", ok: null };
  }

  let carga: CargaPedido | null = null;
  try {
    carga = JSON.parse(String(datos.get("datos") ?? "")) as CargaPedido;
  } catch {
    carga = null;
  }
  if (!carga) {
    return {
      error: "Datos del pedido corruptos. Recarga la página e intenta de nuevo.",
      ok: null,
    };
  }
  // Un domicilio siempre sale para llevar: suma el empaque
  carga.llevar = true;

  const mesaVirtual = await db.mesa.findFirst({
    where: { esDomicilio: true },
    select: { id: true },
  });
  if (!mesaVirtual) {
    return {
      error: "No existe la mesa virtual de domicilios. Corre el seed de datos.",
      ok: null,
    };
  }

  const observaciones =
    texto(datos.get("observaciones"), 140) || null;

  let pedidoId: number;
  try {
    pedidoId = await crearPedido({
      mesaId: mesaVirtual.id,
      meseroId: null,
      carga,
      observaciones,
      permitirMesaVirtual: true,
    });
  } catch (e) {
    return {
      error:
        e instanceof ErrorDePedido
          ? e.message
          : "No se pudo crear el domicilio. Intenta otra vez.",
      ok: null,
    };
  }

  await db.domicilio.create({
    data: {
      pedidoId,
      cliente,
      telefono,
      direccion,
      barrio,
      referencia,
      estado: ESTADO_DOMICILIO.PENDIENTE,
    },
  });

  revalidarDomicilios();
  redirect("/admin/domicilios");
}

/** Asigna (o reasigna) un domiciliario a un domicilio pendiente */
export async function asignarDomiciliario(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede asignar domicilios.", ok: null };
  }

  const domicilioId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  const domiciliarioId = Number.parseInt(String(datos.get("domiciliarioId") ?? ""), 10);
  if (!Number.isInteger(domicilioId) || !Number.isInteger(domiciliarioId)) {
    return { error: "Elige un domiciliario.", ok: null };
  }

  const repartidor = await db.usuario.findFirst({
    where: { id: domiciliarioId, rol: "DOMICILIARIO", activo: true },
    select: { nombre: true },
  });
  if (!repartidor) {
    return { error: "Ese domiciliario no está disponible.", ok: null };
  }

  const domicilio = await db.domicilio.findUnique({
    where: { id: domicilioId },
    select: { estado: true },
  });
  if (!domicilio) return { error: "Ese domicilio ya no existe.", ok: null };
  if (
    domicilio.estado !== ESTADO_DOMICILIO.PENDIENTE &&
    domicilio.estado !== ESTADO_DOMICILIO.ASIGNADO
  ) {
    return { error: "Ese domicilio ya no se puede reasignar.", ok: null };
  }

  await db.domicilio.update({
    where: { id: domicilioId },
    data: {
      domiciliarioId,
      estado: ESTADO_DOMICILIO.ASIGNADO,
      asignadoAt: new Date(),
    },
  });

  revalidarDomicilios();
  return { error: null, ok: `Asignado a ${repartidor.nombre}.` };
}

/** Cancela un domicilio que aún no salió: devuelve las porciones al menú */
export async function cancelarDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede cancelar domicilios.", ok: null };
  }

  const domicilioId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(domicilioId)) {
    return { error: "Domicilio inválido.", ok: null };
  }

  const domicilio = await db.domicilio.findUnique({
    where: { id: domicilioId },
    include: { pedido: { include: { items: true } } },
  });
  if (!domicilio) return { error: "Ese domicilio ya no existe.", ok: null };
  if (
    domicilio.estado !== ESTADO_DOMICILIO.PENDIENTE &&
    domicilio.estado !== ESTADO_DOMICILIO.ASIGNADO
  ) {
    return {
      error: "Ese domicilio ya salió a la calle: no se puede cancelar.",
      ok: null,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.domicilio.update({
      where: { id: domicilioId },
      data: { estado: ESTADO_DOMICILIO.CANCELADO },
    });
    await tx.pedido.update({
      where: { id: domicilio.pedidoId },
      data: { estado: ESTADO_PEDIDO.CANCELADO },
    });

    // Devolver porciones al menú de HOY (nunca a otro día)
    const fecha = claveDia(new Date());
    for (const item of domicilio.pedido.items) {
      if (!["PROTEINA", "PRINCIPIO", "ENSALADA", "SOPA"].includes(item.tipo)) continue;
      await tx.$executeRaw`
        UPDATE MenuDiaItem
        SET vendidos = MAX(vendidos - ${item.cantidad}, 0)
        WHERE productoId = ${item.productoId}
          AND menuDiaId = (SELECT id FROM MenuDia WHERE fecha = ${fecha})
      `;
    }
  });

  revalidarDomicilios();
  return { error: null, ok: "Domicilio cancelado y porciones devueltas." };
}
