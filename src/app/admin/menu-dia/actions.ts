"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { TIPOS_MENU_DIA, type TipoProducto } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

function revalidar() {
  revalidatePath("/admin/menu-dia");
  revalidatePath("/admin");
  realtime.broadcast("update");
}

/** Crea el menú de HOY si todavía no existe y coloca los básicos de la casa */
export async function crearMenuHoy(): Promise<void> {
  await exigirAdmin();
  const fecha = claveDia(new Date());
  const menu = await db.menuDia.upsert({
    where: { fecha },
    update: {},
    create: { fecha },
  });

  // Los básicos que siempre estarán: asada de res y asada de cerdo de
  // proteína, más los frijoles de principio (si existen en el catálogo).
  const basicos = await db.producto.findMany({
    where: {
      activo: true,
      nombre: { in: ["Frijoles", "Asada de res", "Asada de cerdo"] },
    },
  });
  for (const p of basicos) {
    await db.menuDiaItem.upsert({
      where: {
        menuDiaId_productoId: { menuDiaId: menu.id, productoId: p.id },
      },
      update: {},
      create: { menuDiaId: menu.id, productoId: p.id, stockPorciones: 30 },
    });
  }

  revalidar();
}

/** Oculta o vuelve a mostrar un ítem del menú para el mesero (se acabó rápido) */
export async function alternarVisible(datos: FormData): Promise<void> {
  await exigirAdmin();
  const id = Number.parseInt(String(datos.get("itemId") ?? ""), 10);
  if (!Number.isInteger(id)) return;
  const item = await db.menuDiaItem.findUnique({ where: { id } });
  if (!item) return;

  await db.menuDiaItem.update({
    where: { id },
    data: { visible: !item.visible },
  });
  revalidar();
  revalidatePath("/mesero", "layout");
}

/** Guarda porciones o marca un ítem como ilimitado (fila completa del editor) */
export async function guardarPorcion(datos: FormData): Promise<void> {
  await exigirAdmin();
  const idTexto = String(datos.get("itemId") ?? "");
  const id = Number.parseInt(idTexto, 10);
  if (!Number.isInteger(id)) return;

  const ilimitado = datos.get(`ilim_${id}`) !== null;
  let stock: number | null = null;
  if (!ilimitado) {
    const crudo = Number.parseInt(String(datos.get(`stock_${id}`) ?? "-1"), 10);
    if (!Number.isInteger(crudo) || crudo < 0) return;
    stock = Math.min(crudo, 999);
  }
  const conMenu = await db.menuDiaItem.findUnique({ where: { id }, select: { menuDia: { select: { fecha: true } } } });
  if (!conMenu) return;

  await db.menuDiaItem.update({ where: { id }, data: { stockPorciones: stock } });
  revalidar();
}

/** Agrega un producto del catálogo al menú del día */
export async function agregarAlMenu(datos: FormData): Promise<void> {
  await exigirAdmin();
  const menuId = Number.parseInt(String(datos.get("menuId") ?? ""), 10);
  const productoId = Number.parseInt(String(datos.get("productoId") ?? ""), 10);
  if (!Number.isInteger(menuId) || !Number.isInteger(productoId)) return;

  const producto = await db.producto.findUnique({ where: { id: productoId } });
  if (!producto || !producto.activo) return;
  const esDeMenu = (TIPOS_MENU_DIA as string[]).includes(producto.tipo);
  if (!esDeMenu) return;

  await db.menuDiaItem.upsert({
    where: { menuDiaId_productoId: { menuDiaId: menuId, productoId } },
    update: {},
    create: { menuDiaId: menuId, productoId, stockPorciones: 40 },
  });
  revalidar();
}

/** Quita un ítem del menú del día */
export async function quitarDelMenu(datos: FormData): Promise<void> {
  await exigirAdmin();
  const id = Number.parseInt(String(datos.get("itemId") ?? ""), 10);
  if (!Number.isInteger(id)) return;
  const tipoProducto = await db.menuDiaItem.findUnique({
    where: { id },
    select: { producto: { select: { tipo: true } } },
  });
  if (!tipoProducto) return;
  const menuProd = tipoProducto.producto.tipo as TipoProducto;
  if (!(TIPOS_MENU_DIA as string[]).includes(menuProd)) return;

  await db.menuDiaItem.delete({ where: { id } });
  revalidar();
}
