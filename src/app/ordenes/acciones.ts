"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { ESTADOS_ACTIVOS_PEDIDO } from "@/lib/pedido";
import { ESTADO_PEDIDO, type EstadoPedido } from "@/lib/roles";
import { exigirActor } from "@/lib/session";
import { realtime } from "@/lib/realtime";

function revalidarComandas() {
  revalidatePath("/ordenes", "layout");
  revalidatePath("/mesero", "layout");
  revalidatePath("/admin", "layout");
  realtime.broadcast("update");
}

const VIVOS: EstadoPedido[] = [
  ESTADO_PEDIDO.ENVIADO,
  ESTADO_PEDIDO.EN_PREPARACION,
  ESTADO_PEDIDO.PARCIAL_SERVIDO,
];

/** El administrador empieza a preparar la comanda */
export async function empezarComanda(datos: FormData): Promise<void> {
  await exigirActor(["ADMIN"]);
  const id = Number.parseInt(String(datos.get("pedidoId") ?? ""), 10);
  if (!Number.isInteger(id)) return;
  const pedido = await db.pedido.findUnique({
    where: { id },
    select: { estado: true },
  });
  if (pedido?.estado !== ESTADO_PEDIDO.ENVIADO) return;
  await db.pedido.update({
    where: { id },
    data: { estado: ESTADO_PEDIDO.EN_PREPARACION },
  });
  revalidarComandas();
}

/** Comanda lista: los platos están servidos en la bandeja */
export async function terminarComanda(datos: FormData): Promise<void> {
  await exigirActor(["ADMIN"]);
  const id = Number.parseInt(String(datos.get("pedidoId") ?? ""), 10);
  if (!Number.isInteger(id)) return;
  const pedido = await db.pedido.findUnique({
    where: { id },
    select: { estado: true },
  });
  if (pedido?.estado !== ESTADO_PEDIDO.EN_PREPARACION) return;
  await db.pedido.update({
    where: { id },
    data: { estado: ESTADO_PEDIDO.SERVIDO },
  });
  revalidarComandas();
}

/** Cancelar una comanda viva: devuelve las porciones al menú del día */
export async function cancelarComanda(datos: FormData): Promise<void> {
  await exigirActor(["ADMIN"]);
  const id = Number.parseInt(String(datos.get("pedidoId") ?? ""), 10);
  if (!Number.isInteger(id)) return;

  const pedido = await db.pedido.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!pedido || !(VIVOS as string[]).includes(pedido.estado)) return;

  await db.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id: pedido.id },
      data: { estado: ESTADO_PEDIDO.CANCELADO },
    });

    // Devolver porciones al menú del DÍA DEL PEDIDO (no al de hoy): la
    // comanda creada anoche y cancelada hoy no debe agravar el menú actual
    const fecha = claveDia(pedido.createdAt);
    for (const item of pedido.items) {
      if (!["PROTEINA", "PRINCIPIO", "ENSALADA", "SOPA"].includes(item.tipo)) continue;
      await tx.$executeRaw`
        UPDATE MenuDiaItem
        SET vendidos = MAX(vendidos - ${item.cantidad}, 0)
        WHERE productoId = ${item.productoId}
          AND menuDiaId = (SELECT id FROM MenuDia WHERE fecha = ${fecha})
      `;
    }

    // Si la mesa quedó sin comandas vivas, regresa a LIBRE
    const vivas = await tx.pedido.count({
      where: {
        mesaId: pedido.mesaId,
        estado: { in: ESTADOS_ACTIVOS_PEDIDO },
      },
    });
    const mesa = await tx.mesa.findUnique({
      where: { id: pedido.mesaId },
      select: { estado: true },
    });
    if (vivas === 0 && mesa && mesa.estado === "OCUPADA") {
      await tx.mesa.update({
        where: { id: pedido.mesaId },
        data: { estado: "LIBRE" },
      });
    }
  });

  revalidarComandas();
}
