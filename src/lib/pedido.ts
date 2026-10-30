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

/** Selección de un almuerzo tal como la envía el formulario */
export type CargaPedido = {
  conSopa: boolean;
  proteinaId: number | null;
  principios: number[];
  ensaladas: number[]; // apartado especial: ensaladas del catálogo (tipo ENSALADA)
  sopaId: number | null;
  extras: number[]; // productoIds de bebidas/adicionales (uno por unidad)
  llevar?: boolean; // para llevar: la misma lógica + icopor de $1.500
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
 * Crea la comanda de un almuerzo: valida contra el menú del día, descuenta
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

  const proteinaId = carga.proteinaId;
  const sopaId = carga.sopaId;
  const principios = enumerar(carga.principios, 10);
  const extras = enumerar(carga.extras, 15);
  if (proteinaId !== null && !esId(proteinaId)) {
    throw new ErrorDePedido("Proteína inválida.");
  }
  if (sopaId !== null && !esId(sopaId)) {
    throw new ErrorDePedido("Sopa inválida.");
  }
  if (!principios || !extras) {
    throw new ErrorDePedido("Formato del pedido incorrecto.");
  }
  if (typeof carga.conSopa !== "boolean") {
    throw new ErrorDePedido("Aclara si el almuerzo lleva sopa o no.");
  }
  const llevar = carga.llevar === true;
  if (proteinaId === null) {
    throw new ErrorDePedido("Elige la proteína del almuerzo.");
  }

  // Validar contra el menú real de hoy (proteína, principios y sopa)
  const menu = await menuDeHoy();
  const porItemId = new Map(menu.map((i) => [i.itemId, i]));

  const proteina = porItemId.get(proteinaId as number);
  if (!proteina || proteina.tipo !== "PROTEINA") {
    throw new ErrorDePedido("Esa proteína no está en el menú de hoy.");
  }
  if (proteina.disponibles === 0) {
    throw new ErrorDePedido(`«${proteina.nombre}» está agotada. Elige otra proteína.`);
  }

  let sopaElegida: ItemMenuHoy | null = null;
  // Sopa OPCIONAL: "con sopa" puede enviarse sin elegir cuál (la cocina decide);
  // solo se valida la sopa cuando el mesero sí la escogió.
  if (carga.conSopa && sopaId !== null) {
    const s = porItemId.get(sopaId);
    if (!s || s.tipo !== "SOPA") {
      throw new ErrorDePedido("Esa sopa no está en el menú de hoy.");
    }
    if (s.disponibles === 0) {
      throw new ErrorDePedido(`«${s.nombre}» está agotada. Elige otra o marca «sin sopa».`);
    }
    sopaElegida = s;
  }

  const principiosElegidos = new Map<number, ItemMenuHoy>();
  for (const itemId of principios) {
    if (principiosElegidos.has(itemId)) continue;
    const p = porItemId.get(itemId);
    if (!p || p.tipo !== "PRINCIPIO") {
      throw new ErrorDePedido("Uno de los principios ya no está en el menú de hoy.");
    }
    if (p.disponibles === 0) {
      throw new ErrorDePedido(`«${p.nombre}» se agotó. Quítalo del pedido o elige otro.`);
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
      throw new ErrorDePedido("Una ensalada ya no está en el menú de hoy.");
    }
    if (e.disponibles === 0) {
      throw new ErrorDePedido(`«${e.nombre}» se agotó. Quítala del pedido o elige otra.`);
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
    throw new ErrorDePedido("Una bebida o adicional ya no está disponible. Recarga la página.");
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
      lineas.set(productoId, { productoId, tipo, cantidad, conSopa, precio });
    }
  };

  // La línea de la proteína cobra el almuerzo entero: $13.000 con sopa /
  // $12.000 solo bandeja, +$1.500 (icopor) si es para llevar.
  empujar(proteina.productoId, proteina.tipo, carga.conSopa, 1, precioAlmuerzo(carga.conSopa, llevar));
  // Sopa, principios y ensaladas vienen incluidos en el precio del almuerzo
  if (sopaElegida) empujar(sopaElegida.productoId, sopaElegida.tipo, null, 1, 0);
  for (const p of principiosElegidos.values()) empujar(p.productoId, p.tipo, null, 1, 0);
  for (const e of ensaladasElegidas.values()) empujar(e.productoId, e.tipo, null, 1, 0);
  for (const productoId of extras) {
    const p = catalogoExtras.find((x) => x.id === productoId)!;
    empujar(productoId, p.tipo, null, 1, p.precio);
  }

  return db.$transaction(async (tx) => {
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
      if (afectados !== 1) {
        throw new ErrorDePedido(
          `«${porcion.nombre}» se agotó. Revisa la selección e intenta otra vez.`,
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
      data: [...lineas.values()].map((l) => ({
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
