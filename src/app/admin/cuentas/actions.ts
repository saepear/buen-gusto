"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { precioUnitarioItem } from "@/lib/precios";
import { ES_METODO_PAGO, ESTADO_CUENTA, ESTADO_PEDIDO } from "@/lib/roles";
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

/** Estados en los que un pedido todavía puede terminar fiado */
const ESTADOS_FIABLES = [
  ESTADO_PEDIDO.PARCIAL_SERVIDO,
  ESTADO_PEDIDO.SERVIDO,
  ESTADO_PEDIDO.POR_PAGAR,
];

/** Dinero NO pagado de un pedido: subtotal de las líneas (precios
 *  congelados) minus lo cobrado en caja, minus el saldo que ya quedó
 *  vinculado a otras deudas vivas del mismo pedido. */
async function pendienteRealDelPedido(pedidoId: number): Promise<{
  existe: boolean;
  estado?: string;
  valorPedido?: number;
  cobrado?: number;
  ligado?: number;
  pendiente?: number;
  cuentas?: { id: number; concepto: string; estado: string; valorOriginal: number; abonado: number; saldo: number }[];
}> {
  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    select: { estado: true },
  });
  if (!pedido) return { existe: false };
  const items = await db.pedidoItem.findMany({
    where: { pedidoId },
    select: { cantidad: true, precio: true, producto: { select: { precio: true } } },
  });
  const valorPedido = items.reduce(
    (s, i) => s + precioUnitarioItem(i) * i.cantidad,
    0,
  );
  const pagos = await db.pago.aggregate({
    where: { pedidoId },
    _sum: { total: true, propina: true },
  });
  const cobrado = (pagos._sum.total ?? 0) + (pagos._sum.propina ?? 0);
  const cuentas = await db.cuentaPorCobrar.findMany({
    where: {
      pedidoId,
      estado: { not: ESTADO_CUENTA.ANULADA },
    },
    select: {
      id: true,
      concepto: true,
      estado: true,
      valorOriginal: true,
      pagado: true,
      saldoCondonado: true,
    },
  });
  // Dinero ya comprometido con OTRAS deudas del mismo pedido (no la nueva):
  // el abonado sí es real, y el saldo pendiente de esas cuentas también
  const otrasVivas = cuentas.filter(
    (c) => c.estado === ESTADO_CUENTA.PENDIENTE || c.estado === ESTADO_CUENTA.CONDONADA,
  );
  const ligado =
    otrasVivas.reduce((s, c) => s + c.pagado, 0) + // abonos recibidos
    otrasVivas
      .filter((c) => c.estado === ESTADO_CUENTA.PENDIENTE)
      .reduce((s, c) => s + Math.max(0, c.valorOriginal - c.pagado - c.saldoCondonado), 0);
  return {
    existe: true,
    estado: pedido.estado,
    valorPedido,
    cobrado,
    ligado,
    pendiente: Math.max(0, valorPedido - cobrado - ligado),
    cuentas: cuentas.map((c) => ({
      id: c.id,
      concepto: c.concepto,
      estado: c.estado,
      valorOriginal: c.valorOriginal,
      abonado: c.pagado,
      saldo: Math.max(0, c.valorOriginal - c.pagado - c.saldoCondonado),
    })),
  };
}

/** Resumen en vivo de un pedido para el formulario de deuda (admin) */
export async function resumenPedidoCuenta(pedidoId: number) {
  try {
    await exigirAdmin();
  } catch {
    return null;
  }
  const id = Number.parseInt(String(pedidoId ?? ""), 10);
  if (!Number.isInteger(id)) return { existe: false as const };
  const r = await pendienteRealDelPedido(id);
  if (r.existe) {
    return { ...r, existe: true as const };
  }
  return { existe: false as const };
}

