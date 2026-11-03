"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { ES_METODO_PAGO, ESTADO_CUENTA } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionCuenta = { error: string | null; ok: string | null };

class ErrorDeCuenta extends Error {}

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Parseo de dinero: «$30.000», «30,000» o «30000» → 30000 */
function parseMonto(crudo: unknown): number | null {
  const limpio = String(crudo ?? "").replace(/[^0-9]/g, "");
  if (limpio === "") return null;
  const valor = Number.parseInt(limpio, 10);
  return Number.isInteger(valor) && valor > 0 ? valor : null;
}

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/cuentas", "layout");
  realtime.broadcast("update");
}

/**
 * Registra una deuda (fiado) de un cliente. NO suma a los ingresos de caja:
// es una promesa, no dinero; entrará el día en que se pague (abonos).
 */
export async function crearCuenta(
  _previa: EstadoAccionCuenta,
  datos: FormData,
): Promise<EstadoAccionCuenta> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
  } catch {
    return { error: "Solo el administrador registra deudas.", ok: null };
  }

  const clienteId = Number.parseInt(String(datos.get("clienteId") ?? ""), 10);
  if (!Number.isInteger(clienteId)) {
    return { error: "Escoge el cliente que debe.", ok: null };
  }
  const concepto = texto(datos.get("concepto"), 140);
  if (concepto.length < 3) {
    return { error: "Escribe el concepto de la deuda (qué fue).", ok: null };
  }
  const valorOriginal = parseMonto(datos.get("valorOriginal"));
  if (
    valorOriginal === null ||
    valorOriginal > 50_000_000
  ) {
    return { error: "Escribe el monto válido que debe.", ok: null };
  }
  // Origen opcional: el id del pedido (también sirve el de un domicilio,
  // que es un pedido sobre la mesa virtual) para la trazabilidad.
  const pedidoIdCrudo = Number.parseInt(
    String(datos.get("pedidoId") ?? ""),
    10,
  );
  const pedidoId = Number.isInteger(pedidoIdCrudo) ? pedidoIdCrudo : null;

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { nombre: true },
  });
  if (!cliente) return { error: "Ese cliente ya no existe.", ok: null };

  await db.cuentaPorCobrar.create({
    data: {
      clienteId,
      concepto,
      valorOriginal,
      pedidoId,
      createdById: adminId,
    },
  });

  revalidar();
  return {
    error: null,
    ok: `Deuda de ${formatCOP(valorOriginal)} registrada para ${cliente.nombre}. No suma a la caja: entra cuando pague.`,
  };
}

/**
 * Pago total o parcial de una deuda: entra como DINERO el día en que se
 * recibe (método y usuario quedan) y sube el saldo. Al llegar a cero la
 * cuenta pasa a PAGADA y queda en el historial, nunca se borra.
 */
export async function registrarAbono(
  _previa: EstadoAccionCuenta,
  datos: FormData,
): Promise<EstadoAccionCuenta> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
  } catch {
    return { error: "Solo el administrador registra pagos de deudas.", ok: null };
  }

  const cuentaId = Number.parseInt(String(datos.get("cuentaId") ?? ""), 10);
  if (!Number.isInteger(cuentaId)) {
    return { error: "Cuenta inválida.", ok: null };
  }
  const monto = parseMonto(datos.get("monto"));
  if (monto === null || monto > 50_000_000) {
    return { error: "El monto abonado no es válido.", ok: null };
  }
  const metodo = String(datos.get("metodo") ?? "");
  if (!ES_METODO_PAGO(metodo)) {
    return { error: "Elige el método con que pagaron.", ok: null };
  }
  const nota = texto(datos.get("nota"), 140) || null;

  try {
    await db.$transaction(async (tx) => {
      const cuenta = await tx.cuentaPorCobrar.findUnique({
        where: { id: cuentaId },
        select: { valorOriginal: true, pagado: true, estado: true },
      });
      if (!cuenta) throw new ErrorDeCuenta("Esa deuda ya no existe.");
      if (cuenta.estado !== ESTADO_CUENTA.PENDIENTE) {
        throw new ErrorDeCuenta(
          "Esa deuda ya no espera abonos (pagada o anulada).",
        );
      }
      const saldo = cuenta.valorOriginal - cuenta.pagado;
      if (monto > saldo) {
        throw new ErrorDeCuenta(
          `Solo restan ${formatCOP(saldo)} de esa deuda.`,
        );
      }
      const nuevoSaldo = saldo - monto;

      await tx.abonoCuenta.create({
        data: { cuentaId, monto, metodo, nota, usuarioId: adminId },
      });
      await tx.cuentaPorCobrar.update({
        where: { id: cuentaId },
        data: {
          pagado: cuenta.pagado + monto,
          estado:
            nuevoSaldo === 0 ? ESTADO_CUENTA.PAGADA : ESTADO_CUENTA.PENDIENTE,
        },
      });
      return nuevoSaldo;
    });
  } catch (e) {
    if (e instanceof ErrorDeCuenta) return { error: e.message, ok: null };
    return { error: "No se pudo registrar el abono. Intenta otra vez.", ok: null };
  }

  revalidar();
  return { error: null, ok: `Abono de ${formatCOP(monto)} recibido.` };
}

/**
 * Anula una cuenta con motivo: conservo el registro para auditoría con
 * quién y cuándo la anuló (nada se borra).
 */
export async function anularCuenta(
  _previa: EstadoAccionCuenta,
  datos: FormData,
): Promise<EstadoAccionCuenta> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
  } catch {
    return { error: "Solo el administrador anula deudas.", ok: null };
  }

  const cuentaId = Number.parseInt(String(datos.get("cuentaId") ?? ""), 10);
  if (!Number.isInteger(cuentaId)) {
    return { error: "Cuenta inválida.", ok: null };
  }
  const motivo = texto(datos.get("motivo"), 200);
  if (motivo.length < 4) {
    return { error: "Explica brevemente por qué se anula.", ok: null };
  }

  try {
    await db.$transaction(async (tx) => {
      const cuenta = await tx.cuentaPorCobrar.findUnique({
        where: { id: cuentaId },
        select: { estado: true },
      });
      if (!cuenta) throw new ErrorDeCuenta("Esa deuda ya no existe.");
      if (cuenta.estado !== ESTADO_CUENTA.PENDIENTE) {
        throw new ErrorDeCuenta("Solo las deudas por cobrar se pueden anular.");
      }
      await tx.cuentaPorCobrar.update({
        where: { id: cuentaId },
        data: {
          estado: ESTADO_CUENTA.ANULADA,
          anuladaById: adminId,
          anuladaAt: new Date(),
          anuladaMotivo: motivo,
        },
      });
    });
  } catch (e) {
    if (e instanceof ErrorDeCuenta) return { error: e.message, ok: null };
    return { error: "No se pudo anular la cuenta. Intenta otra vez.", ok: null };
  }

  revalidar();
  return { error: null, ok: "Cuenta anulada. El registro queda para auditoría." };
}
