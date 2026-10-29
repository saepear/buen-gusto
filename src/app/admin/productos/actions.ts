"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ES_TIPO_VALIDO } from "@/lib/roles";
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
  if (!ES_TIPO_VALIDO(tipo)) return { error: "Selecciona un tipo válido." };
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
  revalidatePath("/cocina");
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
