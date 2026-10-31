"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { minutosDeHora } from "@/lib/hora";
import {
  crearPedido,
  ErrorDePedido,
  menuDeHoy,
  type CargaPedido,
  type LineaAlmuerzo,
} from "@/lib/pedido";
import { ESTADO_DOMICILIO, ESTADO_PEDIDO } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionDomicilio = { error: string | null; ok: string | null };

function revalidarDomicilios() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ordenes", "layout");
  revalidatePath("/domicilios", "layout");
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
  // ("un almuerzo para Martina"): el repartidor conoce la ruta de memoria.
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

  await db.domicilio.create({
    data: {
      pedidoId,
      cliente,
      telefono,
      direccion,
      barrio,
      referencia,
      horaEntrega,
      horaEntregaMinutos: minutosDeHora(horaEntrega),
      estado: ESTADO_DOMICILIO.PENDIENTE,
    },
  });

  revalidarDomicilios();
  // La comanda sale directa a imprimir para la cocina; el «volver» regresa
  // al tablero de domicilios (el BotonImprimir admite el parámetro volver).
  redirect(`/ordenes/comanda/${pedidoId}?autoPrint=1&volver=/admin/domicilios`);
}

/**
 * Cliente fijo: re-registra su último domicilio tal cual, mapeando los
 * platos de aquella vez contra el menú de HOY. El pedido viejo guarda
 * productoIds; el menú de cada día crea itemIds nuevos, así que la "carga"
 * se rearma buscando el plato equivalente vigente. El precio se vuelve a
 * fijar con las reglas de hoy (precioAlmuerzo + extras), que es lo que
 * después llega a Reportes con el cobro contra entrega.
 */
