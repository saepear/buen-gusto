"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { precioUnitarioItem } from "@/lib/precios";
import { inicioDeHoy, ESTADOS_ACTIVOS_PEDIDO } from "@/lib/pedido";
import {
  ES_METODO_PAGO,
  ESTADO_MESA,
  ESTADO_PEDIDO,
} from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionCaja = { error: string | null };

/** Mensajes de negocio que se muestran tal cual en la caja */
class ErrorDeCaja extends Error {}

const MAX_PROPINA = 1_000_000;

/**
 * Cobre una mesa completa: registra el pago, marca sus comandas como
 * COBRADAS y libera la mesa en una sola transacción.
 */
export async function cobrarMesa(
  _previa: EstadoAccionCaja,
  datos: FormData,
): Promise<EstadoAccionCaja> {
  try {
    const sesion = await exigirAdmin();
    void sesion;
  } catch {
    return { error: "Solo el administrador puede cobrar en la caja." };
  }

  const mesaId = Number.parseInt(String(datos.get("mesaId") ?? ""), 10);
  if (!Number.isInteger(mesaId)) return { error: "Mesa inválida." };

  const metodo = String(datos.get("metodo") ?? "");
  if (!ES_METODO_PAGO(metodo)) {
    return { error: "Elige un método de pago válido." };
  }

  // La propina llega como texto; nos quedamos solo con los dígitos ($1.000 → 1000)
  const propina = Number.parseInt(
    String(datos.get("propina") ?? "").replace(/[^0-9]/g, "") || "0",
    10,
  );
  if (!Number.isInteger(propina) || propina < 0 || propina > MAX_PROPINA) {
    return { error: "La propina ingresada no es válida." };
  }

  let nuevoPagoId: number | null = null;
  try {
    nuevoPagoId = await db.$transaction(async (tx) => {
      const mesa = await tx.mesa.findUnique({
        where: { id: mesaId },
        select: { numero: true, estado: true, activa: true },
      });
      if (!mesa || !mesa.activa) throw new ErrorDeCaja("Esa mesa ya no existe.");
      if (
        mesa.estado !== ESTADO_MESA.OCUPADA &&
        mesa.estado !== ESTADO_MESA.POR_PAGAR
      ) {
        throw new ErrorDeCaja(
          `La mesa #${mesa.numero} ya está libre: no hay nada que cobrar.`,
        );
      }

      // Las comandas activas de HOY son las que se cobran (se revalidan
      // aquí dentro, sin confiar en los datos de la pantalla)
      const pedidos = await tx.pedido.findMany({
        where: {
          mesaId,
          estado: { in: ESTADOS_ACTIVOS_PEDIDO },
          createdAt: { gte: inicioDeHoy() },
        },
        include: {
          items: { include: { producto: { select: { precio: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      if (pedidos.length === 0) {
        throw new ErrorDeCaja(
          `La mesa #${mesa.numero} no tiene comandas activas para cobrar hoy.`,
        );
      }

      // El total de la cuenta usa el precio fijado al ordenar (almuerzo con
      // sopa/bandeja, icopor si va para llevar, y extras); para comandas
      // antiguas (precio null) se usa el precio del catálogo.
      const total = pedidos.reduce(
        (suma, pedido) =>
          suma +
          pedido.items.reduce(
            (x, item) => x + precioUnitarioItem(item) * item.cantidad,
            0,
          ),
        0,
      );

      // Un solo pago por cobro; se ancla a la comanda más reciente del lote
      const ancla = pedidos[pedidos.length - 1];
      if (!ancla) throw new ErrorDeCaja("No se pudo crear el pago.");
      const pago = await tx.pago.create({
        data: {
          pedidoId: ancla.id,
          total,
          propina,
          metodo,
        },
      });

      await tx.pedido.updateMany({
        where: { id: { in: pedidos.map((p) => p.id) } },
        data: { estado: ESTADO_PEDIDO.COBRADO },
      });

      await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: ESTADO_MESA.LIBRE },
      });

      return pago.id;
    });
  } catch (e) {
    if (e instanceof ErrorDeCaja) return { error: e.message };
    return { error: "No se pudo registrar el pago. Intenta otra vez." };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/mesero", "layout");
  revalidatePath("/cocina", "layout");
  realtime.broadcast("update");

  redirect(`/admin/caja/recibo/${nuevoPagoId}`);
}
