"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { nombreDeItem, precioUnitarioItem } from "@/lib/precios";
import {
  ES_METODO_PAGO,
  ESTADO_CUENTA,
  ESTADO_DOMICILIO,
  ESTADO_MESA,
  ESTADO_PEDIDO,
} from "@/lib/roles";
import { ESTADOS_ACTIVOS_PEDIDO } from "@/lib/pedido";
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
  revalidatePath("/mesero", "layout");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");
}

/** Estados en los que un pedido todavía puede terminar fiado */
const ESTADOS_FIABLES = [
  ESTADO_PEDIDO.PARCIAL_SERVIDO,
  ESTADO_PEDIDO.SERVIDO,
  ESTADO_PEDIDO.POR_PAGAR,
];

/** Una línea CON dinero de la comanda, con lo que ya quedó fiado */
export type LineaFiable = {
  pedidoItemId: number;
  productoId: number | null;
  nombre: string;
  tipo: string;
  grupo: number;
  cantidad: number;
  yaFiadas: number;
  disponibles: number;
  precio: number;
  subtotal: number;
  conSopa: boolean | null;
  nota: string | null;
};

/** Resumen de un pedido que aún puede fiar saldo */
export type OrdenFiable = {
  pedidoId: number;
  tipoOrigen: string;
  cliente: string | null;
  fecha: string;
  total: number;
  cobrado: number;
  ligado: number;
  pendiente: number;
};

/** Desglose completo de un pedido para el formulario de fiado */
export type DesglosePedido = {
  pedidoId: number;
  tipoOrigen: string;
  cliente: string | null;
  total: number;
  cobrado: number;
  ligado: number;
  pendiente: number;
  lineas: LineaFiable[];
};

/** Cómo se originó un pedido (etiqueta legible para el selector) */
function tipoDePedido(p: {
  paraLlevar: boolean;
  mesa: { nombre: string; esDomicilio: boolean; esApartado: boolean };
  domicilio: unknown | null;
  apartado: unknown | null;
}): string {
  if (p.domicilio) return "Domicilio";
  if (p.apartado) return "Apartado entregado";
  if (p.mesa.esDomicilio) return "Domicilio";
  if (p.mesa.esApartado) return "Apartado entregado";
  if (p.paraLlevar) return "Para llevar";
  return `Mesa ${p.mesa.nombre}`;
}

/** Dinero pendiente de un pedido, calculado DENTRO de la transacción */
async function pendienteDelPedidoTx(
  tx: Prisma.TransactionClient,
  pedidoId: number,
): Promise<{ valorPedido: number; cobrado: number; ligado: number; pendiente: number }> {
  const items = await tx.pedidoItem.findMany({
    where: { pedidoId },
    select: { cantidad: true, precio: true, producto: { select: { precio: true } } },
  });
  const valorPedido = items.reduce(
    (s, i) => s + precioUnitarioItem(i) * i.cantidad,
    0,
  );
  const pagos = await tx.pago.aggregate({
    where: { pedidoId },
    _sum: { total: true, propina: true },
  });
  const cobrado = (pagos._sum.total ?? 0) + (pagos._sum.propina ?? 0);
  const cuentas = await tx.cuentaPorCobrar.findMany({
    where: { pedidoId, estado: { not: ESTADO_CUENTA.ANULADA } },
    select: { estado: true, valorOriginal: true, pagado: true, saldoCondonado: true },
  });
  const vivas = cuentas.filter(
    (c) =>
      c.estado === ESTADO_CUENTA.PENDIENTE || c.estado === ESTADO_CUENTA.CONDONADA,
  );
  const ligado =
    vivas.reduce((s, c) => s + c.pagado, 0) +
    vivas
      .filter((c) => c.estado === ESTADO_CUENTA.PENDIENTE)
      .reduce((s, c) => s + Math.max(0, c.valorOriginal - c.pagado - c.saldoCondonado), 0);
  return {
    valorPedido,
    cobrado,
    ligado,
    pendiente: Math.max(0, valorPedido - cobrado - ligado),
  };
}