export async function repetirUltimoDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede registrar domicilios.", ok: null };
  }

  const origenId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(origenId)) {
    return { error: "Cliente inválido: recarga la página.", ok: null };
  }

  const origen = await db.domicilio.findUnique({
    where: { id: origenId },
    include: { pedido: { include: { items: { include: { producto: true } } } } },
  });
  if (!origen || origen.pedido.estado === ESTADO_PEDIDO.CANCELADO) {
    return { error: "Su último pedido ya no se puede repetir. Usa el formulario.", ok: null };
  }

  // Guardia anti-duplicado: solo aplica cuando hay teléfono; los registros
  // "solo el nombre" (sin teléfono) no se cruzan entre sí en esta búsqueda
  // porque varios clientes distintos pueden ir sin número.
  const enCurso = origen.telefono.trim()
    ? await db.domicilio.findFirst({
        where: {
          telefono: origen.telefono,
          estado: {
            in: [
              ESTADO_DOMICILIO.PENDIENTE,
              ESTADO_DOMICILIO.ASIGNADO,
              ESTADO_DOMICILIO.EN_CAMINO,
            ],
          },
          NOT: { id: origenId },
        },
        select: { cliente: true },
      })
    : null;
  if (enCurso) {
    return {
      error: `${enCurso.cliente} ya tiene un domicilio en curso: asígnale domiciliario en el tablero en vez de repetirlo.`,
      ok: null,
    };
  }

  // Rearmar la selección contra el menú VIGENTE de hoy
  const menu = await menuDeHoy();
  const hoyPorProducto = new Map(menu.map((m) => [m.productoId, m]));
  const itemIdDe = (productoId: number, tipo: string): number | null => {
    const hoy = hoyPorProducto.get(productoId);
    return hoy && hoy.tipo === tipo ? hoy.itemId : null;
  };

  // Cada proteína (por plato y por «con sopa / bandeja») es una línea del
  // pedido de hoy: un domicilio puede traer de 1 a muchos almuerzos, y las
  // filas del pedido viejo con el mismo plato se fusionan en una línea.
  const grupos = new Map<
    string,
    { productoId: number; nombre: string; conSopa: boolean; cantidad: number }
  >();
  for (const it of origen.pedido.items.filter(
    (fila) => fila.tipo === "PROTEINA" && fila.conSopa !== null,
  )) {
    const clave = `${it.productoId}|${it.conSopa ? "c" : "b"}`;
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.cantidad += it.cantidad;
    } else {
      grupos.set(clave, {
        productoId: it.productoId,
        nombre: it.producto.nombre,
        conSopa: it.conSopa === true,
        cantidad: it.cantidad,
      });
    }
  }
  if (grupos.size === 0) {
    return {
      error: "Su último pedido no fue un almuerzo del día: regístralo con el formulario.",
      ok: null,
    };
  }

  // Las líneas van de la más grande a la más chica: el reparto de los
  // agregados compartidos queda estable entre repetición y repetición.
  const lineas: LineaAlmuerzo[] = [];
  for (const grupo of [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad)) {
    const proteinaId = itemIdDe(grupo.productoId, "PROTEINA");
    if (proteinaId === null) {
      return {
        error: `«${grupo.nombre}» no está en el menú de hoy: repítelo con el formulario y ajusta lo que cambió.`,
        ok: null,
      };
    }
    lineas.push({
      conSopa: grupo.conSopa,
      proteinaId,
      principios: [],
      ensaladas: [],
      sopaId: null,
      cantidad: grupo.cantidad,
    });
  }

  // Principios, ensaladas y sopa con nombre viven agregados en el pedido
  // viejo, sin registrar el plato al que pertenecían: se reparten entre las
  // líneas, empezando por la más grande, hasta cubrir las unidades del día
  // original. Una unidad que cambió de menú simplemente no entra.
  const repartir = (
    tipo: string,
    asignaEn: "principios" | "ensaladas" | "sopa",
    filas: { productoId: number; cantidad: number }[],
  ) => {
    for (const fila of filas) {
      let pendiente = fila.cantidad;
      for (const linea of lineas) {
        if (pendiente <= 0) break;
        if (asignaEn === "sopa" && !linea.conSopa) continue;
        const itemId = itemIdDe(fila.productoId, tipo);
        if (itemId === null) continue;
        if (asignaEn === "sopa") {
          if (linea.sopaId !== null) continue;
          linea.sopaId = itemId;
          pendiente -= linea.cantidad;
        } else {
          const lista = asignaEn === "principios" ? linea.principios : linea.ensaladas;
          if (lista.includes(itemId)) {
            pendiente -= linea.cantidad;
            continue;
          }
          lista.push(itemId);
          pendiente -= linea.cantidad;
        }
      }
    }
  };
  const filasDe = (tipo: string) =>
    origen.pedido.items
      .filter((it) => it.tipo === tipo)
      .map((it) => ({ productoId: it.productoId, cantidad: it.cantidad }));

  repartir("PRINCIPIO", "principios", filasDe("PRINCIPIO"));
  repartir("ENSALADA", "ensaladas", filasDe("ENSALADA"));
  if (origen.pedido.items.some((it) => it.tipo === "SOPA")) {
    repartir("SOPA", "sopa", filasDe("SOPA"));
  }

  // Extras (bebidas / adicionales): ids de producto, respetando la cantidad
  // real (3 gaseosas = 3 unidades en la carga, no 1 deduplicada)
  const idsExtras = [
    ...new Set(
      origen.pedido.items
        .filter((it) => it.tipo === "BEBIDA" || it.tipo === "ADICIONAL")
        .map((it) => it.productoId),
    ),
  ];
  const vigentes = idsExtras.length
    ? new Set(
        (
          await db.producto.findMany({
            where: {
              id: { in: idsExtras },
              activo: true,
              tipo: { in: ["BEBIDA", "ADICIONAL"] },
            },
            select: { id: true },
          })
        ).map((p) => p.id),
      )
    : new Set<number>();
  const extras = origen.pedido.items
    .filter(
      (it) =>
        (it.tipo === "BEBIDA" || it.tipo === "ADICIONAL") && vigentes.has(it.productoId),
    )
    .flatMap((it) => Array.from({ length: it.cantidad }, () => it.productoId));

  const carga: CargaPedido = {
    lineas,
    extras,
    llevar: true,
  };

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

  let pedidoId: number;
  try {
    pedidoId = await crearPedido({
      mesaId: mesaVirtual.id,
      meseroId: null,
      carga,
      // La nota de siempre ("toalla aparte", "sin arepa"…) viaja con el pedido
      observaciones: origen.pedido.observaciones,
      permitirMesaVirtual: true,
    });
  } catch (e) {
    return {
      error:
        e instanceof ErrorDePedido
          ? e.message
          : "No se pudo repetir el domicilio. Intenta otra vez.",
      ok: null,
    };
  }

  await db.domicilio.create({
    data: {
      pedidoId,
      cliente: origen.cliente,
      telefono: origen.telefono,
      // El repartidor la conoce de memoria; queda registrada por si acaso
      direccion: origen.direccion,
      barrio: origen.barrio,
      referencia: origen.referencia,
      horaEntrega: origen.horaEntrega,
      horaEntregaMinutos: origen.horaEntregaMinutos,
      estado: ESTADO_DOMICILIO.PENDIENTE,
    },
  });

  revalidarDomicilios();
  // La comanda sale directa a imprimir para la cocina; el «volver» regresa
  // al tablero de domicilios (el BotonImprimir admite el parámetro volver).
  redirect(`/ordenes/comanda/${pedidoId}?autoPrint=1&volver=/admin/domicilios`);
}
export async function asignarDomiciliario(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede asignar domicilios.", ok: null };
  }

  const domicilioId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  const domiciliarioId = Number.parseInt(String(datos.get("domiciliarioId") ?? ""), 10);
  if (!Number.isInteger(domicilioId) || !Number.isInteger(domiciliarioId)) {
    return { error: "Elige un domiciliario.", ok: null };
  }

  const repartidor = await db.usuario.findFirst({
    where: { id: domiciliarioId, rol: "DOMICILIARIO", activo: true },
    select: { nombre: true },
  });
  if (!repartidor) {
    return { error: "Ese domiciliario no está disponible.", ok: null };
  }

  const domicilio = await db.domicilio.findUnique({
    where: { id: domicilioId },
    select: { estado: true },
  });
  if (!domicilio) return { error: "Ese domicilio ya no existe.", ok: null };
  if (
    domicilio.estado !== ESTADO_DOMICILIO.PENDIENTE &&
    domicilio.estado !== ESTADO_DOMICILIO.ASIGNADO
  ) {
    return { error: "Ese domicilio ya no se puede reasignar.", ok: null };
  }

  await db.domicilio.update({
    where: { id: domicilioId },
    data: {
      domiciliarioId,
      estado: ESTADO_DOMICILIO.ASIGNADO,
      asignadoAt: new Date(),
    },
  });

  revalidarDomicilios();
  return { error: null, ok: `Asignado a ${repartidor.nombre}.` };
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
  if (
    domicilio.estado !== ESTADO_DOMICILIO.PENDIENTE &&
    domicilio.estado !== ESTADO_DOMICILIO.ASIGNADO
  ) {
    return {
      error: "Ese domicilio ya salió a la calle: no se puede cancelar.",
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

/** La cocina/empaque terminó: ENVIADO → EN_PREPARACION → SERVIDO en un toque */
export async function marcarListaDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede marcar comandas lista.", ok: null };
  }

  const pedidoId = Number.parseInt(String(datos.get("pedidoId") ?? ""), 10);
  if (!Number.isInteger(pedidoId)) {
    return { error: "Comanda inválida.", ok: null };
  }

  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    include: { mesa: { select: { esDomicilio: true } } },
  });
  if (!pedido || !pedido.mesa?.esDomicilio) {
    return { error: "Esa comanda no es de domicilios.", ok: null };
  }
  if (
    pedido.estado !== ESTADO_PEDIDO.ENVIADO &&
    pedido.estado !== ESTADO_PEDIDO.EN_PREPARACION &&
    pedido.estado !== ESTADO_PEDIDO.PARCIAL_SERVIDO
  ) {
    return { error: null, ok: "Esa comanda ya estaba lista." };
  }

  await db.$transaction(async (tx) => {
    if (pedido.estado === ESTADO_PEDIDO.ENVIADO) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { estado: ESTADO_PEDIDO.EN_PREPARACION },
      });
    }
    await tx.pedido.update({
      where: { id: pedidoId },
      data: { estado: ESTADO_PEDIDO.SERVIDO },
    });
  });

  revalidarDomicilios();
  return { error: null, ok: "Comanda lista para empaque: ya puede salir." };
}

