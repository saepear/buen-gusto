"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { minutosDeHora } from "@/lib/hora";
import { precioAlmuerzo, precioEspecialDelDia } from "@/lib/precios";
import { ES_METODO_PAGO, ESTADO_APARTADO } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import { buscarClientesPagina, coincidenciasDeCliente, crearClienteNuevo, telefonoNormalizado, type ClienteResumen } from "@/lib/clientes";

export type EstadoAccionApartado = { error: string | null; ok: string | null };

class ErrorDeApartado extends Error {}

/** El nombre de la mesa virtual sobre la que nace la comanda del apartado */
const MESA_APARTADOS = "Apartados";

/** Los apartados se recogen: salen para llevar de fábrica */
const PARA_LLEVAR = true;

const CANTIDAD_MAX = 50;
const ITEM_OTRO_MAX = 60;

// ─── Carga del formulario ─────────────────────────────────────────────────────

export type LineaAlmuerzoApartado = {
  conSopa: boolean;
  proteinaProductoId: number;
  cantidad: number;
  nota?: string;
};

export type ExtraApartado = { productoId: number; cantidad: number };

export type OtroApartado = {
  nombre: string;
  precio: number;
  cantidad: number;
  nota?: string;
};

export type CargaApartado = {
  clienteId: number;
  fechaEntrega?: string; // yyyy-mm-dd (opcional: hoy si no cabe)
  horaEntrega?: string; // como lo dijo el cliente («12:30», «la 1 y media»)
  lineas: LineaAlmuerzoApartado[];
  extras: ExtraApartado[];
  otros: OtroApartado[];
  observaciones?: string;
};

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");
}

// ─── Crear ──────────────────────────────────────────────────────────────────

/** Valores congelados de UNA línea, calculados en el servidor */
type FilaCongelada = {
  productoId: number | null;
  nombre: string;
  tipo: string;
  cantidad: number;
  precio: number;
  conSopa: boolean | null;
  nota: string | null;
  /** menú de hoy (itemid) si la proteína es del menú, para avisar stock en la entrega */
  proteinaDeHoy: number | null;
};

/**
 * Registra un apartado: el TOTAL queda congelado al apartar con los precios
 * de este momento (así el menú puede cambiar antes de la entrega); nada de
 * esto toca la caja todavía.
 */
