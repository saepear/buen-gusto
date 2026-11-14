"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { precioUnitarioItem } from "@/lib/precios";
import { ESTADOS_ACTIVOS_PEDIDO } from "@/lib/pedido";
import { crearCuentaFiadaTx, type ItemDePedidoParaFoto } from "@/lib/fiados";
import {
  ES_METODO_PAGO,
  ESTADO_MESA,
  ESTADO_PEDIDO,
} from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { claveDia } from "@/lib/format";
import { numeroVisible } from "@/lib/consecutivos";
import { realtime } from "@/lib/realtime";
import { fotoPedidos } from "@/lib/recibo";

export type EstadoAccionCaja = { error: string | null; ok?: string };

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
  let cobradoPorNombre: string;
  try {
    const sesion = await exigirAdmin();
    cobradoPorNombre = sesion.nombre;
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

  // "¿Con cuánto pagó?" — solo se registra en efectivo; vacío = pago exacto
  const crudoPagado = String(datos.get("montoPagado") ?? "").replace(/[^0-9]/g, "");

  let nuevoPagoId: number | null = null;
  try {
    nuevoPagoId = await db.$transaction(async (tx) => {
      if (await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) throw new ErrorDeCaja("La caja de hoy ya está cerrada: no se pueden registrar cobros posteriores.");
      const mesa = await tx.mesa.findUnique({
        where: { id: mesaId },
        select: { nombre: true, estado: true, activa: true },
      });
      if (!mesa || !mesa.activa) throw new ErrorDeCaja("Esa mesa ya no existe.");
      if (
        mesa.estado !== ESTADO_MESA.OCUPADA &&
        mesa.estado !== ESTADO_MESA.POR_PAGAR
      ) {
        throw new ErrorDeCaja(
          `La mesa «${mesa.nombre}» ya está libre: no hay nada que cobrar.`,
        );
      }

      // Una mesa puede haber quedado abierta al finalizar el día anterior.
      // Cobramos todas sus comandas activas, sin importar la fecha de creación.
      const pedidos = await tx.pedido.findMany({
        where: {
          mesaId,
          estado: { in: ESTADOS_ACTIVOS_PEDIDO },
        },
        include: {
          items: { include: { producto: { select: { nombre: true, precio: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      if (pedidos.length === 0) {
        throw new ErrorDeCaja(
          `La mesa «${mesa.nombre}» no tiene comandas activas para cobrar.`,
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

      // ¿Con cuánto pagó y cuánto se devolvió? Solo en efectivo: vacío queda
      // registrado como pago exacto (null), como siempre. Si el billete no
      // cubre la cuenta, el cobro entero se rechaza.
      let montoPagado: number | null = null;
      let vueltas: number | null = null;
      if (metodo === "EFECTIVO" && crudoPagado !== "") {
        montoPagado = Number.parseInt(crudoPagado, 10);
        if (!Number.isInteger(montoPagado) || montoPagado <= 0) {
          throw new ErrorDeCaja("El monto entregado por el cliente no es válido.");
        }
        if (montoPagado < total + propina) {
          throw new ErrorDeCaja(
            `No alcanza: el cliente entregó ${formatCOP(montoPagado)} y la cuenta es ${formatCOP(total + propina)}.`,
          );
        }
        vueltas = montoPagado - total - propina;
      }

      // Un solo pago por cobro; se ancla a la comanda más reciente del lote
      const ancla = pedidos[pedidos.length - 1];
      if (!ancla) throw new ErrorDeCaja("No se pudo crear el pago.");
      const pago = await tx.pago.create({
        data: {
          pedidoId: ancla.id,
          total,
          propina,
          metodo,
          montoPagado,
          vueltas,
          pedidosSnapshot: JSON.stringify(fotoPedidos(pedidos)),
          cobradoPorNombre,
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
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");

  redirect(`/admin/caja/recibo/${nuevoPagoId}?autoPrint=1`);
}

/**
 * Cierra una mesa usando un saldo a favor existente. No crea un `Pago`: el
 * dinero ya entró a caja el día en que se registró el anticipo; aquí solo se
 * deja el consumo auditado y se libera la mesa.
 */
export async function cobrarMesaConAnticipo(
  _previa: EstadoAccionCaja,
  datos: FormData,
): Promise<EstadoAccionCaja> {
  let adminId: number;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador puede aplicar un anticipo." };
  }
  const mesaId = Number.parseInt(String(datos.get("mesaId") ?? ""), 10);
  const anticipoId = Number.parseInt(String(datos.get("anticipoId") ?? ""), 10);
  if (!Number.isInteger(mesaId) || !Number.isInteger(anticipoId)) {
    return { error: "Escoge una mesa y un anticipo válido." };
  }

  try {
    await db.$transaction(async (tx) => {
      if (await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) {
        throw new ErrorDeCaja("La caja de hoy ya está cerrada: no se pueden aplicar anticipos.");
      }
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId }, select: { nombre: true, estado: true, activa: true, esDomicilio: true, esApartado: true } });
      if (!mesa || !mesa.activa || mesa.esDomicilio || mesa.esApartado) throw new ErrorDeCaja("Esa mesa no está disponible para aplicar un anticipo.");
      if (![ESTADO_MESA.OCUPADA, ESTADO_MESA.POR_PAGAR].includes(mesa.estado as never)) throw new ErrorDeCaja("La mesa ya no tiene una cuenta pendiente.");
      const pedidos = await tx.pedido.findMany({ where: { mesaId, estado: { in: ESTADOS_ACTIVOS_PEDIDO } }, include: { items: { include: { producto: true } } }, orderBy: { createdAt: "asc" } });
      if (!pedidos.length) throw new ErrorDeCaja("La mesa no tiene comandas pendientes.");
      const total = pedidos.reduce((suma, pedido) => suma + pedido.items.reduce((sub, item) => sub + precioUnitarioItem(item) * item.cantidad, 0), 0);
      if (total <= 0) throw new ErrorDeCaja("La mesa no tiene un valor válido para descontar.");
      const anticipo = await tx.anticipoCliente.findUnique({ where: { id: anticipoId }, select: { cliente: { select: { nombre: true } } } });
      if (!anticipo) throw new ErrorDeCaja("Ese anticipo ya no existe.");
      const actualizado = await tx.$executeRaw`
        UPDATE AnticipoCliente
        SET usado = usado + ${total},
            estado = CASE WHEN usado + ${total} >= valorOriginal THEN 'AGOTADO' ELSE 'VIGENTE' END
        WHERE id = ${anticipoId}
          AND estado = 'VIGENTE'
          AND valorOriginal - usado >= ${total}
      `;
      if (actualizado !== 1) throw new ErrorDeCaja("El anticipo no cubre el total o fue usado en otra operación. Recarga la caja.");
      const ancla = pedidos[pedidos.length - 1];
      await tx.usoAnticipo.create({ data: { anticipoId, monto: total, concepto: `Cobro de Mesa ${mesa.nombre} · Pedido #${numeroVisible(ancla)}`, usuarioId: adminId } });
      await tx.pedido.updateMany({ where: { id: { in: pedidos.map((pedido) => pedido.id) } }, data: { estado: ESTADO_PEDIDO.COBRADO } });
      await tx.mesa.update({ where: { id: mesaId }, data: { estado: ESTADO_MESA.LIBRE } });
    });
  } catch (error) {
    return { error: error instanceof ErrorDeCaja ? error.message : "No se pudo aplicar el anticipo. Intenta de nuevo." };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/admin/cuentas");
  revalidatePath("/admin/caja");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");
  return { error: null, ok: "Mesa cobrada con el saldo a favor del cliente. No se registró dinero nuevo en caja." };
}

/**
 * Fiado de la MESA completa: las comandas activas de hoy pasan a estado FIADO
 * (salen de todas las colas: caja, cocina, mesero y mesas), la mesa queda
 * LIBRE y nace la deuda con la FOTO de los artículos. Opcionalmente el admin
 * recibe dinero AHORA (abono parcial): ese efectivo sí entra a caja como pago
 * real, y la deuda se crea solo por lo que LLEGÓ (total − recibido).
 * La deuda nunca es ingreso; entra el día de sus abonos.
 */
export async function fiarCuenta(
  _previa: EstadoAccionCaja,
  datos: FormData,
): Promise<EstadoAccionCaja> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
  } catch {
    return { error: "Solo el administrador gestiona fiados." };
  }

  const mesaId = Number.parseInt(String(datos.get("mesaId") ?? ""), 10);
  if (!Number.isInteger(mesaId)) return { error: "Mesa inválida." };

  const clienteId = Number.parseInt(String(datos.get("clienteId") ?? ""), 10);
  if (!Number.isInteger(clienteId)) {
    return { error: "Escoge el cliente que va a fiar." };
  }

  // Dinero que el cliente entrega AHORA (parcial): 0 = fiado puro
  const abono = Number.parseInt(
    String(datos.get("abonoAhora") ?? "").replace(/[^0-9]/g, "") || "0",
    10,
  );
  const metodoAbono = String(datos.get("metodoAbono") ?? "") || "EFECTIVO";
  if (!Number.isInteger(abono) || abono < 0 || abono > 50_000_000) {
    return { error: "El dinero recibido ahora no es válido." };
  }

  try {
    await db.$transaction(async (tx) => {
      if (await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) throw new ErrorDeCaja("La caja de hoy ya está cerrada: no se pueden registrar abonos posteriores.");
      const mesa = await tx.mesa.findUnique({
        where: { id: mesaId },
        select: {
          nombre: true,
          estado: true,
          activa: true,
          esDomicilio: true,
          esApartado: true,
        },
      });
      if (!mesa || !mesa.activa) throw new ErrorDeCaja("Esa mesa ya no existe.");
      if (mesa.esDomicilio || mesa.esApartado) {
        throw new ErrorDeCaja(
          "Los domicilios y apartados se fiaban desde su panel, no desde la caja de mesas.",
        );
      }
      if (
        mesa.estado !== ESTADO_MESA.OCUPADA &&
        mesa.estado !== ESTADO_MESA.POR_PAGAR
      ) {
        throw new ErrorDeCaja(
          `La mesa «${mesa.nombre}» ya está libre: no hay nada que fiar.`,
        );
      }

      const pedidos = await tx.pedido.findMany({
        where: {
          mesaId,
          estado: { in: ESTADOS_ACTIVOS_PEDIDO },
        },
        include: {
          items: { include: { producto: { select: { nombre: true, precio: true } } } },
        },
        orderBy: { createdAt: "asc" },
      });
      if (pedidos.length === 0) {
        throw new ErrorDeCaja(
          `La mesa «${mesa.nombre}» no tiene comandas activas para fiar.`,
        );
      }

      const total = pedidos.reduce(
        (suma, pedido) =>
          suma +
          pedido.items.reduce(
            (x, item) => x + precioUnitarioItem(item) * item.cantidad,
            0,
          ),
        0,
      );
      if (total <= 0) {
        throw new ErrorDeCaja("La mesa no tiene dinero por fiar.");
      }
      if (abono >= total) {
        throw new ErrorDeCaja(
          `El fiado quedaría sin saldo (${formatCOP(total)} la cuenta y se recibieron ${formatCOP(abono)}): cobra la mesa completa con dinero.`,
        );
      }
      const cliente = await tx.cliente.findUnique({
        where: { id: clienteId },
        select: { nombre: true },
      });
      if (!cliente) throw new ErrorDeCaja("Ese cliente ya no existe.");

      // Dinero recibido ahora: pago REAL de caja, anclado a la comanda más
      // reciente (como el cobro de mesa). Esto SÍ es ingreso del día.
      const ancla = pedidos[pedidos.length - 1];
      if (!ancla) throw new ErrorDeCaja("No se pudo anclar el pago.");
      if (abono > 0) {
        if (!ES_METODO_PAGO(metodoAbono)) {
          throw new ErrorDeCaja("Elige el método del dinero recibido.");
        }
        await tx.pago.create({
          data: {
            pedidoId: ancla.id,
            total: abono,
            propina: 0,
            metodo: metodoAbono,
          },
        });
      }

      // La deuda SOLO por lo que quedó debiendo, con la foto de los artículos
      const items: ItemDePedidoParaFoto[] = [];
      for (const pedido of pedidos) {
        for (const item of pedido.items) {
          items.push({
            id: item.id,
            pedidoId: item.pedidoId,
            productoId: item.productoId,
            producto: item.producto
              ? { nombre: item.producto.nombre, precio: item.producto.precio }
              : null,
            productoNombre: item.productoNombre,
            tipo: item.tipo,
            cantidad: item.cantidad,
            precio: item.precio,
            conSopa: item.conSopa,
            nota: item.nota,
            grupo: item.grupo,
          });
        }
      }
      const saldoFiado = total - abono;
      const cuentaId = await crearCuentaFiadaTx(tx, {
        clienteId,
        concepto: `Pedido #${numeroVisible(ancla)} · Mesa ${mesa.nombre}`,
        valorOriginal: saldoFiado,
        pedidoId: ancla.id,
        createdById: adminId,
        items,
      });

      // FIADO = fuera de colas: la comanda deja de estar activa en caja,
      // mesa, mesero y cocina; el recaudo entra con los abonos.
      await tx.pedido.updateMany({
        where: { id: { in: pedidos.map((p) => p.id) } },
        data: { estado: ESTADO_PEDIDO.FIADO },
      });
      await tx.mesa.update({
        where: { id: mesaId },
        data: { estado: ESTADO_MESA.LIBRE },
      });

      return { cuentaId, saldoFiado, cliente: cliente.nombre };
    });
  } catch (e) {
    if (e instanceof ErrorDeCaja) return { error: e.message };
    return { error: "No se pudo registrar el fiado. Intenta otra vez." };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/mesero", "layout");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");

  return {
    error: null,
    ok: `Fiado anotado. La deuda queda en «Cuentas por cobrar» y no suma a la caja.`,
  };
}
