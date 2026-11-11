"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAnticipo = { error: string | null; ok: string | null };

class ErrorDeAnticipo extends Error {}

function montoDe(valor: unknown) {
  const limpio = String(valor ?? "").replace(/[^0-9]/g, "");
  const monto = Number.parseInt(limpio, 10);
  return Number.isInteger(monto) && monto > 0 && monto <= 50_000_000 ? monto : null;
}

function texto(valor: unknown, maximo: number) {
  return String(valor ?? "").trim().slice(0, maximo);
}

function revalidarAnticipos() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/cuentas", "layout");
  realtime.broadcast("update");
}

/** Registra dinero que el restaurante ya recibió y queda a favor del cliente. */
export async function registrarAnticipo(
  _previa: EstadoAnticipo,
  datos: FormData,
): Promise<EstadoAnticipo> {
  let adminId: number;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador puede registrar anticipos.", ok: null };
  }

  const clienteId = Number.parseInt(String(datos.get("clienteId") ?? ""), 10);
  const monto = montoDe(datos.get("monto"));
  const metodo = String(datos.get("metodo") ?? "");
  const concepto = texto(datos.get("concepto"), 160) || "Bono a favor para próximos consumos";
  if (!Number.isInteger(clienteId) || clienteId <= 0) return { error: "Escoge el cliente que deja el anticipo.", ok: null };
  if (!monto) return { error: "Escribe un valor válido para el anticipo.", ok: null };
  if (!(["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as string[]).includes(metodo)) {
    return { error: "Elige cómo recibió el restaurante el dinero.", ok: null };
  }

  try {
    await db.$transaction(async (tx) => {
      if (await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) {
        throw new ErrorDeAnticipo("La caja de hoy ya está cerrada: registra el anticipo en la siguiente jornada.");
      }
      const cliente = await tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true, nombre: true } });
      if (!cliente) throw new ErrorDeAnticipo("Ese cliente ya no existe.");
      await tx.anticipoCliente.create({
        data: { clienteId, valorOriginal: monto, concepto, metodo, createdById: adminId },
      });
    });
  } catch (error) {
    return { error: error instanceof ErrorDeAnticipo ? error.message : "No se pudo registrar el anticipo. Intenta otra vez.", ok: null };
  }

  revalidarAnticipos();
  return { error: null, ok: "Anticipo guardado. El saldo queda disponible para los próximos consumos." };
}

/** Descuenta un consumo de un saldo a favor sin alterar el comprobante original. */
export async function usarAnticipo(
  _previa: EstadoAnticipo,
  datos: FormData,
): Promise<EstadoAnticipo> {
  let adminId: number;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador puede descontar anticipos.", ok: null };
  }
  const anticipoId = Number.parseInt(String(datos.get("anticipoId") ?? ""), 10);
  const monto = montoDe(datos.get("monto"));
  const concepto = texto(datos.get("concepto"), 160);
  if (!Number.isInteger(anticipoId) || anticipoId <= 0) return { error: "Anticipo inválido.", ok: null };
  if (!monto) return { error: "Escribe el valor del consumo que se va a descontar.", ok: null };
  if (!concepto) return { error: "Describe el consumo para que quede en el historial.", ok: null };

  try {
    await db.$transaction(async (tx) => {
      const anticipo = await tx.anticipoCliente.findUnique({ where: { id: anticipoId }, select: { valorOriginal: true, usado: true, estado: true } });
      if (!anticipo || anticipo.estado !== "VIGENTE") throw new ErrorDeAnticipo("Ese saldo ya no está disponible.");
      const disponible = Math.max(0, anticipo.valorOriginal - anticipo.usado);
      if (monto > disponible) throw new ErrorDeAnticipo(`El saldo disponible es de $${disponible.toLocaleString("es-CO")}.`);
      const usado = anticipo.usado + monto;
      await tx.usoAnticipo.create({ data: { anticipoId, monto, concepto, usuarioId: adminId } });
      await tx.anticipoCliente.update({ where: { id: anticipoId }, data: { usado, estado: usado >= anticipo.valorOriginal ? "AGOTADO" : "VIGENTE" } });
    });
  } catch (error) {
    return { error: error instanceof ErrorDeAnticipo ? error.message : "No se pudo descontar el anticipo. Intenta otra vez.", ok: null };
  }
  revalidarAnticipos();
  return { error: null, ok: "Consumo descontado del saldo a favor." };
}