export async function crearApartado(
  _previa: EstadoAccionApartado,
  datos: FormData,
): Promise<EstadoAccionApartado> {
  let adminId: number;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador registra apartados.", ok: null };
  }

  let carga: CargaApartado | null = null;
  try {
    carga = JSON.parse(String(datos.get("datos") ?? "")) as CargaApartado;
  } catch {
    carga = null;
  }
  if (!carga) {
    return {
      error: "Datos del apartado corruptos. Recarga la página.",
      ok: null,
    };
  }

  // Cliente
  const clienteId = Number.parseInt(String(carga.clienteId ?? ""), 10);
  if (!Number.isInteger(clienteId)) {
    return { error: "Escoge el cliente del apartado.", ok: null };
  }
  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { nombre: true },
  });
  if (!cliente) {
    return { error: "Ese cliente ya no existe. Recarga la página.", ok: null };
  }

  // Fecha/hora de entrega (opcional; sin fecha = hoy)
  const fechaEntrega =
    typeof carga.fechaEntrega === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(carga.fechaEntrega)
      ? carga.fechaEntrega
      : null;
  const horaEntrega = String(carga.horaEntrega ?? "").trim().slice(0, 30) || null;
  const horaMin = horaEntrega ? minutosDeHora(horaEntrega) : null;

  // ── Lineas de almuerzo: precios congelados desde el menú de HOY
  const lineas = Array.isArray(carga.lineas) ? carga.lineas.slice(0, 30) : [];
  const extras = Array.isArray(carga.extras) ? carga.extras.slice(0, 50) : [];
  const otros = Array.isArray(carga.otros) ? carga.otros.slice(0, 20) : [];

  if (lineas.length === 0 && otros.length === 0) {
    return { error: "Aparta al menos un almuerzo o un ítem.", ok: null };
  }

  // El menú de hoy: sin él no sobra apartar almuerzos del menú (pero sí ítems narrados)
  const fecha = new Date();
  const fechaHoy = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
  const menu = await db.menuDia.findUnique({
    where: { fecha: fechaHoy },
    include: { items: { include: { producto: true } } },
  });

  const porProducto = new Map<number, { id: number; nombre: string; precios: number }>();
  if (menu) {
    for (const item of menu.items) {
      if (!item.producto.activo || !item.visible || item.producto.tipo !== "PROTEINA") continue;
      porProducto.set(item.productoId, {
        id: item.id,
        nombre: item.producto.nombre,
        precios:
          item.precioEspecial ??
          (item.producto.precio > 0 ? item.producto.precio : 0),
      });
    }
  }

  const filas: FilaCongelada[] = [];

  for (const linea of lineas) {
    const proteina = porProducto.get(Number(linea.proteinaProductoId));
    if (!proteina) {
      return {
        error: "Una proteína ya no está en el menú de hoy. Recarga la página.",
        ok: null,
      };
    }
    const cantidad = Number(linea.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAX) {
      return { error: "La cantidad no es válida (1 a 50).", ok: null };
    }
    if (typeof linea.conSopa !== "boolean") {
      return { error: "Aclara si el almuerzo lleva sopa o no.", ok: null };
    }
    // Congelar el precio AHORA: especial del día (asados de domingo…) o
    // almuerzo corriente para llevar (completo $14.500 · bandeja $13.000)
    const precio =
      proteina.precios > 0
        ? precioEspecialDelDia(proteina.precios, linea.conSopa, PARA_LLEVAR)
        : precioAlmuerzo(linea.conSopa, PARA_LLEVAR);
    filas.push({
      productoId: linea.proteinaProductoId,
      nombre: proteina.nombre,
      tipo: "ALMUEZO",
      cantidad,
      precio,
      conSopa: linea.conSopa,
      nota: String(linea.nota ?? "").trim().slice(0, ITEM_OTRO_MAX) || null,
      proteinaDeHoy: proteina.id,
    });
  }

  // ── Extras (bebidas/adicionales del catálogo)
  if (extras.length > 0) {
    const catalogo = await db.producto.findMany({
      where: {
        id: { in: [...new Set(extras.map((e) => Number(e.productoId)))] },
        activo: true,
        tipo: { in: ["BEBIDA", "ADICIONAL"] },
        precio: { gt: 0 },
      },
    });
    for (const e of extras) {
      const p = catalogo.find((x) => x.id === Number(e.productoId));
      if (!p) {
        return {
          error: "Una bebida o adicional ya no está disponible. Recarga.",
          ok: null,
        };
      }
      const cantidad = Number(e.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAX) {
        return { error: "La cantidad de «" + p.nombre + "» no es válida.", ok: null };
      }
      filas.push({
        productoId: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        cantidad,
        precio: p.precio,
        conSopa: null,
        nota: null,
        proteinaDeHoy: null,
      });
    }
  }

  // ── Ítems narrados a mano (no vienen del catálogo)
  for (const o of otros) {
    const nombre = String(o.nombre ?? "").trim().slice(0, 60);
    const precio = Number(String(o.precio ?? "").replace(/[^0-9]/g, ""));
    const cantidad = Number(o.cantidad);
    if (nombre.length < 2) {
      return { error: "Escribe el nombre del ítem adicional.", ok: null };
    }
    if (!Number.isInteger(precio) || precio < 0 || precio > 5_000_000) {
      return { error: `El precio de «${nombre}» no es válido.`, ok: null };
    }
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAX) {
      return { error: `La cantidad de «${nombre}» no es válida.`, ok: null };
    }
    filas.push({
      productoId: null,
      nombre,
      tipo: "OTRO",
      cantidad,
      precio,
      conSopa: null,
      nota: String(o.nota ?? "").trim().slice(0, ITEM_OTRO_MAX) || null,
      proteinaDeHoy: null,
    });
  }

  const total = filas.reduce((s, f) => s + f.precio * f.cantidad, 0);
  if (total <= 0) {
    return { error: "El apartado no puede valer $0.", ok: null };
  }
  if (total > 20_000_000) {
    return { error: "El total del apartado no es razonable.", ok: null };
  }

  const observaciones =
    String(carga.observaciones ?? "").trim().slice(0, 240) || null;

  let nuevoId: number;
  try {
    nuevoId = await db.$transaction(async (tx) => {
      const apartado = await tx.apartado.create({
        data: {
          clienteId,
          estado: ESTADO_APARTADO.PENDIENTE,
          fechaEntrega,
          horaEntrega,
          horaEntregaMinutos: horaMin,
          total,
          observaciones,
          createdById: adminId,
        },
      });
      await tx.apartadoItem.createMany({
        data: filas.map((f) => ({
          apartadoId: apartado.id,
          productoId: f.productoId,
          nombre: f.nombre,
          tipo: f.tipo,
          cantidad: f.cantidad,
          precio: f.precio,
          conSopa: f.conSopa,
          nota: f.nota,
        })),
      });
      return apartado.id;
    });
  } catch {
    return { error: "No se pudo guardar el apartado. Intenta otra vez.", ok: null };
  }

  revalidar();
  return {
    error: null,
    ok: `Apartado #${nuevoId} de ${cliente.nombre} por ${formatCOP(total)} guardado (entrega a ${horaEntrega ?? "más tarde"}).`,
  };
}