/**
 * Registra una deuda (fiado) de un cliente. NO suma a los ingresos de caja:
 * es una promesa, no dinero; entrará el día en que se pague (abonos).
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
  if (valorOriginal === null || valorOriginal > 50_000_000) {
    return { error: "Escribe el monto válido que debe.", ok: null };
  }
  // Origen opcional: el id del pedido (también sirve el de un domicilio,
  // que es un pedido sobre la mesa virtual) para la trazabilidad.
  const pedidoIdCrudo = Number.parseInt(String(datos.get("pedidoId") ?? ""), 10);
  const pedidoId = Number.isInteger(pedidoIdCrudo) ? pedidoIdCrudo : null;

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { nombre: true },
  });
  if (!cliente) return { error: "Ese cliente ya no existe.", ok: null };

  // Validación estricta del pedido de origen: existencia, estado vivo de
  // cobro y que la deuda NO duplique dinero ya cobrado ni supere el saldo
  // realmente pendiente del pedido.
  if (pedidoId !== null) {
    const r = await pendienteRealDelPedido(pedidoId);
    if (!r.existe) {
      return { error: `El pedido #${pedidoId} no existe. Revisa el número.`, ok: null };
    }
    const estado = r.estado ?? "";
    if (estado === ESTADO_PEDIDO.CANCELADO) {
      return { error: `El pedido #${pedidoId} está CANCELADO: no se fía.`, ok: null };
    }
    if (estado === ESTADO_PEDIDO.COBRADO) {
      return {
        error: `El pedido #${pedidoId} ya está COBRADO: todo su dinero entró a caja.`,
        ok: null,
      };
    }
    if (!ESTADOS_FIABLES.includes(estado as never)) {
      return {
        error: `El pedido #${pedidoId} sigue ${estado} (no servido): espera a que esté listo o fía el pedido desde su comanda.`,
        ok: null,
      };
    }
    const pendiente = r.pendiente ?? 0;
    if (valorOriginal > pendiente) {
      return {
        error:
          `El pedido #${pedidoId} vale ${formatCOP(r.valorPedido ?? 0)}, ya cobró ` +
          `${formatCOP(r.cobrado ?? 0)} y tiene ${formatCOP(r.ligado ?? 0)} ligado a otras deudas: ` +
          `solo queda ${formatCOP(pendiente)} por fiar.`,
        ok: null,
      };
    }
  }

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
 * Abono a una deuda: dinero real hacia caja (entra sí, como venta distinta).
 * Atómico contra doble envío/concurrencia: dentro de la transacción el
 * acumulado de la cuenta se RECALCULA con la suma exacta de los abonos y se
 * recalibra en un UPDATE condicional; si dos solicitudes llegan juntas, solo
 * una logra actualizar la fila (guard estado = 'PENDIENTE' + tope de saldo).
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
        select: { estado: true, valorOriginal: true, pagado: true, saldoCondonado: true },
      });
      if (!cuenta) throw new ErrorDeCuenta("Esa deuda ya no existe.");
      if (cuenta.estado !== ESTADO_CUENTA.PENDIENTE) {
        throw new ErrorDeCuenta(
          cuenta.estado === ESTADO_CUENTA.ANULADA
            ? "Esa deuda fue anulada: no recibe abonos."
            : cuenta.estado === ESTADO_CUENTA.CONDONADA
              ? "Esa deuda quedó condonada: no recibe abonos."
              : "Esa deuda ya está pagada.",
        );
      }
      const saldo = Math.max(
        0,
        cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado,
      );
      if (monto > saldo) {
        throw new ErrorDeCuenta(
          `Solo restan ${formatCOP(saldo)} de esa deuda.`,
        );
      }
      const nuevoSaldo = saldo - monto;

      await tx.abonoCuenta.create({
        data: { cuentaId, monto, metodo, nota, usuarioId: adminId },
      });

      // Invariante + carrera: el acumulado se recalcula desde la tabla de
      // abonos (Cuenta.pagado = SUM(AbonoCuenta.monto) SIEMPRE), el estado
      // sube a PAGADA solo al cubrir el saldo real, y el guard exige
      // estado='PENDIENTE' y suma dentro del saldo disponible. Con SQLite
      // (escrituras serializadas) el segundo concursante termina con
      // afectados = 0 y las dos creaciones se revierten con el rollback.
      const afectados = await tx.$executeRaw`
        UPDATE CuentaPorCobrar
        SET pagado = (
              SELECT COALESCE(SUM(monto), 0) FROM AbonoCuenta WHERE cuentaId = ${cuentaId}
            ),
            estado = CASE
              WHEN (
                SELECT COALESCE(SUM(monto), 0) FROM AbonoCuenta WHERE cuentaId = ${cuentaId}
              ) >= valorOriginal - COALESCE(saldoCondonado, 0)
              THEN 'PAGADA' ELSE estado END
        WHERE id = ${cuentaId}
          AND estado = 'PENDIENTE'
          AND (
            SELECT COALESCE(SUM(monto), 0) FROM AbonoCuenta WHERE cuentaId = ${cuentaId}
          ) <= valorOriginal - COALESCE(saldoCondonado, 0)
      `;
      if (afectados !== 1) {
        throw new ErrorDeCuenta(
          "Otro abono de la misma deuda entró a la vez: se canceló para cobrar solo una vez. Revisa el saldo y repite si falta.",
        );
      }
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
 * Anulación por ERROR: solo para deudas que NUNCA recibieron abonos (con
 * pagos se usa «Condonar saldo restante»). La cuenta y su motivo quedan
 * trazados; no toca la caja.
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
        select: { estado: true, valorOriginal: true, pagado: true },
      });
      if (!cuenta) throw new ErrorDeCuenta("Esa deuda ya no existe.");
      if (cuenta.estado !== ESTADO_CUENTA.PENDIENTE) {
        const porQue =
          cuenta.estado === ESTADO_CUENTA.PAGADA
            ? "ya está pagada (el dinero entró por abonos)"
            : cuenta.estado === ESTADO_CUENTA.CONDONADA
              ? "ya quedó condonada"
              : "ya había sido anulada";
        throw new ErrorDeCuenta(`Solo las deudas por cobrar se pueden anular: esa ${porQue}.`);
      }
      const abonos = await tx.abonoCuenta.count({ where: { cuentaId } });
      if (abonos > 0) {
        throw new ErrorDeCuenta(
          `Esa deuda ya recibió ${abonos} abono${abonos === 1 ? "" : "s"} ` +
            `(${formatCOP(cuenta.pagado)}): no se anula, se usa «Condonar saldo restante» ` +
            "para perdonar la parte que falta y conservar el dinero recibido.",
        );
      }
      // Guard de carrera: si alguien abonó entre la lectura y el update, la
      // condición de estado exacta del updateMany falla y todo revierte
      const guardia = await tx.cuentaPorCobrar.updateMany({
        where: { id: cuentaId, estado: ESTADO_CUENTA.PENDIENTE },
        data: {
          estado: ESTADO_CUENTA.ANULADA,
          anuladaById: adminId,
          anuladaAt: new Date(),
          anuladaMotivo: motivo,
        },
      });
      if (guardia.count !== 1) {
        throw new ErrorDeCuenta("La cuenta cambió al mismo tiempo. Revisa y repite.");
      }
    });
  } catch (e) {
    if (e instanceof ErrorDeCuenta) return { error: e.message, ok: null };
    return { error: "No se pudo anular la cuenta. Intenta otra vez.", ok: null };
  }

  revalidar();
  return { error: null, ok: "Cuenta anulada. El registro queda para auditoría." };
}

/**
 * Condonación del saldo restante: el restaurante perdona lo que falta de una
 * deuda (típicamente de alguien que ya abonó una parte). La condonación NO
 * es ingreso ni pago; los abonos previos siguen siendo dinero recibido. No
 * se crea ninguna fila falsa de abono: se conservan los campos dedicados
 * (saldoCondonado, condonadoPor/By, condonadoAt, motivo) y el estado pasa a
 * CONDONADA.
 */
