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
      const hoy = inicioDeHoy();

      const pagos = await tx.pago.findMany({
        where: { createdAt: { gte: hoy } },
        select: { total: true, propina: true, metodo: true },
      });

      // ═══ Módulos financieros del día (fotografía, no cálculo en vivo) ═══
      const abonos = await tx.abonoCuenta.findMany({
        where: { createdAt: { gte: hoy } },
        select: { monto: true, metodo: true },
      });
      const cxcCreadas = await tx.cuentaPorCobrar.findMany({
        where: { createdAt: { gte: hoy }, estado: { not: "ANULADA" } },
        select: { clienteId: true, concepto: true, valorOriginal: true, pagado: true },
      });
      const cxcPendientes = await tx.cuentaPorCobrar.findMany({
        where: { estado: "PENDIENTE" },
        include: { cliente: true },
        orderBy: { createdAt: "asc" },
      });
      const gastos = await tx.gasto.findMany({
        where: { createdAt: { gte: hoy }, anulado: false },
        select: { valor: true, metodo: true, origen: true },
      });
      const numeroApartados = await tx.apartado.count({
        where: { createdAt: { gte: hoy } },
      });
      const numeroApartadosEntrega = await tx.apartado.count({
        where: { estado: "ENTREGADO", entregadoAt: { gte: hoy } },
      });
      const numeroDomicilios = await tx.domicilio.count({
        where: { createdAt: { gte: hoy } },
      });

      // El cierre sigue VIVO aunque hoy no entre una venta: mientras hayan
      // existido abonos, gastos o deudas del día, la caja se airea igual.
      if (
        pagos.length === 0 &&
        abonos.length === 0 &&
        gastos.length === 0 &&
        cxcCreadas.length === 0
      ) {
        throw new ErrorDeCierre("Hoy no hay pagos que cerrar (ni abonos, gastos o deudas).");
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
        where: { estado: { in: ["SERVIDO", "COBRADO"] }, createdAt: { gte: hoy } },
      });

      // El recaudo de domicilios: los pagos del día sobre la mesa virtual
      // de domicilios (el cobro del tablero es exactamente uno de esos pagos)
      const pagosDomicilios = await tx.pago.findMany({
        where: {
          createdAt: { gte: hoy },
          pedido: { mesa: { esDomicilio: true } },
        },
        select: { total: true },
      });
      const totalDomicilios = pagosDomicilios.reduce((s, p) => s + p.total, 0);

      // —— Desgloses financieros de la fotografía ——
      const abonosTotal = abonos.reduce((s, a) => s + a.monto, 0);
      const abonosEfectivo = abonos
        .filter((a) => a.metodo === "EFECTIVO")
        .reduce((s, a) => s + a.monto, 0);
      const abonosTarjeta = abonos
        .filter((a) => a.metodo === "TARJETA")
        .reduce((s, a) => s + a.monto, 0);
      const abonosTransfer = abonos
        .filter((a) => a.metodo === "TRANSFERENCIA")
        .reduce((s, a) => s + a.monto, 0);

      const totalGastosCaja = gastos
        .filter((g) => g.origen === "CAJA")
        .reduce((s, g) => s + g.valor, 0);
      const gastosCajaEfectivo = gastos
        .filter((g) => g.origen === "CAJA" && g.metodo === "EFECTIVO")
        .reduce((s, g) => s + g.valor, 0);
      const totalGastosExternos = gastos
        .filter((g) => g.origen === "EXTERNO")
        .reduce((s, g) => s + g.valor, 0);

      const cxcCreadasValor = cxcCreadas.reduce((s, c) => s + c.valorOriginal, 0);
      const cxcTotalPendiente = cxcPendientes.reduce(
        (s, c) => s + Math.max(0, c.valorOriginal - c.pagado),
        0,
      );
      // La lista exacta de pendientes tal como se veían AL CERRAR la caja
      const cxcSnapshot = JSON.stringify(
        cxcPendientes.map((c) => ({
          id: c.id,
          cliente: c.cliente?.nombre ?? "—",
          concepto: c.concepto,
          fecha: c.createdAt.toISOString().slice(0, 10),
          valor: c.valorOriginal,
          abonado: c.pagado,
          saldo: Math.max(0, c.valorOriginal - c.pagado),
        })),
      );

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
          // —— Fotografía financiera del día ——
          numeroDomicilios,
          numeroApartados,
          numeroApartadosEntrega,
          numeroAbonos: abonos.length,
          abonosTotal,
          abonosEfectivo,
          abonosTarjeta,
          abonosTransfer,
          numeroGastos: gastos.length,
          totalGastosCaja,
          gastosCajaEfectivo,
          totalGastosExternos,
          cxcCreadasCantidad: cxcCreadas.length,
          cxcCreadasValor,
          cxcTotalPendiente,
          cxcSnapshot,
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