// ─── Cancelar ───────────────────────────────────────────────────────────────

/** Cancela un apartado pendiente (sin tocar stock ni caja) */
export async function cancelarApartado(
  _previa: EstadoAccionApartado,
  datos: FormData,
): Promise<EstadoAccionApartado> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador cancela apartados.", ok: null };
  }
  const apartadoId = Number.parseInt(String(datos.get("apartadoId") ?? ""), 10);
  if (!Number.isInteger(apartadoId)) {
    return { error: "Apartado inválido.", ok: null };
  }
  const apartado = await db.apartado.findUnique({
    where: { id: apartadoId },
    select: { estado: true },
  });
  if (!apartado) return { error: "Ese apartado ya no existe.", ok: null };
  if (apartado.estado !== ESTADO_APARTADO.PENDIENTE) {
    return { error: "Solo se cancelan los apartados que no se han entregado.", ok: null };
  }
  await db.apartado.update({
    where: { id: apartadoId },
    data: { estado: ESTADO_APARTADO.CANCELADO },
  });
  revalidar();
  return { error: null, ok: "Apartado cancelado." };
}

// ─── Entregar (cobrado o fiado) ──────────────────────────────────────────────

/**
 * Entrega un apartado: nace la comanda (cocina la ve en Órdenes, la mesa
 * queda LIBRE para que la caja no la muestre), los precios CONGELADOS del
 * apartado viajan tal cual y el stock solo se descuenta si la proteína está
 * en el menú del día de entrega. Con metodo = cobro (sale el recibo), sin
 * método queda fiado (nace la deuda «Apartado #N»).
 */