/** El intento falló pero se reintenta con la misma comida: NO_ENTREGADO → ASIGNADO */
export async function reintentarDomicilio(
  _previa: EstadoAccionDomicilio,
  datos: FormData,
): Promise<EstadoAccionDomicilio> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede reintentar entregas.", ok: null };
  }

  const domicilioId = Number.parseInt(String(datos.get("domicilioId") ?? ""), 10);
  if (!Number.isInteger(domicilioId)) {
    return { error: "Domicilio inválido.", ok: null };
  }

  const domicilio = await db.domicilio.findUnique({
    where: { id: domicilioId },
    select: {
      estado: true,
      pedidoId: true,
      pedido: { select: { estado: true } },
    },
  });
  if (!domicilio) return { error: "Ese domicilio ya no existe.", ok: null };
  if (domicilio.estado !== ESTADO_DOMICILIO.NO_ENTREGADO) {
    return { error: "Solo los no entregados se pueden reintentar.", ok: null };
  }

  await db.$transaction(async (tx) => {
    await tx.domicilio.update({
      where: { id: domicilioId },
      data: {
        estado: ESTADO_DOMICILIO.ASIGNADO,
        notaEntrega: null,
        asignadoAt: new Date(),
      },
    });
    // La comida no se desechará: la comanda vuelve a "lista" (ya estaba
    // cocinada cuando falló la entrega)
    if (domicilio.pedido.estado === ESTADO_PEDIDO.CANCELADO) {
      await tx.pedido.update({
        where: { id: domicilio.pedidoId },
        data: { estado: ESTADO_PEDIDO.SERVIDO },
      });
    }
  });

  revalidarDomicilios();
  return { error: null, ok: "Reintento listo: queda por salir con el mismo domiciliario." };
}
