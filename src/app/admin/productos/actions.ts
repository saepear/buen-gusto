"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nombreCanonico } from "@/lib/clientes";
import {
  CLAVE_CATEGORIAS,
  getCategoriasPersonalizadas,
  MAX_CATEGORIAS,
  setCategoriasPersonalizadas,
} from "@/lib/config";
import { ICONO_CATEGORIA_DEFECTO, ICONOS_CATEGORIA } from "@/lib/iconos";
import { ES_TIPO_VALIDO, TIPO_PRODUCTO, TIPO_PRODUCTO_LABEL, ESTADO_APARTADO } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";

export type EstadoAccion = { error: string | null; ok?: string };

type Tx = Prisma.TransactionClient;

/** Crear un producto del catálogo */
export async function crearProducto(
  _previa: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "No autorizado." };
  }

  const nombre = String(datos.get("nombre") ?? "").trim();
  const tipo = String(datos.get("tipo") ?? "");
  const precio = Number.parseInt(String(datos.get("precio") ?? "0"), 10);

  if (nombre.length < 2) return { error: "Nombra el producto (mínimo 2 letras)." };
  // Tipo fijo del sistema o una categoría propia (p. ej. «Especiales»)
  const valido =
    ES_TIPO_VALIDO(tipo) ||
    (await getCategoriasPersonalizadas()).some((c) => c.nombre === tipo);
  if (!valido) return { error: "Selecciona un tipo válido." };
  if (!Number.isInteger(precio) || precio < 0 || precio > 9_999_999)
    return { error: "El precio debe ser entero en COP (0 = incluido en el almuerzo)." };

  // Duplicados: el catálogo no es grande; se compara canonizado en JS
  // (SQLite no soporta comparación sin acentos en el índice).
  const nombres = await db.producto.findMany({ select: { nombre: true } });
  const canon = nombreCanonico(nombre);
  if (nombres.some((p) => nombreCanonico(p.nombre) === canon)) {
    return { error: `Ya existe un producto llamado «${nombre}».` };
  }

  try {
    await db.producto.create({ data: { nombre, tipo, precio } });
  } catch {
    return { error: "No se pudo crear el producto." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
  return { error: null, ok: `Producto «${nombre}» creado.` };
}

/** Editar nombre y precio de un producto */
export async function editarProducto(
  _previa: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "No autorizado." };
  }

  const id = Number.parseInt(String(datos.get("id") ?? ""), 10);
  const nombre = String(datos.get("nombre") ?? "").trim();
  const precio = Number.parseInt(String(datos.get("precio") ?? "0"), 10);
  if (!Number.isInteger(id)) return { error: "Producto inválido." };
  if (nombre.length < 2) return { error: "Nombra el producto (mínimo 2 letras)." };
  if (!Number.isInteger(precio) || precio < 0 || precio > 9_999_999)
    return { error: "El precio debe ser entero en COP." };

  // rename a un nombre ya usado por OTRO producto
  const otros = await db.producto.findMany({
    where: { id: { not: id } },
    select: { nombre: true },
  });
  const canon = nombreCanonico(nombre);
  if (otros.some((p) => nombreCanonico(p.nombre) === canon)) {
    return { error: `Ya existe otro producto llamado «${nombre}».` };
  }

  try {
    await db.producto.update({ where: { id }, data: { nombre, precio } });
  } catch {
    return { error: "No se pudo guardar el cambio." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
  return { error: null, ok: "Producto actualizado." };
}

/** Desactivación TEMPORAL (no se llama «Eliminar»): la fila sigue en la BD y
 *  se puede reactivar. Saca el producto del salón/domicilios y de todos los
 *  menús donde esté configurado. El historial de comandas no se toca. */
export async function desactivarProducto(datos: FormData): Promise<void> {
  await exigirAdmin();
  const id = Number.parseInt(String(datos.get("id") ?? ""), 10);
  if (!Number.isInteger(id)) return;

  await db.$transaction([
    db.menuDiaItem.deleteMany({ where: { productoId: id } }),
    db.producto.update({ where: { id }, data: { activo: false } }),
  ]);

  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
  revalidatePath("/mesero");
  revalidatePath("/ordenes");
}

/** Reactivar un producto desactivado */
export async function reactivarProducto(datos: FormData): Promise<void> {
  await exigirAdmin();
  const id = Number.parseInt(String(datos.get("id") ?? ""), 10);
  if (!Number.isInteger(id)) return;
  await db.producto.update({ where: { id }, data: { activo: true } });
  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
}

// ─── Eliminación DEFINITIVA de productos ─────────────────────────────────────

/** Live data para el diálogo de confirmación del borrado físico */
export type DetalleEliminacionProducto = {
  id: number;
  nombre: string;
  tipo: string;
  precio: number;
  activo: boolean;
  /** Líneas de venta históricas (PedidoItem) que referencian el producto */
  referenciasHistoricas: number;
  /** Entradas en el Menú del día (todas las fechas) */
  entradasMenu: number;
  /** Apartados PENDIENTES que lo necesitan: no se puede borrar hasta
   *  entregarlos/editarlos/cancelarlos */
  apartadosPendientes: {
    id: number;
    cliente: string;
    fechaEntrega: string;
    /** Por qué lo bloquea: reservas de porciones, línea del apartado o
     *  adicionales congelados dentro del plato */
    motivos: string;
  }[];
};

/** Apartados PENDIENTES que dependen de alguno de estos productos */
async function bloqueosDeApartadosPendientes(productoIds: number[]) {
  const estadoPendiente = ESTADO_APARTADO.PENDIENTE;
  const [reservas, items] = await Promise.all([
    db.apartadoReserva.findMany({
      where: { productoId: { in: productoIds }, apartado: { estado: estadoPendiente } },
      select: { cantidad: true, apartado: { select: { id: true, fechaEntrega: true, cliente: { select: { nombre: true } } } } },
    }),
    db.apartadoItem.findMany({
      where: { productoId: { in: productoIds }, apartado: { estado: estadoPendiente } },
      select: { cantidad: true, nombre: true, apartado: { select: { id: true, fechaEntrega: true, cliente: { select: { nombre: true } } } } },
    }),
  ]);

  const porApartado = new Map<number, { id: number; cliente: string; fechaEntrega: string; motivos: string[] }>();
  const registrar = (
    apartado: { id: number; fechaEntrega: string | null; cliente: { nombre: string } },
    motivo: string,
  ) => {
    const fila = porApartado.get(apartado.id) ?? {
      id: apartado.id,
      cliente: apartado.cliente.nombre,
      fechaEntrega: apartado.fechaEntrega ?? "(sin fecha)",
      motivos: [],
    };
    if (!fila.motivos.includes(motivo)) fila.motivos.push(motivo);
    porApartado.set(apartado.id, fila);
  };
  for (const r of reservas) registrar(r.apartado, `reservas de porciones (${r.cantidad} unidades)`);
  for (const it of items) registrar(it.apartado, `línea «${it.nombre}» en el apartado`);

  // Adicionales congelados en el JSON del plato (no son reservas ni filas)
  const itemsConDetalle = await db.apartadoItem.findMany({
    where: {
      apartado: { estado: estadoPendiente },
      tipo: { in: ["ALMUERZO", "ALMUEZO"] },
      detalle: { not: null },
    },
    select: { detalle: true, apartado: { select: { id: true, fechaEntrega: true, cliente: { select: { nombre: true } } } } },
  });
  const buscar = new Set(productoIds);
  for (const item of itemsConDetalle) {
    try {
      const d = JSON.parse(item.detalle ?? "null") as {
        adicionales?: { productoId: number }[];
      } | null;
      if (!d?.adicionales) continue;
      for (const a of d.adicionales) {
        if (buscar.has(a.productoId)) {
          registrar(item.apartado, "adicional congelado dentro del plato");
          break;
        }
      }
    } catch {
      // JSON corrupto: no bloquea ni falla
    }
  }

  return [...porApartado.values()].map((a) => ({
    id: a.id,
    cliente: a.cliente,
    fechaEntrega: a.fechaEntrega,
    motivos: a.motivos.join("; "),
  }));
}

/** Datos del día 0 del diálogo: el cliente llama esta acción al abrirlo */
export async function detallesEliminacionProducto(
  productoId: number,
): Promise<DetalleEliminacionProducto | null> {
  try {
    await exigirAdmin();
  } catch {
    return null;
  }
  if (!Number.isInteger(productoId)) return null;
  const producto = await db.producto.findUnique({
    where: { id: productoId },
    select: { id: true, nombre: true, tipo: true, precio: true, activo: true },
  });
  if (!producto) return null;
  const [referenciasHistoricas, entradasMenu, apartadosPendientes] = await Promise.all([
    db.pedidoItem.count({ where: { productoId: productoId } }),
    db.menuDiaItem.count({ where: { productoId: productoId } }),
    bloqueosDeApartadosPendientes([productoId]),
  ]);
  return { ...producto, referenciasHistoricas, entradasMenu, apartadosPendientes };
}

/** Borra físicamente las referencias/catálogo de UN producto dentro de una
 *  transacción (los apartados pendientes YA fueron bloqueados fuera). */
async function purgarReferenciasDeProducto(tx: Tx, productoId: number): Promise<number> {
  // 1) Historial de ventas: la FK pasa a null y la FOTO (productoNombre, tipo,
  //    precio congelado, notas, grupos) conserva la línea completa
  await tx.pedidoItem.updateMany({
    where: { productoId: productoId },
    data: { productoId: null },
  });
  // 2) Reservas históricas de porciones (apartados ya entregados/cancelados)
  await tx.apartadoReserva.updateMany({
    where: { productoId: productoId },
    data: { productoId: null },
  });
  // 3) Líneas de apartados históricos: su nombre/precio quedan congelados
  await tx.apartadoItem.updateMany({
    where: { productoId: productoId },
    data: { productoId: null },
  });
  // 4) El producto sale de TODOS los menús (todas las fechas)
  const menues = await tx.menuDiaItem.deleteMany({
    where: { productoId: productoId },
  });
  // 5) La fila del catálogo desaparece
  await tx.producto.delete({ where: { id: productoId } });
  return menues.count;
}

/** Eliminación DEFINITIVA: la fila de Producto desaparece de la BD. La
 *  re-verificación de dependencias corre SIEMPRE en el servidor, aunque el
 *  diálogo ya mostrara los contajes. */
export async function eliminarProductoDefinitivamente(
  _previa: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "No autorizado." };
  }

  const id = Number.parseInt(String(datos.get("id") ?? ""), 10);
  if (!Number.isInteger(id)) return { error: "Producto inválido." };

  try {
    const producto = await db.producto.findUnique({ where: { id } });
    if (!producto) return { error: "Ese producto ya no existe." };

    const bloqueos = await bloqueosDeApartadosPendientes([id]);
    if (bloqueos.length > 0) {
      const lista = bloqueos
        .map(
          (b) =>
            `Apartado #${b.id} de ${b.cliente} (entrega ${b.fechaEntrega}): ${b.motivos}`,
        )
        .join(" · ");
      return {
        error: `No se puede eliminar: ${bloqueos.length} apartado${
          bloqueos.length === 1 ? "" : "s"
        } pendiente${bloqueos.length === 1 ? "" : "s"} lo necesita. Resuelve primero ${lista}.`,
      };
    }

    const entradasMenu = await db.menuDiaItem.count({ where: { productoId: id } });
    await db.$transaction(async (tx) => {
      await purgarReferenciasDeProducto(tx, id);
    });

    revalidarTodo();
    return {
      error: null,
      ok: `«${producto.nombre}» eliminado definitivamente${
        entradasMenu > 0 ? ` (salía de ${entradasMenu} entradas de menú)` : ""
      }. El historial de ventas conserva su nombre y precios.`,
    };
  } catch {
    return { error: "No se pudo eliminar el producto. Intenta otra vez." };
  }
}