export async function entregarApartado(
  _previa: EstadoAccionApartado,
  datos: FormData,
): Promise<EstadoAccionApartado> {
  let adminId: number;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador entrega apartados.", ok: null };
  }

  const apartadoId = Number.parseInt(String(datos.get("apartadoId") ?? ""), 10);
  if (!Number.isInteger(apartadoId)) {
    return { error: "Apartado inválido.", ok: null };
  }
  const crudoMetodo = String(datos.get("metodo") ?? "");
  const fiado = crudoMetodo === "";
  if (!fiado && !ES_METODO_PAGO(crudoMetodo)) {
    return { error: "Elige el método con que paga.", ok: null };
  }

  const apartado = await db.apartado.findUnique({
    where: { id: apartadoId },
    include: { items: true, cliente: true },
  });
  if (!apartado) return { error: "Ese apartado ya no existe.", ok: null };
  if (apartado.estado !== ESTADO_APARTADO.PENDIENTE) {
    return { error: "Ese apartado ya se entregó o se canceló.", ok: null };
  }
  if (apartado.items.every((i) => i.cantidad < 1)) {
    return { error: "El apartado no tiene ítems con entrega.", ok: null };
  }

  // Menú del día de entrega (hoy, al ejecutarse la entrega)
  const fechaHoy = new Date();
  const fechaHoyClave = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, "0")}-${String(fechaHoy.getDate()).padStart(2, "0")}`;
  const menuHoy = await db.menuDia.findUnique({
    where: { fecha: fechaHoyClave },
    include: { items: { include: { producto: true } } },
  });

  const productosDeHoy = new Map<
    number,
    { itemId: number; tipo: string; nombre: string }
  >();
  if (menuHoy) {
    for (const item of menuHoy.items) {
      if (!item.producto.activo || !item.visible) continue;
      productosDeHoy.set(item.productoId, {
        itemId: item.id,
        tipo: item.producto.tipo,
        nombre: item.producto.nombre,
      });
    }
  }
  const sopasDeHoy = [...productosDeHoy.entries()]
    .filter(([, v]) => v.tipo === "SOPA")
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  const sopaDeHoy = sopasDeHoy[0] ?? null;

  // Lo que consume del menú de HOY: proteína y sopa de cada almuerzo
  const consumo = new Map<number, { nombre: string; cantidad: number }>();
  for (const item of apartado.items) {
    if (item.tipo !== "ALMUEZO") continue;
    const hoy = item.productoId ? productosDeHoy.get(item.productoId) : null;
    if (hoy) {
      const previa = consumo.get(hoy.itemId);
      consumo.set(hoy.itemId, {
        nombre: hoy.nombre,
        cantidad: (previa?.cantidad ?? 0) + item.cantidad,
      });
    }
    if (item.conSopa === true && sopaDeHoy) {
      const previa = consumo.get(sopaDeHoy[1].itemId);
      consumo.set(sopaDeHoy[1].itemId, {
        nombre: sopaDeHoy[1].nombre,
        cantidad: (previa?.cantidad ?? 0) + item.cantidad,
      });
    }
  }

  const narrados = apartado.items.filter((i) => i.tipo === "OTRO");
  const notaNarrados = narrados.length
    ? "Además del apartado: " +
      narrados
        .map((i) => `${i.cantidad > 1 ? `${i.cantidad}× ` : ""}${i.nombre}`)
        .join(", ")
    : null;
  const observaciones = [
    `Apartado #${apartado.id} · ${apartado.cliente.nombre}`,
    apartado.observaciones,
    notaNarrados,
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 480);

  let pagoCreadoId: number | null = null;

  try {
    pagoCreadoId = await db.$transaction(async (tx) => {
      // Mesa virtual de apartados (creada la primera vez que se entrega)
      const mesa = await tx.mesa.upsert({
        where: { nombre: MESA_APARTADOS },
        update: {},
        create: { nombre: MESA_APARTADOS, esApartado: true, activa: true },
      });

      // Descuento atómico de porciones (solo lo que está en el menú de hoy)
      for (const [itemId, { nombre, cantidad }] of consumo) {
        const afectados =
          await tx.$executeRaw`UPDATE MenuDiaItem SET vendidos = vendidos + ${cantidad} WHERE id = ${itemId} AND (stockPorciones IS NULL OR vendidos + ${cantidad} <= stockPorciones)`;
        if (afectados !== 1) {
          throw new ErrorDeApartado(
            `Hoy no alcanzan las porciones de ${nombre} para completar el apartado.`,
          );
        }
      }

      const pedido = await tx.pedido.create({
        data: {
          mesaId: mesa.id,
          meseroId: adminId,
          estado: "SERVIDO",
          paraLlevar: PARA_LLEVAR,
          observaciones,
        },
      });

      // Comandas: cada almuerzo es un grupo con la proteína y su sopa;
      // extras compartidos viajan en el grupo 0 con el precio congelado.
      const filasPedido: {
        productoId: number;
        tipo: string;
        cantidad: number;
        precio: number | null;
        conSopa: boolean | null;
        grupo: number;
      }[] = [];
      let grupo = 0;

      for (const item of apartado.items) {
        if (item.tipo !== "ALMUEZO" || !item.productoId) continue;
        for (let i = 0; i < item.cantidad; i++) {
          grupo += 1;
          filasPedido.push({
            productoId: item.productoId,
            tipo: "PROTEINA",
            cantidad: 1,
            precio: item.precio, // congelado al apartar
            conSopa: item.conSopa,
            grupo,
          });
          if (item.conSopa === true && sopaDeHoy) {
            filasPedido.push({
              productoId: sopaDeHoy[0],
              tipo: "SOPA",
              cantidad: 1,
              precio: 0,
              conSopa: null,
              grupo,
            });
          }
        }
      }

      for (const item of apartado.items) {
        if (!item.productoId || item.tipo === "ALMUEZO" || item.tipo === "OTRO") continue;
        filasPedido.push({
          productoId: item.productoId,
          tipo: item.tipo,
          cantidad: item.cantidad,
          precio: item.precio,
          conSopa: null,
          grupo: 0,
        });
      }

      if (filasPedido.length === 0 && narrados.length === 0) {
        throw new ErrorDeApartado("El apartado quedó sin líneas de comanda.");
      }
      await tx.pedidoItem.createMany({
        data: filasPedido.map((f) => ({
          pedidoId: pedido.id,
          productoId: f.productoId,
          tipo: f.tipo,
          cantidad: f.cantidad,
          precio: f.precio,
          conSopa: f.conSopa,
          grupo: f.grupo,
        })),
      });

      // La mesa queda LIBRE: la caja no debe listar apartados
      await tx.mesa.update({
        where: { id: mesa.id },
        data: { estado: "LIBRE" },
      });

      if (fiado) {
        const cuenta = await tx.cuentaPorCobrar.create({
          data: {
            clienteId: apartado.clienteId,
            concepto: `Apartado #${apartado.id}`,
            valorOriginal: apartado.total,
            pedidoId: pedido.id,
            createdById: adminId,
          },
        });
        await tx.apartado.update({
          where: { id: apartado.id },
          data: {
            estado: ESTADO_APARTADO.ENTREGADO,
            pedidoId: pedido.id,
            cuentaId: cuenta.id,
            entregadoAt: new Date(),
          },
        });
        return null;
      }

      const pago = await tx.pago.create({
        data: {
          pedidoId: pedido.id,
          total: apartado.total,
          propina: 0,
          metodo: crudoMetodo,
        },
      });
      await tx.pedido.update({
        where: { id: pedido.id },
        data: { estado: "COBRADO" },
      });
      await tx.apartado.update({
        where: { id: apartado.id },
        data: {
          estado: ESTADO_APARTADO.ENTREGADO,
          pedidoId: pedido.id,
          entregadoAt: new Date(),
        },
      });
      return pago.id;
    });
  } catch (e) {
    if (e instanceof ErrorDeApartado) {
      return { error: e.message, ok: null };
    }
    return { error: "No se pudo entregar el apartado. Intenta otra vez.", ok: null };
  }

  revalidar();
  if (pagoCreadoId !== null) {
    // redirigir al recibo del cobro
    redirect(`/admin/caja/recibo/${pagoCreadoId}`);
  }
  return { error: null, ok: "Apartado entregado y fiado. La deuda ya está en Cuentas por cobrar." };
}

