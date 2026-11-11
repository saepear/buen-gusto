"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { claveDia, formatCOP } from "@/lib/format";
import { numeroVisible, siguienteConsecutivo } from "@/lib/consecutivos";
import { minutosDeHora } from "@/lib/hora";
import {
  crearPedido,
  ErrorDePedido,
  type CargaPedido,
} from "@/lib/pedido";
import { buscarOcrearCliente, crearClienteNuevo, type ClienteResumen } from "@/lib/clientes";
import { crearCuentaFiadaTx } from "@/lib/fiados";
import { precioUnitarioItem } from "@/lib/precios";
import {
  ES_METODO_PAGO,
  ESTADO_DOMICILIO,
  ESTADO_PEDIDO,
} from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionDomicilio = {
  error: string | null;
  ok: string | null;
  /** Coincidencias que piden decisión del administrador: el número que
   *  escribió ya pertenece a otra persona con otro nombre canónico. */
  coincidencias?: ClienteResumen[];
};

function revalidarDomicilios() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/caja", "layout");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");
}

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * El administrador crea un domicilio: una comanda normal sobre la mesa virtual
 * "Domicilios" (para reutilizar stock) más los datos de entrega del cliente.
 */
export async function crearDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede crear domicilios.", ok: null };
  }

  const cliente = texto(datos.get("cliente"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  const direccion = texto(datos.get("direccion"), 120);
  const barrio = texto(datos.get("barrio"), 60) || null;
  const referencia = texto(datos.get("referencia"), 120) || null;
  // Los clientes fijos de la localidad se registran con el nombre solo
  // ("un almuerzo para Martina"): la ruta queda confirmada con el cliente.
  // Teléfono y dirección quedan OPCIONALES; si los escriben, que valgan.
  const horaEntrega = texto(datos.get("horaEntrega"), 40) || null;

  if (cliente.length < 2) {
    return { error: "Escribe el nombre del cliente.", ok: null };
  }
  if (telefono.length > 0 && telefono.replace(/\D/g, "").length < 7) {
    return { error: "El teléfono de contacto no es válido.", ok: null };
  }
  if (direccion.length > 0 && direccion.length < 5) {
    return { error: "La dirección de entrega queda corta.", ok: null };
  }

  let carga: CargaPedido | null = null;
  try {
    carga = JSON.parse(String(datos.get("datos") ?? "")) as CargaPedido;
  } catch {
    carga = null;
  }
  if (!carga) {
    return {
      error: "Datos del pedido corruptos. Recarga la página e intenta de nuevo.",
      ok: null,
    };
  }
  // Un domicilio siempre sale para llevar: suma el empaque
  carga.llevar = true;

  const mesaVirtual = await db.mesa.findFirst({
    where: { esDomicilio: true },
    select: { id: true },
  });
  if (!mesaVirtual) {
    return {
      error: "No existe la mesa virtual de domicilios. Corre el seed de datos.",
      ok: null,
    };
  }

  const observaciones =
    texto(datos.get("observaciones"), 140) || null;

  // El cliente del módulo Clientes. El resolutor único reutiliza la ficha
  // cuando el nombre canónico coincide, devuelve coincidencias cuando el
  // número pertenece a otra persona (familia compartiendo línea) y crea
  // ficha nueva cuando nadie tiene ese número.
  const elegidoId = Number.parseInt(
    String(datos.get("clienteIdElegido") ?? ""),
    10,
  );
  const forzarNuevo = String(datos.get("clienteNuevo") ?? "") === "1";
  let clienteId: number;
  if (Number.isInteger(elegidoId)) {
    // La ficha que el administrador escogió en el aviso de coincidencias
    const existe = await db.cliente.findUnique({
      where: { id: elegidoId },
      select: { id: true },
    });
    if (!existe) {
      return { error: "La ficha elegida ya no existe: envía de nuevo el domicilio.", ok: null };
    }
    clienteId = elegidoId;
  } else {
    const resolucion = forzarNuevo
      ? ({ tipo: "resuelto", id: await crearClienteNuevo({ nombre: cliente, telefono, direccion, barrio }), yaExistia: false } as const)
      : await buscarOcrearCliente({ nombre: cliente, telefono, direccion, barrio });
    if (resolucion.tipo !== "resuelto") {
      return {
        error: `El número ${telefono} ya está guardado con otro nombre. Confirma quién es la persona de este pedido.`,
        ok: null,
        coincidencias: resolucion.coincidencias,
      };
    }
    clienteId = resolucion.id;
  }
  // El domicilio queda enlazado a su historial para el módulo de clientes.

  let pedidoId: number;
  try {
    pedidoId = await crearPedido({
      mesaId: mesaVirtual.id,
      meseroId: null,
      carga,
      observaciones,
      permitirMesaVirtual: true,
    });
  } catch (e) {
    return {
      error:
        e instanceof ErrorDePedido
          ? e.message
          : "No se pudo crear el domicilio. Intenta otra vez.",
      ok: null,
    };
  }

  await db.$transaction(async (tx) => {
    const fechaConsecutivo = claveDia(new Date());
    const consecutivoDia = await siguienteConsecutivo(tx, fechaConsecutivo, "DOMICILIO");
    await tx.domicilio.create({
      data: {
        pedidoId,
        fechaConsecutivo,
        consecutivoDia,
        cliente,
        telefono,
        direccion,
        barrio,
        referencia,
        horaEntrega,
        horaEntregaMinutos: minutosDeHora(horaEntrega),
        estado: ESTADO_DOMICILIO.PENDIENTE,
        clienteId,
      },
    });
  });

  revalidarDomicilios();
  // El domicilio queda listo para cobro; el sistema no controla preparación.
  redirect("/admin/domicilios");
}

/** Cancela un domicilio que aún no salió: devuelve las porciones al menú */
export async function cancelarDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede cancelar domicilios.", ok: null };
  }

  const domicilioId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(domicilioId)) {
    return { error: "Domicilio inválido.", ok: null };
  }

  const domicilio = await db.domicilio.findUnique({
    where: { id: domicilioId },
    include: { pedido: { include: { items: true } } },
  });
  if (!domicilio) return { error: "Ese domicilio ya no existe.", ok: null };
  if (domicilio.estado !== ESTADO_DOMICILIO.PENDIENTE) {
    return {
      error: "Solo se cancela mientras sigue pendiente en el tablero.",
      ok: null,
    };
  }

  await db.$transaction(async (tx) => {
    await tx.domicilio.update({
      where: { id: domicilioId },
      data: { estado: ESTADO_DOMICILIO.CANCELADO },
    });
    await tx.pedido.update({
      where: { id: domicilio.pedidoId },
      data: { estado: ESTADO_PEDIDO.CANCELADO },
    });

    // Devolver porciones al menú del DÍA DEL PEDIDO (no al de hoy): un
    // domicilio creado a las 11pm y cancelado mañana caería en el menú
    // equivocado si se usara la fecha actual.
    const fecha = claveDia(domicilio.pedido.createdAt);
    for (const item of domicilio.pedido.items) {
      if (!["PROTEINA", "PRINCIPIO", "ENSALADA", "SOPA"].includes(item.tipo)) continue;
      // productoId null = producto eliminado: no hay porciones que devolver
      if (item.productoId === null) continue;
      await tx.$executeRaw`
        UPDATE MenuDiaItem
        SET vendidos = MAX(vendidos - ${item.cantidad}, 0)
        WHERE productoId = ${item.productoId}
          AND menuDiaId = (SELECT id FROM MenuDia WHERE fecha = ${fecha})
      `;
    }
  });

  revalidarDomicilios();
  return { error: null, ok: "Domicilio cancelado y porciones devueltas." };
}

