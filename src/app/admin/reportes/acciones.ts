"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { inicioDeHoy } from "@/lib/pedido";
import { claveDia } from "@/lib/format";
import { exigirAdmin } from "@/lib/session";

export type EstadoAccionCierre = { error: string | null; ok: string | null };

/** Mensajes de negocio que se muestran tal cual en reportes */
class ErrorDeCierre extends Error {}

/**
 * Registra el cierre de caja del día: congela los totales del sistema
 * (por método, propinas y nº de comandas) en un comprobante único por fecha.
 */
export async function registrarCierre(
  _previa: EstadoAccionCierre,
  datos: FormData,
): Promise<EstadoAccionCierre> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
  } catch {
    return { error: "Solo el administrador puede cerrar la caja.", ok: null };
  }

  // Efectivo contado a mano (opcional, para comparar contra el sistema)
  const crudoContado = String(datos.get("efectivoContado") ?? "").replace(/[^0-9]/g, "");
  const efectivoContado = crudoContado === "" ? null : Number.parseInt(crudoContado, 10);
  if (efectivoContado !== null && (!Number.isInteger(efectivoContado) || efectivoContado > 100_000_000)) {
    return { error: "El efectivo contado no es válido.", ok: null };
  }

  try {
    await db.$transaction(async (tx) => {
      const fecha = claveDia(new Date());
      const existente = await tx.cierreCaja.findUnique({ where: { fecha } });
      if (existente) {
        throw new ErrorDeCierre("El cierre de hoy ya está registrado.");
      }

      const pagos = await tx.pago.findMany({
        where: { createdAt: { gte: inicioDeHoy() } },
        select: { total: true, propina: true, metodo: true },
      });
      if (pagos.length === 0) {
        throw new ErrorDeCierre("Hoy no hay pagos: no hay nada que cerrar.");
      }

      const totalEfectivo = pagos
        .filter((p) => p.metodo === "EFECTIVO")
        .reduce((s, p) => s + p.total, 0);
      const totalTarjeta = pagos
        .filter((p) => p.metodo === "TARJETA")
        .reduce((s, p) => s + p.total, 0);
      const totalTransfer = pagos
        .filter((p) => p.metodo === "TRANSFERENCIA")
        .reduce((s, p) => s + p.total, 0);
      const totalPropinas = pagos.reduce((s, p) => s + p.propina, 0);

      const numeroComandas = await tx.pedido.count({
        where: { estado: { in: ["SERVIDO", "COBRADO"] }, createdAt: { gte: inicioDeHoy() } },
      });

      // El recaudo de domicilios: los pagos del día sobre la mesa virtual de
      // domicilios (el domiciliario cobra contra entrega)
      const pagosDomicilios = await tx.pago.findMany({
        where: {
          createdAt: { gte: inicioDeHoy() },
          pedido: { mesa: { esDomicilio: true } },
        },
        select: { total: true },
      });
      const totalDomicilios = pagosDomicilios.reduce((s, p) => s + p.total, 0);

      await tx.cierreCaja.create({
        data: {
          fecha,
          cerradoPorId: adminId,
          totalPagos: totalEfectivo + totalTarjeta + totalTransfer,
          totalEfectivo,
          totalTarjeta,
          totalTransfer,
          totalPropinas,
          numeroPagos: pagos.length,
          numeroComandas,
          totalDomicilios,
          efectivoContado,
        },
      });
    });
  } catch (e) {
    if (e instanceof ErrorDeCierre) return { error: e.message, ok: null };
    return { error: "No se pudo registrar el cierre. Intenta otra vez.", ok: null };
  }

  revalidatePath("/admin", "layout");
  return { error: null, ok: "Cierre del día registrado a las " + new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) + "." };
}