/** Líneas con dinero del pedido y cuántas unidades siguen libres de fiado */
async function lineasFiablesDePedido(
  tx: Prisma.TransactionClient,
  pedidoId: number,
): Promise<{ lineas: LineaFiable[]; total: number }> {
  const items = await tx.pedidoItem.findMany({
    where: { pedidoId },
    orderBy: [{ grupo: "asc" }, { id: "asc" }],
    select: {
      id: true,
      productoId: true,
      productoNombre: true,
      tipo: true,
      cantidad: true,
      precio: true,
      conSopa: true,
      nota: true,
      grupo: true,
      producto: { select: { nombre: true, precio: true } },
    },
  });
  const fiadas = await tx.cuentaPorCobrarItem.groupBy({
    by: ["pedidoItemId"],
    where: {
      cuenta: { pedidoId, estado: { not: ESTADO_CUENTA.ANULADA } },
    },
    _sum: { cantidad: true },
  });
  const mapa = new Map<number, number>();
  for (const f of fiadas) {
    if (f.pedidoItemId !== null) mapa.set(f.pedidoItemId, f._sum.cantidad ?? 0);
  }
  const lineas: LineaFiable[] = [];
  for (const i of items) {
    const precio = precioUnitarioItem(i);
    // Los componentes incluidos en el plato (precio 0) no se cobran aparte
    if (precio <= 0) continue;
    const yaFiadas = mapa.get(i.id) ?? 0;
    lineas.push({
      pedidoItemId: i.id,
      productoId: i.productoId,
      nombre: nombreDeItem(i),
      tipo: i.tipo,
      grupo: i.grupo,
      cantidad: i.cantidad,
      yaFiadas,
      disponibles: Math.max(0, i.cantidad - yaFiadas),
      precio,
      subtotal: precio * i.cantidad,
      conSopa: i.conSopa,
      nota: i.nota,
    });
  }
  return { lineas, total: lineas.reduce((s, l) => s + l.subtotal, 0) };
}

/** Pedidos que aún tienen saldo por fiar, con su resumen (selector del form) */
export async function listarPedidosFiables(): Promise<OrdenFiable[]> {
  try {
    await exigirAdmin();
  } catch {
    return [];
  }
  const pedidos = await db.pedido.findMany({
    where: { estado: { in: ESTADOS_FIABLES } },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      mesa: { select: { nombre: true, esDomicilio: true, esApartado: true } },
      domicilio: { select: { cliente: true } },
      apartado: { select: { cliente: { select: { nombre: true } } } },
    },
  });
  const salida: OrdenFiable[] = [];
  for (const p of pedidos) {
    const r = await pendienteRealDelPedido(p.id);
    if (!r.existe || (r.pendiente ?? 0) <= 0) continue;
    salida.push({
      pedidoId: p.id,
      tipoOrigen: tipoDePedido(p),
      cliente: p.domicilio?.cliente ?? p.apartado?.cliente?.nombre ?? null,
      fecha: p.createdAt.toISOString(),
      total: r.valorPedido ?? 0,
      cobrado: r.cobrado ?? 0,
      ligado: r.ligado ?? 0,
      pendiente: r.pendiente ?? 0,
    });
  }
  return salida;
}