class ErrorDeCobroDomicilio extends Error {}

/**
 * Cobro del domicilio desde el módulo central de Caja: registra
 * el pago con el dinero que entregó el cliente y sus vueltas (solo efectivo),
 * la comanda pasa a COBRADO y el sistema manda a la factura imprimible del
 * domicilio. La comanda de cocina NO vuelve a imprimirse: esa salió al crear
 * el pedido (el flujo de empaque la marca lista desde Órdenes).
 */
export async function cobrarDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede cobrar en la caja.", ok: null };
  }

  const domicilioId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(domicilioId)) {
    return { error: "Domicilio inválido.", ok: null };
  }

  const metodo = String(datos.get("metodo") ?? "");
  if (!ES_METODO_PAGO(metodo)) {
    return { error: "Elige un método de pago válido.", ok: null };
  }

  const propina = Number.parseInt(
    String(datos.get("propina") ?? "").replace(/[^0-9]/g, "") || "0",
    10,
  );
  if (!Number.isInteger(propina) || propina < 0 || propina > 1_000_000) {
    return { error: "La propina ingresada no es válida.", ok: null };
  }

  // "¿Con cuánto paga?" — solo tiene sentido en efectivo; tarjeta y
  // transferencia se cobran al centavo (exacto, sin vueltas).
  const crudoPagado = String(datos.get("montoPagado") ?? "").replace(/[^0-9]/g, "");

  let nuevoPagoId: number;
  try {
    nuevoPagoId = await db.$transaction(async (tx) => {
      if (await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) throw new ErrorDeCobroDomicilio("La caja de hoy ya está cerrada: no se pueden registrar cobros posteriores.");
      const domicilio = await tx.domicilio.findUnique({
        where: { id: domicilioId },
        select: {
          id: true,
          consecutivoDia: true,
          estado: true,
          cobradoMonto: true,
          pedidoId: true,
          pedido: {
            select: {
              estado: true,
              items: {
                include: { producto: { select: { precio: true } } },
              },
            },
          },
        },
      });
      if (!domicilio) throw new ErrorDeCobroDomicilio("Ese domicilio ya no existe.");
      if (domicilio.estado === ESTADO_DOMICILIO.FIADO) {
        throw new ErrorDeCobroDomicilio(
          "Ese domicilio se fió: cobra sus abonos en «Cuentas por cobrar».",
        );
      }
      if (domicilio.estado === ESTADO_DOMICILIO.CANCELADO) {
        throw new ErrorDeCobroDomicilio("Ese domicilio está cancelado.");
      }
      if (domicilio.cobradoMonto !== null) {
        throw new ErrorDeCobroDomicilio("Ese domicilio ya está cobrado.");
      }
      if (domicilio.pedido.estado === ESTADO_PEDIDO.FIADO) {
        throw new ErrorDeCobroDomicilio("Esa comanda ya está fiada.");
      }
      if (domicilio.pedido.estado === ESTADO_PEDIDO.COBRADO) {
        throw new ErrorDeCobroDomicilio("Esa comanda ya está cobrada.");
      }
      if (domicilio.pedido.estado === ESTADO_PEDIDO.CANCELADO) {
        throw new ErrorDeCobroDomicilio("Ese pedido está cancelado.");
      }

      // El total de la factura usa el precio fijado al ordenar, igual que caja
      const total = domicilio.pedido.items.reduce(
        (suma, item) => suma + precioUnitarioItem(item) * item.cantidad,
        0,
      );
      const aCobrar = total + propina;

      let montoPagado: number | null = null;
      let vueltas: number | null = null;
      if (metodo === "EFECTIVO" && crudoPagado !== "") {
        montoPagado = Number.parseInt(crudoPagado, 10);
        if (!Number.isInteger(montoPagado) || montoPagado <= 0) {
          throw new ErrorDeCobroDomicilio("El monto recibido no es válido.");
        }
        if (montoPagado < aCobrar) {
          throw new ErrorDeCobroDomicilio(
            `No alcanza: el cliente entregó ${formatCOP(montoPagado)} y la cuenta es ${formatCOP(aCobrar)}.`,
          );
        }
        vueltas = montoPagado - aCobrar;
      }

      const pago = await tx.pago.create({
        data: {
          pedidoId: domicilio.pedidoId,
          total,
          propina,
          metodo,
          montoPagado,
          vueltas,
        },
      });

      await tx.pedido.update({
        where: { id: domicilio.pedidoId },
        data: { estado: ESTADO_PEDIDO.COBRADO },
      });
      // El dinero quedó en caja: el domicilio sale del tablero de activos
      // y sigue legible en el historial y los reportes
      await tx.domicilio.update({
        where: { id: domicilioId },
        data: { cobradoMonto: total, cobradoMetodo: metodo },
      });

      return pago.id;
    });
  } catch (e) {
    if (e instanceof ErrorDeCobroDomicilio) {
      return { error: e.message, ok: null };
    }
    return {
      error: "No se pudo registrar el cobro. Intenta otra vez.",
      ok: null,
    };
  }

  revalidarDomicilios();
  // La factura del pago queda lista para imprimir (80mm): comanda ya no, la
  // impresión de cocina salió al crear el domicilio.
  redirect(`/admin/domicilios/factura/${nuevoPagoId}`);
}

