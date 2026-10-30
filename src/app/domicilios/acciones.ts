"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ESTADOS_ACTIVOS_PEDIDO } from "@/lib/pedido";
import { precioUnitarioItem } from "@/lib/precios";
import { ES_METODO_PAGO, ESTADO_DOMICILIO, ESTADO_PEDIDO } from "@/lib/roles";
import { exigirActor, type Sesion } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionDomiciliario = { error: string | null; ok: string | null };

type DomicilioConPedido = Prisma.DomicilioGetPayload<{
  include: {
    pedido: {
      include: { items: { include: { producto: { select: { precio: true } } } } };
    };
  };
}>;

function revalidar() {
  revalidatePath("/domicilios", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/domicilios", "layout");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");
}

/** Trae el domicilio y confirma que quien actúa puede atenderlo */
async function cargarPropio(
  domicilioId: number,
  actor: Sesion,
): Promise<
  { ok: false; error: string } | { ok: true; domicilio: DomicilioConPedido }
> {
  const domicilio = await db.domicilio.findUnique({
    where: { id: domicilioId },
    include: {
      pedido: {
        include: { items: { include: { producto: { select: { precio: true } } } } },
      },
    },
  });
  if (!domicilio) {
    return { ok: false, error: "Ese domicilio ya no existe." };
  }
  if (actor.rol === "DOMICILIARIO" && domicilio.domiciliarioId !== actor.id) {
    return { ok: false, error: "Ese domicilio no está asignado a ti." };
  }
  return { ok: true, domicilio };
}

/** El repartidor sale a la calle: ASIGNADO → EN_CAMINO */
export async function salirDomicilio(
  _previa: EstadoAccionDomiciliario,
  datos: FormData,
): Promise<EstadoAccionDomiciliario> {
  let actor: Sesion;
  try {
    actor = await exigirActor(["DOMICILIARIO", "ADMIN"]);
  } catch {
    return { error: "No autorizado.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(id)) return { error: "Domicilio inválido.", ok: null };

  const res = await cargarPropio(id, actor);
  if (!res.ok) return { error: res.error, ok: null };
  if (res.domicilio.estado !== ESTADO_DOMICILIO.ASIGNADO) {
    return { error: "Ese domicilio ya no está pendiente de salida.", ok: null };
  }

  await db.domicilio.update({
    where: { id },
    data: { estado: ESTADO_DOMICILIO.EN_CAMINO },
  });

  revalidar();
  return { error: null, ok: "¡Buen viaje! Domicilio en camino." };
}

/** El repartidor entrega y cobra contra entrega: EN_CAMINO → ENTREGADO */
export async function entregarDomicilio(
  _previa: EstadoAccionDomiciliario,
  datos: FormData,
): Promise<EstadoAccionDomiciliario> {
  let actor: Sesion;
  try {
    actor = await exigirActor(["DOMICILIARIO", "ADMIN"]);
  } catch {
    return { error: "No autorizado.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(id)) return { error: "Domicilio inválido.", ok: null };

  const metodo = String(datos.get("metodo") ?? "");
  if (!ES_METODO_PAGO(metodo)) {
    return { error: "Elige cómo te pagó el cliente.", ok: null };
  }

  const res = await cargarPropio(id, actor);
  if (!res.ok) return { error: res.error, ok: null };
  const { domicilio } = res;
  if (domicilio.estado !== ESTADO_DOMICILIO.EN_CAMINO) {
    return { error: "Ese domicilio no está en camino.", ok: null };
  }
  if (!(ESTADOS_ACTIVOS_PEDIDO as string[]).includes(domicilio.pedido.estado)) {
    return { error: "Esa comanda ya fue cerrada.", ok: null };
  }

  const total = domicilio.pedido.items.reduce(
    (suma, item) => suma + precioUnitarioItem(item) * item.cantidad,
    0,
  );

  await db.$transaction(async (tx) => {
    await tx.pago.create({
      data: { pedidoId: domicilio.pedidoId, total, propina: 0, metodo },
    });
    await tx.pedido.update({
      where: { id: domicilio.pedidoId },
      data: { estado: ESTADO_PEDIDO.COBRADO },
    });
    await tx.domicilio.update({
      where: { id },
      data: {
        estado: ESTADO_DOMICILIO.ENTREGADO,
        cobradoMonto: total,
        cobradoMetodo: metodo,
        entregadoAt: new Date(),
      },
    });
  });

  revalidar();
  return { error: null, ok: `Entregado y cobrado (${metodo.toLowerCase()}).` };
}

/** No se pudo entregar: EN_CAMINO → NO_ENTREGADO (queda el motivo) */
export async function fallarDomicilio(
  _previa: EstadoAccionDomiciliario,
  datos: FormData,
): Promise<EstadoAccionDomiciliario> {
  let actor: Sesion;
  try {
    actor = await exigirActor(["DOMICILIARIO", "ADMIN"]);
  } catch {
    return { error: "No autorizado.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(id)) return { error: "Domicilio inválido.", ok: null };

  const motivo = String(datos.get("motivo") ?? "").trim().slice(0, 140);
  if (motivo.length < 3) {
    return { error: "Cuéntanos qué pasó (ej: nadie contestó).", ok: null };
  }

  const res = await cargarPropio(id, actor);
  if (!res.ok) return { error: res.error, ok: null };
  if (res.domicilio.estado !== ESTADO_DOMICILIO.EN_CAMINO) {
    return { error: "Ese domicilio no está en camino.", ok: null };
  }

  await db.$transaction(async (tx) => {
    await tx.domicilio.update({
      where: { id },
      data: { estado: ESTADO_DOMICILIO.NO_ENTREGADO, notaEntrega: motivo },
    });
    // La comida ya se preparó: no vuelve al menú, solo se cierra la comanda
    await tx.pedido.update({
      where: { id: res.domicilio.pedidoId },
      data: { estado: ESTADO_PEDIDO.CANCELADO },
    });
  });

  revalidar();
  return { error: null, ok: "Domicilio marcado como no entregado." };
}
