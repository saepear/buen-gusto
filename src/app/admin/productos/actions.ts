"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  getCategoriasPersonalizadas,
  MAX_CATEGORIAS,
  setCategoriasPersonalizadas,
} from "@/lib/config";
import { ICONO_CATEGORIA_DEFECTO, ICONOS_CATEGORIA } from "@/lib/iconos";
import { ES_TIPO_VALIDO, TIPO_PRODUCTO, TIPO_PRODUCTO_LABEL } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";

export type EstadoAccion = { error: string | null; ok?: string };

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

  try {
    await db.producto.create({ data: { nombre, tipo, precio } });
  } catch (e: unknown) {
    if (String(e).includes("Unique")) {
      return { error: `Ya existe un producto llamado «${nombre}».` };
    }
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

  try {
    await db.producto.update({ where: { id }, data: { nombre, precio } });
  } catch {
    return { error: "No se pudo guardar el cambio." };
  }

  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
  return { error: null, ok: "Producto actualizado." };
}

/** Eliminar un producto del catálogo: es un despido suave. La fila sigue
 *  existiendo (el historial de comandas no se rompe), solo se oculta de la
 *  app y si estaba en el menú del día se le quita también de HOY. */
export async function eliminarProducto(datos: FormData): Promise<void> {
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

/** Reactivar un producto que ya se había eliminado (el historial se conserva) */
export async function reactivarProducto(datos: FormData): Promise<void> {
  await exigirAdmin();
  const id = Number.parseInt(String(datos.get("id") ?? ""), 10);
  if (!Number.isInteger(id)) return;
  await db.producto.update({ where: { id }, data: { activo: true } });
  revalidatePath("/admin/productos");
  revalidatePath("/admin/menu-dia");
}

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

/** Borrar una categoría propia. Solo sale si ya no tiene productos activos:
 *  así nadie queda con tipo huérfano sin que el admin lo vea. */
export async function eliminarCategoria(
  _previa: EstadoAccion,
  datos: FormData,
): Promise<EstadoAccion> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "No autorizado." };
  }

  const nombre = String(datos.get("nombre") ?? "");
  if (!nombre) return { error: "Categoría inválida." };

  try {
    const enUso = await db.producto.count({
      where: { tipo: nombre, activo: true },
    });
    if (enUso > 0)
      return {
        error: `«${nombre}» tiene ${enUso} producto${enUso === 1 ? "" : "s"} en el catálogo: elimina primero esos productos.`,
      };
    const actuales = await getCategoriasPersonalizadas();
    await setCategoriasPersonalizadas(
      actuales.filter((c) => c.nombre.toLowerCase() !== nombre.toLowerCase()),
    );
  } catch {
    return { error: "No se pudo eliminar la categoría." };
  }

  revalidatePath("/admin/productos");
  return { error: null, ok: `Categoría «${nombre}» eliminada.` };
}