// ─── Cliente rápido desde Apartados ──────────────────────────────────────────
// Mismas reglas de duplicados del módulo Clientes (lib/clientes.ts): nunca se
// reutiliza ni fusiona en silencio; si hay coincidencias se muestran y el
// administrador decide.

export type ClienteRapidoResultado = {
  error: string | null;
  ok: string | null;
  /** Fichas existentes que podrían ser el mismo cliente (para decidir) */
  coincidencias?: ClienteResumen[];
  /** Ficha creada: se selecciona al momento en el constructor */
  cliente?: { id: number; nombre: string; telefono: string };
};

/** Crea un cliente desde el constructor de apartados con decisión explícita:
 *  1.ª llamada sin `forzar`: si hay coincidencias las devuelve sin crear nada.
 *  2.ª llamada con `forzar: true`: crea la ficha nueva de todas formas. */
export async function crearClienteRapido(
  datos: {
    nombre: string;
    telefono: string;
    direccion?: string;
    barrio?: string;
    observaciones?: string;
    forzar?: boolean;
  },
): Promise<ClienteRapidoResultado> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador gestiona clientes.", ok: null };
  }

  const nombre = String(datos.nombre ?? "").trim().slice(0, 60);
  const telefono = String(datos.telefono ?? "").trim().slice(0, 24);
  if (nombre.length < 2) {
    return { error: "Escribe el nombre del cliente.", ok: null };
  }
  if (telefono && telefonoNormalizado(telefono).length < 7) {
    return {
      error: "El teléfono no es válido (7 dígitos o más); déjalo vacío si no lo sabe.",
      ok: null,
    };
  }

  const carga = {
    nombre,
    telefono,
    direccion: String(datos.direccion ?? "").trim().slice(0, 120),
    barrio: String(datos.barrio ?? "").trim().slice(0, 60) || null,
    observaciones: String(datos.observaciones ?? "").trim().slice(0, 300) || null,
  };

  if (!datos.forzar) {
    const coincidencias = await coincidenciasDeCliente(carga);
    if (coincidencias.length > 0) {
      // Sin fusión automática: el admin usa una ficha existente o insiste
      return { error: null, ok: null, coincidencias };
    }
  }

  const id = await crearClienteNuevo(carga);
  revalidatePath("/admin/clientes");
  return {
    error: null,
    ok: `Cliente registrado (#${id}).`,
    cliente: { id, nombre, telefono },
  };
}

/** Búsqueda paginada EN BASE (sin el límite de 300): alimenta el picker del
 *  constructor de apartados; nombre sin acentos y teléfono en dígitos. */
export async function buscarClientesApartado(
  term: string,
): Promise<{ id: number; nombre: string; telefono: string }[]> {
  try {
    await exigirAdmin();
  } catch {
    return [];
  }
  const { filas } = await buscarClientesPagina(term, 1, 12);
  return filas.map((f) => ({ id: f.id, nombre: f.nombre, telefono: f.telefono }));
}