export async function condonarCuenta(
  _previa: EstadoAccionCuenta,
  datos: FormData,
): Promise<EstadoAccionCuenta> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
  } catch {
    return { error: "Solo el administrador condona deudas.", ok: null };
  }

  const cuentaId = Number.parseInt(String(datos.get("cuentaId") ?? ""), 10);
  if (!Number.isInteger(cuentaId)) {
    return { error: "Cuenta inválida.", ok: null };
  }
  const motivo = texto(datos.get("motivo"), 200);
  if (motivo.length < 4) {
    return { error: "Explica brevemente por qué se condona el saldo.", ok: null };
  }

  try {
    await db.$transaction(async (tx) => {
      const cuenta = await tx.cuentaPorCobrar.findUnique({
        where: { id: cuentaId },
        select: { estado: true, valorOriginal: true, pagado: true, saldoCondonado: true },
      });
      if (!cuenta) throw new ErrorDeCuenta("Esa deuda ya no existe.");
      if (cuenta.estado !== ESTADO_CUENTA.PENDIENTE) {
        const porQue =
          cuenta.estado === ESTADO_CUENTA.PAGADA
            ? "ya está pagada (no hay saldo que condonar)"
            : cuenta.estado === ESTADO_CUENTA.ANULADA
              ? "ya fue anulada"
              : "ya tiene el saldo condonado";
        throw new ErrorDeCuenta(
          `Solo las deudas por cobrar aceptan condonación: esa ${porQue}.`,
        );
      }
      const saldo = Math.max(
        0,
        cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado,
      );
      if (saldo <= 0) {
        throw new ErrorDeCuenta("El saldo de esa deuda ya es cero: nada por condonar.");
      }
      // Guard de carrera: el update solo aterriza si la cuenta sigue viva;
      // el nuevo abono entre lectura y escritura revierte todo
      const guardia = await tx.cuentaPorCobrar.updateMany({
        where: { id: cuentaId, estado: ESTADO_CUENTA.PENDIENTE },
        data: {
          estado: ESTADO_CUENTA.CONDONADA,
          saldoCondonado: saldo,
          condonadoById: adminId,
          condonadoAt: new Date(),
          condonadoMotivo: motivo,
        },
      });
      if (guardia.count !== 1) {
        throw new ErrorDeCuenta("La cuenta cambió al mismo tiempo. Revisa y repite.");
      }
    });
  } catch (e) {
    if (e instanceof ErrorDeCuenta) return { error: e.message, ok: null };
    return { error: "No se pudo condonar la cuenta. Intenta otra vez.", ok: null };
  }

  revalidar();
  return {
    error: null,
    ok: "Saldo condonado. Los abonos ya recibidos siguen contando como dinero entrado.",
  };
}