/** Desglose real de un pedido (artículos, precios congelados y ya fiado) */
export async function desglosePedidoCuenta(
  pedidoId: number,
): Promise<DesglosePedido | null> {
  try {
    await exigirAdmin();
  } catch {
    return null;
  }
  const id = Number.parseInt(String(pedidoId ?? ""), 10);
  if (!Number.isInteger(id)) return null;
  const pedido = await db.pedido.findUnique({
    where: { id },
    include: {
      mesa: { select: { nombre: true, esDomicilio: true, esApartado: true } },
      domicilio: { select: { cliente: true } },
      apartado: { select: { cliente: { select: { nombre: true } } } },
    },
  });
  if (!pedido) return null;
  const r = await pendienteRealDelPedido(id);
  if (!r.existe) return null;
  const { lineas } = await lineasFiablesDePedido(db, id);
  return {
    pedidoId: id,
    tipoOrigen: tipoDePedido(pedido),
    cliente: pedido.domicilio?.cliente ?? pedido.apartado?.cliente?.nombre ?? null,
    total: r.valorPedido ?? 0,
    cobrado: r.cobrado ?? 0,
    ligado: r.ligado ?? 0,
    pendiente: r.pendiente ?? 0,
    lineas,
  };
}

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
  const { valorPedido, cobrado, ligado, pendiente } = await pendienteDelPedidoTx(
    db,
    pedidoId,
  );
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
  return {
    existe: true,
    estado: pedido.estado,
    valorPedido,
    cobrado,
    ligado,
    pendiente,
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
  // Origen opcional: una comanda existente, O una deuda manual sin pedido.
  const pedidoIdCrudo = Number.parseInt(String(datos.get("pedidoId") ?? ""), 10);
  const pedidoId = Number.isInteger(pedidoIdCrudo) ? pedidoIdCrudo : null;

  // Selección explícita de artículos (solo cuando hay pedido de origen):
  // el navegador manda [{pedidoItemId, cantidad}]; el servidor lo revalida.
  let seleccion: { pedidoItemId: number; cantidad: number }[] | null = null;
  const lineasCrudas = String(datos.get("lineas") ?? "").trim();
  if (lineasCrudas) {
    try {
      const parsed: unknown = JSON.parse(lineasCrudas);
      if (!Array.isArray(parsed)) {
        return { error: "La selección de artículos no es válida.", ok: null };
      }
      seleccion = parsed.map((x) => {
        const o = x as Record<string, unknown>;
        return {
          pedidoItemId: Number(o?.pedidoItemId),
          cantidad: Number(o?.cantidad),
        };
      });
    } catch {
      return {
        error: "La selección de artículos está corrupta. Recarga la página.",
        ok: null,
      };
    }
  }

  // Deuda manual: monto digitado. Con pedido: el importe lo calcula el
  // servidor a partir de los artículos elegidos (nunca el navegador).
  const valorManual = pedidoId === null ? parseMonto(datos.get("valorOriginal")) : 0;
  if (pedidoId === null && (valorManual === null || valorManual > 50_000_000)) {
    return { error: "Escribe el monto válido que debe.", ok: null };
  }
  if (pedidoId !== null && (!seleccion || seleccion.length === 0)) {
    return {
      error: "Selecciona los artículos del pedido que quedan fiados.",
      ok: null,
    };
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { nombre: true },
  });
  if (!cliente) return { error: "Ese cliente ya no existe.", ok: null };

  let resultado: { valor: number; fiadoCompleto: boolean };
  try {
    resultado = await db.$transaction(async (tx) => {
      let valor: number;
      const itemsSeleccionados: { line: LineaFiable; cantidad: number }[] = [];
      let mesa: { id: number; esDomicilio: boolean; esApartado: boolean } | null = null;

      if (pedidoId !== null) {
        const pedido = await tx.pedido.findUnique({
          where: { id: pedidoId },
          select: {
            estado: true,
            mesaId: true,
            mesa: { select: { id: true, esDomicilio: true, esApartado: true } },
          },
        });
        if (!pedido) {
          throw new ErrorDeCuenta(`El pedido #${pedidoId} no existe.`);
        }
        const estado = pedido.estado;
        if (estado === ESTADO_PEDIDO.CANCELADO) {
          throw new ErrorDeCuenta(`El pedido #${pedidoId} está CANCELADO: no se fía.`);
        }
        if (estado === ESTADO_PEDIDO.COBRADO) {
          throw new ErrorDeCuenta(
            `El pedido #${pedidoId} ya está COBRADO: todo su dinero entró a caja.`,
          );
        }
        if (estado === ESTADO_PEDIDO.FIADO) {
          throw new ErrorDeCuenta(
            `El pedido #${pedidoId} ya se fió: su cobro se lleva en «Cuentas por cobrar» con abonos.`,
          );
        }
        if (!ESTADOS_FIABLES.includes(estado as never)) {
          throw new ErrorDeCuenta(
            `El pedido #${pedidoId} sigue ${estado} (no servido): espera a que esté listo para fiar.`,
          );
        }

        // Re-lectura DENTRO de la transacción: nada de lo enviado por el
        // navegador (precios, disponibles ni total) se toma como cierto.
        const { lineas } = await lineasFiablesDePedido(tx, pedidoId);
        const porId = new Map(lineas.map((l) => [l.pedidoItemId, l]));
        const vistos = new Set<number>();
        let suma = 0;
        for (const s of seleccion!) {
          const item = porId.get(s.pedidoItemId);
          if (!item) {
            throw new ErrorDeCuenta(
              "Uno de los artículos no pertenece a ese pedido. Recarga la página.",
            );
          }
          if (!Number.isInteger(s.cantidad) || s.cantidad < 1) {
            throw new ErrorDeCuenta(
              `La cantidad fiada de «${item.nombre}» no es válida.`,
            );
          }
          if (vistos.has(s.pedidoItemId)) {
            throw new ErrorDeCuenta("El mismo artículo aparece dos veces en el fiado.");
          }
          vistos.add(s.pedidoItemId);
          if (s.cantidad > item.disponibles) {
            throw new ErrorDeCuenta(
              `De «${item.nombre}» solo quedan ${item.disponibles} unidad(es) por fiar: ` +
                `${item.yaFiadas} ya se comprometieron en otra deuda.`,
            );
          }
          suma += item.precio * s.cantidad;
          itemsSeleccionados.push({ line: item, cantidad: s.cantidad });
        }
        if (itemsSeleccionados.length === 0) {
          throw new ErrorDeCuenta("Selecciona al menos un artículo para fiar.");
        }
        const pend = await pendienteDelPedidoTx(tx, pedidoId);
        if (suma > pend.pendiente) {
          throw new ErrorDeCuenta(
            `El pedido #${pedidoId} solo tiene ${formatCOP(pend.pendiente)} pendientes: ` +
              `la selección vale ${formatCOP(suma)}.`,
          );
        }
        valor = suma;
        mesa = pedido.mesa;
      } else {
        valor = valorManual!;
      }

      const cuenta = await tx.cuentaPorCobrar.create({
        data: {
          clienteId,
          concepto,
          valorOriginal: valor,
          pedidoId,
          createdById: adminId,
        },
        select: { id: true },
      });

      // La foto de SOLO los artículos elegidos, con su cantidad y precio
      // congelados (el desglose sobrevive a borrar el producto o la comanda).
      if (itemsSeleccionados.length > 0) {
        await tx.cuentaPorCobrarItem.createMany({
          data: itemsSeleccionados.map(({ line, cantidad }) => ({
            cuentaId: cuenta.id,
            pedidoItemId: line.pedidoItemId,
            productoId: line.productoId,
            grupo: line.grupo,
            tipo: line.tipo,
            nombre: line.nombre,
            cantidad,
            precio: line.precio,
            conSopa: line.conSopa,
            nota: line.nota,
          })),
        });
      }

      // Si el fiado cubre TODO lo que faltaba, la comanda sale de las colas
      // de cobro y queda FIADA (y el domicilio también). Un fiado parcial
      // deja el pedido vivo con su saldo restante (nunca se oculta).
      let fiadoCompleto = false;
      if (pedidoId !== null) {
        const despues = await pendienteDelPedidoTx(tx, pedidoId);
        if (despues.pendiente <= 0) {
          fiadoCompleto = true;
          await tx.pedido.update({
            where: { id: pedidoId },
            data: { estado: ESTADO_PEDIDO.FIADO },
          });
          await tx.domicilio.updateMany({
            where: { pedidoId },
            data: { estado: ESTADO_DOMICILIO.FIADO },
          });
          // La mesa se libera solo si no le quedan otras comandas activas
          if (mesa && !mesa.esDomicilio && !mesa.esApartado) {
            const otros = await tx.pedido.count({
              where: {
                mesaId: mesa.id,
                id: { not: pedidoId },
                estado: { in: ESTADOS_ACTIVOS_PEDIDO },
              },
            });
            if (otros === 0) {
              await tx.mesa.update({
                where: { id: mesa.id },
                data: { estado: ESTADO_MESA.LIBRE },
              });
            }
          }
        }
      }

      return { valor, fiadoCompleto };
    });
  } catch (e) {
    if (e instanceof ErrorDeCuenta) return { error: e.message, ok: null };
    return { error: "No se pudo registrar la deuda. Intenta otra vez.", ok: null };
  }

  revalidar();
  return {
    error: null,
    ok:
      `Deuda de ${formatCOP(resultado.valor)} registrada para ${cliente.nombre}. ` +
      "No suma a la caja: entra cuando pague." +
      (resultado.fiadoCompleto
        ? " El pedido quedó FIADO y salió de las colas de cobro."
        : pedidoId !== null
          ? " El pedido conserva el saldo que aún falta cobrar."
          : ""),
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

      // Antes de crear el abono se valida que el histórico de abonos sea
      // coherente con el acumulado de la cuenta. Si no lo es, alguien escribió
      // en la BD por fuera del sistema (manual o pruebas): no se abona nada
      // y se explica con precisión, sin confundir con una carrera.
      const sumaHoy = await tx.abonoCuenta.aggregate({
        where: { cuentaId },
        _sum: { monto: true },
      });
      const suma = sumaHoy._sum.monto ?? 0;
      if (suma > cuenta.valorOriginal - cuenta.saldoCondonado) {
        throw new ErrorDeCuenta(
          `Esta deuda tiene abonos por ${formatCOP(suma)} que superan su valor ${formatCOP(cuenta.valorOriginal)}: hay apuntes registrados fuera del sistema. Limpia esos apuntes antes de abonar.`,
        );
      }
      if (suma !== cuenta.pagado) {
        throw new ErrorDeCuenta(
          `Esta deuda está incoherente: registra abonos por ${formatCOP(suma)} pero su acumulado dice ${formatCOP(cuenta.pagado)}. Hay apuntes escritos fuera del sistema; corrígelos antes de abonar.`,
        );
      }

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
