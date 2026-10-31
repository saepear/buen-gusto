// Soporte de pedidos y comandas: helpers compartidos entre mesero y admin
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { precioAlmuerzo } from "@/lib/precios";
import { ESTADO_PEDIDO, type EstadoPedido, type TipoProducto } from "@/lib/roles";

/** Pedidos que dejan la mesa ocupada (los demás son históricos) */
export const ESTADOS_ACTIVOS_PEDIDO: EstadoPedido[] = [
  ESTADO_PEDIDO.ENVIADO,
  ESTADO_PEDIDO.EN_PREPARACION,
  ESTADO_PEDIDO.PARCIAL_SERVIDO,
  ESTADO_PEDIDO.SERVIDO,
  ESTADO_PEDIDO.POR_PAGAR,
];

export type ItemMenuHoy = {
  /** id del MenuDiaItem: se usa para descontar/resetear porciones */
  itemId: number;
  productoId: number;
  nombre: string;
  tipo: TipoProducto;
  /** Porciones disponibles ahora mismo; null = ilimitado */
  disponibles: number | null;
  vendidos: number;
};

/** El menú vigente de HOY por tipo, listo para armar pedidos */
export async function menuDeHoy(): Promise<ItemMenuHoy[]> {
  const fecha = claveDia(new Date());
  const menu = await db.menuDia.findUnique({
    where: { fecha },
    include: { items: { include: { producto: true } } },
  });
  if (!menu) return [];
  return menu.items
    .filter((item) => item.producto.activo && item.visible)
    .map((item) => ({
      itemId: item.id,
      productoId: item.productoId,
      nombre: item.producto.nombre,
      tipo: item.producto.tipo as TipoProducto,
      vendidos: item.vendidos,
      disponibles:
        item.stockPorciones === null
          ? null
          : Math.max(0, item.stockPorciones - item.vendidos),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Un ítem de la comanda: 1 a muchos platos por pedido */
export type LineaAlmuerzo = {
  conSopa: boolean;
  proteinaId: number;
  principios: number[]; // apartado especial: ensaladas del catálogo (tipo ENSALADA)
  ensaladas: number[];
  sopaId: number | null;
  /** Cuántos almuerzos idénticos van en esta línea (1 a 50) */
  cantidad: number;
};

/**
 * El pedido tal como lo envía el formulario: una mesa puede pedir de 1 a
 * muchos platos en una sola comanda, y un domicilio varios almuerzos por orden.
 */
export type CargaPedido = {
  /** Forma nueva: cada plato es una línea con su propia configuración */
  lineas?: LineaAlmuerzo[];
  extras: number[]; // productoIds de bebidas/adicionales (uno por unidad)
  llevar?: boolean; // para llevar: la misma lógica + empague de icopor

  // Forma vieja (un solo almuerzo), la que sigue enviando el flujo WhatsApp
  conSopa?: boolean;
  proteinaId?: number | null;
  principios?: number[];
  ensaladas?: number[];
  sopaId?: number | null;
};

/** Error de negocio con un mensaje listo para mostrarle al usuario */
export class ErrorDePedido extends Error {}

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

/**
 * Uniforma la carga a líneas de almuerzo: acepta la forma nueva (lineas[])
 * y la vieja de un solo plato, que siguen enviando WhatsApp y pantallas
 * anteriores. Devuelve null cuando el formato no cuadra.
 */
export function lineasDeLaCarga(carga: CargaPedido): LineaAlmuerzo[] | null {
  if (Array.isArray(carga.lineas)) {
    if (carga.lineas.length === 0 || carga.lineas.length > 20) return null;
    const unidas: LineaAlmuerzo[] = [];
    for (const l of carga.lineas) {
      if (
        !l ||
        typeof l.conSopa !== "boolean" ||
        !esId(l.proteinaId) ||
        !esId(l.cantidad) ||
        l.cantidad > 50
      ) {
        return null;
      }
      const principios = enumerar(l.principios, 10);
      const ensaladas = enumerar(l.ensaladas, 10);
      if (!principios || !ensaladas) return null;
      if (l.sopaId !== null && l.sopaId !== undefined && !esId(l.sopaId)) return null;
      unidas.push({
        conSopa: l.conSopa,
        proteinaId: l.proteinaId,
        principios,
        ensaladas,
        sopaId: l.sopaId ?? null,
        cantidad: l.cantidad,
      });
    }
    // El mismo plato añadido dos veces se pesa en una sola línea
    const fusion = new Map<string, LineaAlmuerzo>();
    for (const linea of unidas) {
      const clave = `${linea.conSopa ? "c" : "b"}|${linea.proteinaId}|${linea.sopaId ?? 0}|${[
        ...linea.principios,
      ].sort((a, b) => a - b).join(",")}|${[...linea.ensaladas].sort((a, b) => a - b).join(",")}`;
      const previa = fusion.get(clave);
      if (previa) {
        previa.cantidad += linea.cantidad;
      } else {
        fusion.set(clave, linea);
      }
    }
    return [...fusion.values()];
  }

  // Forma vieja: un solo almuerzo por comanda (WhatsApp / pantallas antiguas)
  const { conSopa, proteinaId, principios, ensaladas, sopaId } = carga;
  if (typeof conSopa !== "boolean" || typeof proteinaId !== "number" || !esId(proteinaId)) {
    return null;
  }
  const principiosViejos = enumerar(principios, 10);
  const ensaladasViejas = enumerar(ensaladas, 10);
  if (!principiosViejos || !ensaladasViejas) return null;
  if (sopaId !== null && sopaId !== undefined && !esId(sopaId)) return null;
  return [
    {
      conSopa,
      proteinaId,
      principios: principiosViejos,
      ensaladas: ensaladasViejas,
      sopaId: sopaId ?? null,
      cantidad: 1,
    },
  ];
}

/**
 * Crea la comanda de 1 a muchos almuerzos: valida contra el menú del día, descuenta
 * las porciones de forma atómica y devuelve el id del pedido creado.
 * Lo comparten el mesero (mesas del salón) y el admin (domicilios).
 * Lanza ErrorDePedido con un mensaje claro cuando algo no cuadra.
 */
export async function crearPedido(opciones: {
  mesaId: number;
  meseroId: number | null;
  carga: CargaPedido;
  observaciones: string | null;
  /** Solo Admin→Domicilios: crear comandas sobre la mesa virtual "Domicilios" */
  permitirMesaVirtual?: boolean;
}): Promise<number> {
  const {
    mesaId,
    meseroId,
    carga,
    observaciones,
    permitirMesaVirtual = false,
  } = opciones;

  // La mesa puede haber sido ocultada entre el render y el envío del pedido.
  const mesaViva = await db.mesa.findFirst({
    where: { id: mesaId, activa: true },
    select: { estado: true, esDomicilio: true },
  });
  if (!mesaViva) {
    throw new ErrorDePedido("Esa mesa está oculta o ya no existe.");
  }
  if (mesaViva.esDomicilio && !permitirMesaVirtual) {
    throw new ErrorDePedido(
      "Los domicilios se registran desde Domicilios (admin), no desde el salón.",
    );
  }

  // La mesa puede pedir de 1 a muchos platos: la forma nueva trae lineas[];
  // la vieja (WhatsApp) un solo almuerzo, que aquí entra como línea única.
  if (!Array.isArray(carga.lineas)) {
    if (typeof carga.conSopa !== "boolean") {
      throw new ErrorDePedido("Aclara si el almuerzo lleva sopa o no.");
    }
    if (carga.proteinaId === null) {
      throw new ErrorDePedido("Elige la proteína del almuerzo.");
    }
  }
  const lineasDePlato = lineasDeLaCarga(carga);
  if (!lineasDePlato) {
    throw new ErrorDePedido("Formato del pedido incorrecto.");
  }

  const llevar = carga.llevar === true;

  // Validar contra el menú real de hoy: proteína, principios y sopa de
  // CADA línea, más los extras compartidos del pedido.
  const menu = await menuDeHoy();
  const porItemId = new Map(menu.map((i) => [i.itemId, i]));

  /** Porciones del menú que se van a descontar (se suman entre líneas) */
  const consumo = new Map<number, { item: ItemMenuHoy; cantidad: number }>();
  const cobrar = (item: ItemMenuHoy, cantidad: number) => {
    const previa = consumo.get(item.itemId);
    if (previa) previa.cantidad += cantidad;
    else consumo.set(item.itemId, { item, cantidad });
  };

  // Consolidar filas de la comanda. El precio queda fijado al ordenar:
  // aunque el catálogo cambie, la comanda no se mueve. La proteína se
  // parte por conSopa: «2 churrasco» puede ser uno con sopa y otro
  // bandeja, y la cocina necesita los dos renglones separados.
  const filas = new Map<
    string,
    {
      productoId: number;
      tipo: string;
      cantidad: number;
      conSopa: boolean | null;
      precio: number | null;
    }
  >();
  const empujar = (
    marca: string,
    productoId: number,
    tipo: string,
    conSopa: boolean | null,
    cantidad: number,
    precio: number | null,
  ) => {
    const previa = filas.get(marca);
    if (previa) {
      previa.cantidad += cantidad;
      previa.conSopa = previa.conSopa ?? conSopa;
    } else {
      filas.set(marca, { productoId, tipo, cantidad, conSopa, precio });
    }
  };

  for (const linea of lineasDePlato) {
    const proteina = porItemId.get(linea.proteinaId);
    if (!proteina || proteina.tipo !== "PROTEINA") {
      throw new ErrorDePedido("Esa proteína no está en el menú de hoy.");
    }
    if (proteina.disponibles === 0) {
      throw new ErrorDePedido(`«${proteina.nombre}» está agotada. Elige otra proteína.`);
    }
    // La línea de la proteína cobra el almuerzo entero: $13.000 con sopa /
    // $12.000 solo bandeja, +$1.500 (icopor) si es para llevar.
    empujar(
      `A${linea.proteinaId}-${linea.conSopa ? "c" : "b"}`,
      proteina.productoId,
      proteina.tipo,
      linea.conSopa,
      linea.cantidad,
      precioAlmuerzo(linea.conSopa, llevar),
    );

    // Sopa OPCIONAL: "con sopa" puede ir sin elegir cuál (la cocina decide);
    // solo se valida cuando el plato sí la escogió.
    if (linea.conSopa && linea.sopaId !== null) {
      const s = porItemId.get(linea.sopaId);
      if (!s || s.tipo !== "SOPA") {
        throw new ErrorDePedido("Esa sopa no está en el menú de hoy.");
      }
      if (s.disponibles === 0) {
        throw new ErrorDePedido(`«${s.nombre}» está agotada. Elige otra o marca «sin sopa».`);
      }
      cobrar(s, linea.cantidad);
      empujar(`I${s.productoId}`, s.productoId, s.tipo, null, linea.cantidad, 0);
    }

    for (const itemId of linea.principios) {
      const p = porItemId.get(itemId);
      if (!p || p.tipo !== "PRINCIPIO") {
        throw new ErrorDePedido("Uno de los principios ya no está en el menú de hoy.");
      }
      if (p.disponibles === 0) {
        throw new ErrorDePedido(`«${p.nombre}» se agotó. Quítalo del pedido o elige otro.`);
      }
      cobrar(p, linea.cantidad);
      empujar(`I${p.productoId}`, p.productoId, p.tipo, null, linea.cantidad, 0);
    }
    for (const itemId of linea.ensaladas) {
      const e = porItemId.get(itemId);
      if (!e || e.tipo !== "ENSALADA") {
        throw new ErrorDePedido("Una ensalada ya no está en el menú de hoy.");
      }
      if (e.disponibles === 0) {
        throw new ErrorDePedido(`«${e.nombre}» se agotó. Quítala del pedido o elige otra.`);
      }
      cobrar(e, linea.cantidad);
      empujar(`I${e.productoId}`, e.productoId, e.tipo, null, linea.cantidad, 0);
    }
  }

  // Extras (bebidas y adicionales): deben existir y estar activos en el catálogo
  const extras = enumerar(carga.extras, 40);
  if (!extras) {
    throw new ErrorDePedido("Formato del pedido incorrecto.");
  }
  const catalogoExtras = await db.producto.findMany({
    where: {
      id: { in: [...new Set(extras)] },
      activo: true,
      tipo: { in: ["BEBIDA", "ADICIONAL"] },
    },
  });
  if (catalogoExtras.length !== new Set(extras).size) {
    throw new ErrorDePedido("Una bebida o adicional ya no está disponible. Recarga la página.");
  }
  for (const productoId of extras) {
    const p = catalogoExtras.find((x) => x.id === productoId)!;
    empujar(`I${p.id}`, p.id, p.tipo, null, 1, p.precio);
  }

  return db.$transaction(async (tx) => {
    // Descontar porciones con guardia atómica, ahora por cantidad: si la
    // fila ya no cupo la suma completa, aborta el pedido entero (nada queda
    // descontado a la mitad).
    for (const { item, cantidad } of consumo.values()) {
      const afectados =
        await tx.$executeRaw`UPDATE MenuDiaItem SET vendidos = vendidos + ${cantidad} WHERE id = ${item.itemId} AND (stockPorciones IS NULL OR vendidos + ${cantidad} <= stockPorciones)`;
      if (afectados !== 1) {
        throw new ErrorDePedido(
          `«${item.nombre}» se agotó. Revisa la selección e intenta otra vez.`,
        );
      }
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
      data: [...filas.values()].map((l) => ({
        pedidoId: pedido.id,
        productoId: l.productoId,
        tipo: l.tipo,
        cantidad: l.cantidad,
        precio: l.precio,
        conSopa: l.conSopa,
      })),
    });

    // La mesa virtual de domicilios no tiene estado de salón que actualizar
    if (!mesaViva.esDomicilio) {
      const mesa = await tx.mesa.findUnique({
        where: { id: mesaId },
        select: { estado: true, activa: true },
      });
      if (!mesa) throw new ErrorDePedido("Esa mesa ya no existe.");
      if (!mesa.activa) {
        throw new ErrorDePedido(
          "Esa mesa está oculta: ya no recibe pedidos. Vuelve a la lista de mesas.",
        );
      }
      if (mesa.estado !== "POR_PAGAR") {
        await tx.mesa.update({ where: { id: mesaId }, data: { estado: "OCUPADA" } });
      }
    }

    return pedido.id;
  });
}

/** Hoy a las 00:00 local (para traer solo los pedidos del día) */
export function inicioDeHoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Colores de los chips de estado de comanda (zonas oscuras: cocina) */
export const CHIP_ESTADO_PEDIDO: Record<string, string> = {
  ENVIADO:
    "bg-amber-brand/15 text-amber-brand border border-amber-brand/40",
  EN_PREPARACION:
    "bg-[#4aa3ff]/15 text-[#8cc7ff] border border-[#4aa3ff]/40",
  PARCIAL_SERVIDO:
    "bg-[#b06fd0]/20 text-[#d8a6f0] border border-[#b06fd0]/40",
  SERVIDO:
    "bg-success/15 text-[#a7dd83] border border-success/40",
  POR_PAGAR:
    "bg-warning/15 text-amber-brand border border-warning/50",
  CANCELADO:
    "bg-danger/15 text-[#f09490] border border-danger/40",
  COBRADO:
    "bg-white/5 text-cream-200/60 border border-white/10",
};
