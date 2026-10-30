"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { precioAlmuerzo } from "@/lib/precios";
import { menuDeHoy, type ItemMenuHoy } from "@/lib/pedido";
import { exigirActor } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionPedido = { error: string | null; ok: string | null };

type CargaPedido = {
  conSopa: boolean;
  proteinaId: number | null;
  principios: number[];
  ensaladas: number[]; // apartado especial: ensaladas del catálogo (tipo ENSALADA)
  sopaId: number | null;
  extras: number[]; // productoIds de bebidas/adicionales (uno por unidad)
  llevar?: boolean; // domicilio: la misma lógica + icopor de $1.500
};

/** Alguien consumió la última porción mientras el mesero armaba el pedido */
class SeAgoto extends Error {}

/** La mesa dejó de estar disponible mientras el mesero armaba el pedido */
class MesaNoDisponible extends Error {}

const esId = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

function enumerar(bruto: unknown, max: number): number[] | null {
  if (!Array.isArray(bruto) || bruto.length > max) return null;
  const lista: number[] = [];
  for (const x of bruto) {
    if (!esId(x)) return null;
    lista.push(x);
  }
  return lista;
}

/** Toma el pedido de una mesa: descuenta porciones en vivo y envía la comanda */
export async function tomarPedido(
  _previa: EstadoAccionPedido,
  datos: FormData,
): Promise<EstadoAccionPedido> {
  let meseroId: number;
  try {
    const sesion = await exigirActor(["MESERO"]);
    meseroId = sesion.id;
  } catch {
    return { error: "Solo los meseros pueden tomar pedidos.", ok: null };
  }

  const mesaId = Number.parseInt(String(datos.get("mesaId") ?? ""), 10);
  if (!Number.isInteger(mesaId)) {
    return { error: "Mesa inválida.", ok: null };
  }

  // La mesa puede haber sido ocultada desde configuración entre el render
  // del formulario y el envío de la comanda.
  const mesaViva = await db.mesa.findFirst({
    where: { id: mesaId, activa: true },
    select: { estado: true },
  });
  if (!mesaViva) {
    return {
      error: "Esa mesa está oculta o ya no existe. Vuelve a la lista de mesas.",
      ok: null,
    };
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

  const proteinaId = carga.proteinaId;
  const sopaId = carga.sopaId;
  const principios = enumerar(carga.principios, 10);
  const extras = enumerar(carga.extras, 15);
  if (proteinaId !== null && !esId(proteinaId)) {
    return { error: "Proteína inválida.", ok: null };
  }
  if (sopaId !== null && !esId(sopaId)) {
    return { error: "Sopa inválida.", ok: null };
  }
  if (!principios || !extras) {
    return { error: "Formato del pedido incorrecto.", ok: null };
  }
  if (typeof carga.conSopa !== "boolean") {
    return { error: "Aclara si el almuerzo lleva sopa o no.", ok: null };
  }
  // Domicilio: la lógica es la misma del salón, solo se suma el icopor
  const llevar = carga.llevar === true;
  if (proteinaId === null) {
    return { error: "Elige la proteína del almuerzo.", ok: null };
  }
  // La sopa ya no es obligatoria aunque se marque "con sopa"
  /*
  if (carga.conSopa && sopaId === null) {
    return {
      error: "Elige la sopa del día o marca «sin sopa».",
      ok: null,
    };
  }
  */

  const observaciones =
    String(datos.get("observaciones") ?? "").trim().slice(0, 140) || null;

  // Validar contra el menú real de hoy (proteína, principios y sopa)
  const menu = await menuDeHoy();
  const porItemId = new Map(menu.map((i) => [i.itemId, i]));

  const proteina = porItemId.get(proteinaId as number);
  if (!proteina || proteina.tipo !== "PROTEINA") {
    return { error: "Esa proteína no está en el menú de hoy.", ok: null };
  }
  if (proteina.disponibles === 0) {
    return {
      error: `«${proteina.nombre}» está agotada. Elige otra proteína.`,
      ok: null,
    };
  }

  let sopaElegida: ItemMenuHoy | null = null;
  if (carga.conSopa) {
    const s = porItemId.get(sopaId as number);
    if (!s || s.tipo !== "SOPA") {
      return { error: "Esa sopa no está en el menú de hoy.", ok: null };
    }
    if (s.disponibles === 0) {
      return {
        error: `«${s.nombre}» está agotada. Elige otra o marca «sin sopa».`,
        ok: null,
      };
    }
    sopaElegida = s;
  }

  const principiosElegidos = new Map<number, ItemMenuHoy>();
  for (const itemId of principios) {
    if (principiosElegidos.has(itemId)) continue;
    const p = porItemId.get(itemId);
    if (!p || p.tipo !== "PRINCIPIO") {
      return {
        error: "Uno de los principios ya no está en el menú de hoy.",
        ok: null,
      };
    }
    if (p.disponibles === 0) {
      return {
        error: `«${p.nombre}» se agotó. Quítalo del pedido o elige otro.`,
        ok: null,
      };
    }
    principiosElegidos.set(itemId, p);
  }

  // Ensaladas: apartado aparte de los principios, también incluidas
  const cargaEnsaladas = Array.isArray(carga.ensaladas) ? carga.ensaladas : [];
  const ensaladasElegidas = new Map<number, ItemMenuHoy>();
  for (const itemId of cargaEnsaladas) {
    if (ensaladasElegidas.has(itemId)) continue;
    const e = porItemId.get(itemId);
    if (!e || e.tipo !== "ENSALADA") {
      return {
        error: "Una ensalada ya no está en el menú de hoy.",
        ok: null,
      };
    }
    if (e.disponibles === 0) {
      return {
        error: `«${e.nombre}» se agotó. Quítala del pedido o elige otra.`,
        ok: null,
      };
    }
    ensaladasElegidas.set(itemId, e);
  }

  // Extras (bebidas y adicionales): deben existir y estar activos en el catálogo
  const catalogoExtras = await db.producto.findMany({
    where: {
      id: { in: [...new Set(extras)] },
      activo: true,
      tipo: { in: ["BEBIDA", "ADICIONAL"] },
    },
  });
  if (catalogoExtras.length !== new Set(extras).size) {
    return {
      error: "Una bebida o adicional ya no está disponible. Recarga la página.",
      ok: null,
    };
  }

  // Consolidar líneas de la comanda (cantidades iguales se juntan). El precio
  // queda fijado al ordenar: aunque el catálogo cambie, la comanda no se mueve.
  const lineas = new Map<
    number,
    {
      productoId: number;
      tipo: string;
      cantidad: number;
      conSopa: boolean | null;
      precio: number | null;
    }
  >();
  const empujar = (
    productoId: number,
    tipo: string,
    conSopa: boolean | null = null,
    cantidad = 1,
    precio: number | null = null,
  ) => {
    const previa = lineas.get(productoId);
    if (previa) {
      previa.cantidad += cantidad;
      previa.conSopa = previa.conSopa ?? conSopa;
    } else {
      lineas.set(productoId, {
        productoId,
        tipo,
        cantidad,
        conSopa,
        precio,
      });
    }
  };

  // La línea de la proteína cobra el almuerzo entero: $13.000 con sopa /
  // $12.000 solo bandeja servido en mesa, +$1.500 (icopor) si es para llevar.
  empujar(
    proteina.productoId,
    proteina.tipo,
    carga.conSopa,
    1,
    precioAlmuerzo(carga.conSopa, llevar),
  );
  // Sopa, principios y ensaladas vienen incluidos en el precio del almuerzo
  if (sopaElegida) empujar(sopaElegida.productoId, sopaElegida.tipo, null, 1, 0);
  for (const p of principiosElegidos.values()) {
    empujar(p.productoId, p.tipo, null, 1, 0);
  }
  for (const e of ensaladasElegidas.values()) {
    empujar(e.productoId, e.tipo, null, 1, 0);
  }
  for (const productoId of extras) {
    const p = catalogoExtras.find((x) => x.id === productoId)!;
    empujar(productoId, p.tipo, null, 1, p.precio);
  }

  let nuevoId: number | null = null;
  let fallo: string | null = null;
  try {
    nuevoId = await db.$transaction(async (tx) => {
      // Descontar porciones con guardia atómica: si la fila ya no cupo, aborta
      const porciones = [
        proteina,
        ...(sopaElegida ? [sopaElegida] : []),
        ...principiosElegidos.values(),
        ...ensaladasElegidas.values(),
      ];
      for (const porcion of porciones) {
        const afectados =
          await tx.$executeRaw`UPDATE MenuDiaItem SET vendidos = vendidos + 1 WHERE id = ${porcion.itemId} AND (stockPorciones IS NULL OR vendidos < stockPorciones)`;
        if (afectados !== 1) throw new SeAgoto(porcion.nombre);
      }

      const pedido = await tx.pedido.create({
        data: {
          mesaId,
          meseroId,
          estado: "ENVIADO",
          paraLlevar: llevar,
          observaciones,
        },
      });

      await tx.pedidoItem.createMany({
        data: [...lineas.values()].map((l) => ({
          pedidoId: pedido.id,
          productoId: l.productoId,
          tipo: l.tipo,
          cantidad: l.cantidad,
          precio: l.precio,
          conSopa: l.conSopa,
        })),
      });

      const mesa = await tx.mesa.findUnique({
        where: { id: mesaId },
        select: { estado: true, activa: true },
      });
      if (!mesa) throw new MesaNoDisponible("Esa mesa ya no existe.");
      if (!mesa.activa) {
        throw new MesaNoDisponible(
          "Esa mesa está oculta: ya no recibe pedidos. Vuelve a la lista de mesas.",
        );
      }
      if (mesa.estado !== "POR_PAGAR") {
        await tx.mesa.update({
          where: { id: mesaId },
          data: { estado: "OCUPADA" },
        });
      }

      return pedido.id;
    });
  } catch (e) {
    if (e instanceof SeAgoto) {
      fallo = `«${e.message}» se agotó. Revisa la selección e intenta otra vez.`;
    } else if (
      e instanceof Error &&
      typeof e === "object" &&
      e.constructor?.name === "SeAgoto"
    ) {
      fallo = "Se agotó una porción. Revisa la selección.";
    } else if (e instanceof MesaNoDisponible) {
      fallo = e.message;
    } else {
      fallo = "No se pudo guardar el pedido. Intenta otra vez.";
    }
  }

  if (nuevoId === null) {
    return { error: fallo ?? "No se pudo guardar el pedido.", ok: null };
  }

  revalidatePath("/mesero", "layout");
  revalidatePath("/ordenes");
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  realtime.broadcast("update");

  redirect(`/ordenes/comanda/${nuevoId}?autoPrint=1`);
}