// ─── Categorías propias ──────────────────────────────────────────────────────

/** Crear una categoría propia del cliente (p. ej. «Especiales») con su
 *  icono. Se guarda en Configuracion; sus productos entran al menú del día
 *  con porciones y su sitio en el constructor del plato. */
export async function crearCategoria(
  _previa: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "No autorizado." };
  }

  const nombre = String(datos.get("nombre") ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
  if (nombre.length < 2)
    return { error: "El nombre debe tener de 2 a 24 letras." };
  let icono = String(datos.get("icono") ?? ICONO_CATEGORIA_DEFECTO);
  if (!(icono in ICONOS_CATEGORIA)) icono = ICONO_CATEGORIA_DEFECTO;

  try {
    const actuales = await getCategoriasPersonalizadas();
    if (actuales.length >= MAX_CATEGORIAS)
      return { error: `Máximo ${MAX_CATEGORIAS} categorías propias.` };
    if (
      actuales.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase()) ||
      [...Object.values(TIPO_PRODUCTO), ...Object.values(TIPO_PRODUCTO_LABEL)].some(
        (r) => r.toLowerCase() === nombre.toLowerCase(),
      )
    )
      return { error: `Ya existe una categoría «${nombre}».` };
    await setCategoriasPersonalizadas([...actuales, { nombre, icono }]);
  } catch {
    return { error: "No se pudo crear la categoría." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
  return { error: null, ok: `Categoría «${nombre}» creada.` };
}

/** Cambiar el icono de una categoría propia (desde su chip en el panel) */
export async function cambiarIconoCategoria(
  _previa: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "No autorizado." };
  }

  const nombre = String(datos.get("nombre") ?? "");
  const icono = String(datos.get("icono") ?? "");
  if (!nombre || !(icono in ICONOS_CATEGORIA))
    return { error: "Elige un icono de la lista." };

  try {
    const actuales = await getCategoriasPersonalizadas();
    const indice = actuales.findIndex(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase(),
    );
    if (indice < 0) return { error: "Esa categoría ya no existe." };
    await setCategoriasPersonalizadas(
      actuales.map((c, i) =>
        i === indice ? { nombre: c.nombre, icono } : c,
      ),
    );
  } catch {
    return { error: "No se pudo actualizar el icono." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
  return { error: null, ok: `Icono de «${nombre}» actualizado.` };
}

/** Datos del diálogo «Eliminar categoría definitivamente» */
export type DetalleEliminacionCategoria = {
  nombre: string;
  productosActivos: number;
  productosInactivos: number;
  referenciasHistoricas: number;
  apartadosPendientes: {
    id: number;
    cliente: string;
    fechaEntrega: string;
    motivos: string;
  }[];
};

/** Live data para el diálogo de la categoría (activos + inactivos + bloqueos) */
export async function detallesEliminacionCategoria(
  nombreCategoria: string,
): Promise<DetalleEliminacionCategoria | null> {
  try {
    await exigirAdmin();
  } catch {
    return null;
  }
  const nombre = nombreCategoria.trim();
  if (!nombre) return null;
  const productos = await db.producto.findMany({
    where: { tipo: nombre },
    select: { id: true, activo: true },
  });
  const ids = productos.map((p) => p.id);
  const [referenciasHistoricas, apartadosPendientes] = ids.length
    ? await Promise.all([
        db.pedidoItem.count({ where: { productoId: { in: ids } } }),
        bloqueosDeApartadosPendientes(ids),
      ])
    : [0, []];
  return {
    nombre,
    productosActivos: productos.filter((p) => p.activo).length,
    productosInactivos: productos.filter((p) => !p.activo).length,
    referenciasHistoricas,
    apartadosPendientes,
  };
}

/** Eliminación COMPLETA de una categoría propia: sus productos (activos e
 *  inactivos) se borran del catálogo con las reglas de protección histórica,
 *  la entrada se quita de Configuracion y la mesa queda sin un solo
 *  producto «huérfano» de esa categoría. */
export async function eliminarCategoriaDefinitivamente(
  _previa: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "No autorizado." };
  }

  const nombre = String(datos.get("nombre") ?? "").trim();
  if (!nombre) return { error: "Categoría inválida." };

  try {
    const productos = await db.producto.findMany({ where: { tipo: nombre } });
    const ids = productos.map((p) => p.id);

    if (ids.length > 0) {
      const bloqueos = await bloqueosDeApartadosPendientes(ids);
      if (bloqueos.length > 0) {
        const lista = bloqueos
          .map(
            (b) =>
              `Apartado #${b.id} de ${b.cliente} (entrega ${b.fechaEntrega}): ${b.motivos}`,
          )
          .join(" · ");
        return {
          error: `No se puede eliminar: hay apartados pendientes que necesitan productos de «${nombre}». Resuelve primero ${lista}.`,
        };
      }
    }

    const refs = ids.length
      ? await db.pedidoItem.count({ where: { productoId: { in: ids } } })
      : 0;
    // La lista fresca se lee FUERA de la transacción y se escribe DENTRO con
    // el cliente de la tx: si algo falla, ni catálogo ni configuración cambian
    const actuales = await getCategoriasPersonalizadas();
    const restantes = actuales.filter(
      (c) => c.nombre.toLowerCase() !== nombre.toLowerCase(),
    );

    await db.$transaction(async (tx) => {
      for (const id of ids) {
        await purgarReferenciasDeProducto(tx, id);
      }
      const valor = JSON.stringify(restantes);
      await tx.configuracion.upsert({
        where: { clave: CLAVE_CATEGORIAS },
        create: { clave: CLAVE_CATEGORIAS, valor },
        update: { valor },
      });
      // Assert duro: no puede quedar un solo producto con ese tipo
      const quedan = await tx.producto.count({ where: { tipo: nombre } });
      if (quedan > 0) {
        throw new Error(`Quedaron ${quedan} productos huérfanos de ${nombre}`);
      }
    });

    revalidarTodo();
    const detalleProductos = productos.length
      ? `${productos.length} producto${productos.length === 1 ? "" : "s"} (activos e inactivos) `
      : "";
    return {
      error: null,
      ok: `Categoría «${nombre}» eliminada: ${detalleProductos}borrados del catálogo${
        refs > 0
          ? `, ${refs} línea${refs === 1 ? "" : "s"} de ventas históricas preservadas con su nombre`
          : ""
      }.`,
    };
  } catch {
    return { error: "No se pudo eliminar la categoría. Intenta otra vez." };
  }
}

function revalidarTodo() {
  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
  revalidatePath("/admin/apartados");
  revalidatePath("/mesero");
  revalidatePath("/ordenes");
}