/**
 * Fiado del domicilio: nace la deuda con la FOTO del pedido, la comanda pasa
 * a FIADO y el domicilio sale del tablero. Si el cliente deja dinero AHORA
 * (abono parcial), ese efectivo sí entra a caja como pago real y la deuda
 * queda solo por lo que faltó. La deuda nunca es ingreso: entra el día de
 * sus abonos (regla del negocio).
 */
export async function fiarDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
  } catch {
    return { error: "Solo el administrador gestiona fiados.", ok: null };
  }

  const domicilioId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(domicilioId)) {
    return { error: "Domicilio inválido.", ok: null };
  }
  // La ficha de la deuda: la del domicilio, o la confirmada en el panel
  const clienteId = Number.parseInt(String(datos.get("clienteId") ?? ""), 10);

  const abono = Number.parseInt(
    String(datos.get("abonoAhora") ?? "").replace(/[^0-9]/g, "") || "0",
    10,
  );
  const metodoAbono = String(datos.get("metodoAbono") ?? "") || "EFECTIVO";
  if (!Number.isInteger(abono) || abono < 0 || abono > 50_000_000) {
    return { error: "El dinero recibido ahora no es válido.", ok: null };
  }

  try {
    await db.$transaction(async (tx) => {
      if (await tx.cierreCaja.findUnique({ where: { fecha: claveDia(new Date()) }, select: { id: true } })) throw new ErrorDeCobroDomicilio("La caja de hoy ya está cerrada: no se pueden registrar abonos posteriores.");
      const domicilio = await tx.domicilio.findUnique({
        where: { id: domicilioId },
        select: {
          id: true,
          consecutivoDia: true,
          estado: true,
          cobradoMonto: true,
          pedidoId: true,
          clienteId: true,
          cliente: true,
          pedido: {
            select: {
              estado: true,
              items: {
                include: { producto: { select: { nombre: true, precio: true } } },
              },
            },
          },
        },
      });
      if (!domicilio) throw new ErrorDeCobroDomicilio("Ese domicilio ya no existe.");
      if (domicilio.estado === ESTADO_DOMICILIO.CANCELADO) {
        throw new ErrorDeCobroDomicilio("Ese domicilio está cancelado.");
      }
      if (domicilio.estado === ESTADO_DOMICILIO.FIADO) {
        throw new ErrorDeCobroDomicilio(
          "Ese domicilio ya se fió: su cobro va con abonos en «Cuentas por cobrar».",
        );
      }
      if (domicilio.cobradoMonto !== null) {
        throw new ErrorDeCobroDomicilio("Ese domicilio ya está cobrado.");
      }
      if (domicilio.pedido.estado === ESTADO_PEDIDO.COBRADO) {
        throw new ErrorDeCobroDomicilio("Esa comanda ya está cobrada.");
      }
      if (domicilio.pedido.estado === ESTADO_PEDIDO.FIADO) {
        throw new ErrorDeCobroDomicilio("Esa comanda ya está fiada.");
      }
      if (domicilio.pedido.estado === ESTADO_PEDIDO.CANCELADO) {
        throw new ErrorDeCobroDomicilio("Ese pedido está cancelado.");
      }

      const total = domicilio.pedido.items.reduce(
        (suma, item) => suma + precioUnitarioItem(item) * item.cantidad,
        0,
      );
      if (total <= 0) {
        throw new ErrorDeCobroDomicilio("El domicilio no tiene dinero por fiar.");
      }
      if (abono >= total) {
        throw new ErrorDeCobroDomicilio(
          `El fiado quedaría sin saldo (cuenta de ${formatCOP(total)} y se recibieron ${formatCOP(abono)}): cóbralo con dinero.`,
        );
      }
      if (abono > 0 && !ES_METODO_PAGO(metodoAbono)) {
        throw new ErrorDeCobroDomicilio("Elige el método del dinero recibido.");
      }

      // Ficha de la deuda: la del domicilio o la confirmada a mano
      let fichaDeudaId = domicilio.clienteId;
      if (Number.isInteger(clienteId)) fichaDeudaId = clienteId;
      if (!fichaDeudaId) {
        throw new ErrorDeCobroDomicilio(
          "Ese domicilio no tiene ficha de cliente: escoge en el panel a quién se le fió.",
        );
      }
      const ficha = await tx.cliente.findUnique({
        where: { id: fichaDeudaId },
        select: { id: true },
      });
      if (!ficha) {
        throw new ErrorDeCobroDomicilio("La ficha elegida ya no existe.");
      }

      // Dinero recibido ahora: pago REAL de caja (día en que se recibe)
      if (abono > 0) {
        await tx.pago.create({
          data: {
            pedidoId: domicilio.pedidoId,
            total: abono,
            propina: 0,
            metodo: metodoAbono,
          },
        });
      }

      // La deuda SOLO por lo que quedó debiendo, con la foto de artículos
      await crearCuentaFiadaTx(tx, {
        clienteId: fichaDeudaId,
        concepto: `Domicilio #${numeroVisible(domicilio)} · ${domicilio.cliente}`,
        valorOriginal: total - abono,
        pedidoId: domicilio.pedidoId,
        createdById: adminId,
        items: domicilio.pedido.items.map((item) => ({
          id: item.id,
          pedidoId: item.pedidoId,
          productoId: item.productoId,
          producto: item.producto,
          productoNombre: item.productoNombre,
          tipo: item.tipo,
          cantidad: item.cantidad,
          precio: item.precio,
          conSopa: item.conSopa,
          nota: item.nota,
          grupo: item.grupo,
        })),
      });

      await tx.pedido.update({
        where: { id: domicilio.pedidoId },
        data: { estado: ESTADO_PEDIDO.FIADO },
      });
      // Sale del tablero: su recaudo vive en «Cuentas por cobrar»
      await tx.domicilio.update({
        where: { id: domicilioId },
        data: { estado: ESTADO_DOMICILIO.FIADO },
      });
    });
  } catch (e) {
    if (e instanceof ErrorDeCobroDomicilio) {
      return { error: e.message, ok: null };
    }
    return {
      error: "No se pudo registrar el fiado. Intenta otra vez.",
      ok: null,
    };
  }

  revalidarDomicilios();
  return {
    error: null,
    ok: "Fiado anotado: la deuda queda en «Cuentas por cobrar» y no suma a la caja.",
  };
}
