// Soporte de pedidos y comandas: helpers compartidos entre mesero y admin
import { db } from "@/lib/db";
import { getCategoriasPersonalizadas } from "@/lib/config";
import { claveDia } from "@/lib/format";
import { siguienteConsecutivo } from "@/lib/consecutivos";
import { precioAlmuerzo, precioEspecialDelDia } from "@/lib/precios";
import { ESTADO_APARTADO, ESTADO_PEDIDO, type EstadoPedido } from "@/lib/roles";

/** Pedidos que dejan la mesa ocupada (los demás son históricos).
 * Los cuatro primeros valores solo cubren comandas antiguas del flujo de
 * cocina que ya no se muestra ni se vuelve a crear. */
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
  /** Un tipo fijo (PROTEINA, PRINCIPIO…) o el nombre de una categoría propia */
  tipo: string;
  /** Precio ESPECIAL de HOY para el plato (COP), fijado en el Menú del día
   *  (asados del domingo: $24.000, gallina $17.000, pescados $25.000). Si
   *  el día no fijó precio, cae al precio propio del catálogo; 0 = rige el
   *  almuerzo corriente ($13.000 con sopa · $12.000 bandeja). */
  precioPropio: number;
  /** Porciones disponibles ahora mismo; null = ilimitado */
  disponibles: number | null;
  vendidos: number;
};

/** Porciones comprometidas por apartados PENDIENTES de una fecha, agregadas
 *  por MenuDiaItem. La disponibilidad del menú es stock − vendidos − ESTO:
 *  lo apartado ya está "vendido" y el mesero no puede armarlo de nuevo. */
export async function reservasPorMenuItem(
  ids: number[],
): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const filas = await db.apartadoReserva.groupBy({
    by: ["menuDiaItemId"],
    _sum: { cantidad: true },
    where: {
      menuDiaItemId: { in: ids },
      apartado: { estado: ESTADO_APARTADO.PENDIENTE },
    },
  });
  return new Map(
    filas.map((f) => [f.menuDiaItemId as number, f._sum.cantidad ?? 0]),
  );
}

/** El menú vigente de HOY por tipo, listo para armar pedidos */
export async function menuDeHoy(): Promise<ItemMenuHoy[]> {
  const fecha = claveDia(new Date());
  const menu = await db.menuDia.findUnique({
    where: { fecha },
    include: { items: { include: { producto: true } } },
  });
  if (!menu) return [];
  // El punto ÚNICO de disponibilidad: stock − vendidos − porciones reservadas
  // por apartados pendientes de ESTA fecha
  const reservadas = await reservasPorMenuItem(menu.items.map((i) => i.id));
  return menu.items
    // Los MenuDiaItems de un producto eliminado se borran con él, así que
    // producto nunca debería ser null; el guard defiende el menú vivo en el
    // ínterin (y contra datos remotos fuera de la app).
    .filter((item) => item.producto && item.producto.activo && item.visible)
    .map((item) => ({
      itemId: item.id,
      productoId: item.productoId,
      nombre: item.producto.nombre,
      // Los 4 tipos fijos del almuerzo + las categorías propias del cliente
      tipo: item.producto.tipo,
      // Precio especial de HOY (fijado en el Menú del día); si no lo hay,
      // cae al precio propio del catálogo; 0 = precio del almuerzo corriente
      precioPropio:
        item.precioEspecial ?? (item.producto.precio > 0 ? item.producto.precio : 0),
      vendidos: item.vendidos,
      disponibles:
        item.stockPorciones === null
          ? null
          : Math.max(
              0,
              item.stockPorciones -
                item.vendidos -
                (reservadas.get(item.id) ?? 0),
            ),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Un ítem de la comanda: 1 a muchos platos por pedido */
export type LineaAlmuerzo = {
  conSopa: boolean;
  proteinaId: number;
  principios: number[]; // apartado especial: ensaladas del catálogo (tipo ENSALADA)
  ensaladas: number[];
  /** Productos de las categorías propias del cliente que van en el plato */
  propios?: number[];
  /** Adicionales del catálogo (tipo ADICIONAL) que van EN este plato: un id
   *  por unidad pedida. Se cobran con su precio y se imprimen dentro del
   *  «PEDIDO n» del plato, no en el grupo compartido de extras. */
  adicionales?: number[];
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

  // Forma vieja (un solo almuerzo), la que sigue enviando pedidos por teléfono
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
 * y la vieja de un solo plato, que siguen enviando pedido a mano y pantallas
 * anteriores. Devuelve null cuando el formato no cuadra.
 */
export function lineasDeLaCarga(carga: CargaPedido): LineaAlmuerzo[] | null {
  if (Array.isArray(carga.lineas)) {
    if (carga.lineas.length > 20) return null;
    // 0 platos es válido (comanda de solo extras, p. ej. los especiales del
    // domingo): `crearPedido` exige que lleve ALGO (plato o extra).
    if (carga.lineas.length === 0) return [];
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
      const propios =
        l.propios === undefined ? [] : enumerar(l.propios, 10);
      if (!propios) return null;
      const adicionales =
        l.adicionales === undefined ? [] : enumerar(l.adicionales, 10);
      if (!adicionales) return null;
      if (l.sopaId !== null && l.sopaId !== undefined && !esId(l.sopaId)) return null;
      unidas.push({
        conSopa: l.conSopa,
        proteinaId: l.proteinaId,
        principios,
        ensaladas,
        propios,
        adicionales,
        sopaId: l.sopaId ?? null,
        cantidad: l.cantidad,
      });
    }
    // El mismo plato añadido dos veces se pesa en una sola línea
    const fusion = new Map<string, LineaAlmuerzo>();
    for (const linea of unidas) {
      const clave = `${linea.conSopa ? "c" : "b"}|${linea.proteinaId}|${linea.sopaId ?? 0}|${[
        ...linea.principios,
      ].sort((a, b) => a - b).join(",")}|${[...linea.ensaladas].sort((a, b) => a - b).join(",")}|${
        [...(linea.adicionales ?? [])].sort((a, b) => a - b).join(",")
      }`;
      const previa = fusion.get(clave);
      if (previa) {
        previa.cantidad += linea.cantidad;
      } else {
        fusion.set(clave, linea);
      }
    }
    return [...fusion.values()];
  }

  // Forma vieja: un solo almuerzo por comanda (pedidos a mano, pantallas antiguas)
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
      adicionales: [],
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
 *
 * Domingos especiales: basta UN solo ítem para la comanda — un plato con
 * solo la proteína (el especial del día, sin principios ni ensalada), o incluso
 * un pedido de solo bebidas/adicionales (sin ningún almuerzo).
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

  const fechaConsecutivo = claveDia(new Date());
  if (await db.cierreCaja.findUnique({ where: { fecha: fechaConsecutivo }, select: { id: true } })) {
    throw new ErrorDePedido("La caja de hoy ya está cerrada: no se pueden crear pedidos posteriores.");
  }

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
  // la vieja (a mano) un solo almuerzo, que aquí entra como línea única.
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

  // Consolidar filas de la comanda. Cada plato físico tiene su propio grupo (1, 2...)
  // para poder separarlos en la comanda impresa como "PEDIDO 1", "PEDIDO 2".
  const filas: {
    productoId: number;
    /** FOTO del nombre al ordenar: la línea sobrevive al borrado del producto */
    productoNombre: string;
    tipo: string;
    cantidad: number;
    conSopa: boolean | null;
    precio: number | null;
    grupo: number;
  }[] = [];

  let proximoGrupo = 1;

  // Nombres de las categorías propias vigentes: un ítem del menú solo viaja
  // «en el plato por categoría propia» si su tipo está en esta lista
  const categoriasPropias = new Set(
    (await getCategoriasPersonalizadas()).map((c) => c.nombre),
  );

  // Adicionales que van EN el plato: productos del catálogo (tipo
  // ADICIONAL), no ítems del menú, así que se validan contra él de una vez.
  const idsAdicionales = new Set(
    lineasDePlato.flatMap((l) => l.adicionales ?? []),
  );
  const catalogoAdicionales =
    idsAdicionales.size > 0
      ? await db.producto.findMany({
          where: { id: { in: [...idsAdicionales] }, activo: true, tipo: "ADICIONAL" },
        })
      : [];
  if (catalogoAdicionales.length !== idsAdicionales.size) {
    throw new ErrorDePedido(
      "Un adicional ya no está disponible. Recarga la página.",
    );
  }
  const porProductoAdicional = new Map(
    catalogoAdicionales.map((p) => [p.id, p] as const),
  );

  for (const linea of lineasDePlato) {
    const proteina = porItemId.get(linea.proteinaId);
    if (!proteina || proteina.tipo !== "PROTEINA") {
      throw new ErrorDePedido("Esa proteína no está en el menú de hoy.");
    }
    if (proteina.disponibles === 0) {
      throw new ErrorDePedido(`«${proteina.nombre}» está agotada. Elige otra proteína.`);
    }

    // Si la línea dice "2 churrascos", creamos 2 grupos separados de comanda
    for (let i = 0; i < linea.cantidad; i++) {
      const grupoActual = proximoGrupo++;

      // La proteína cobra el plato; además su porción se descuenta del menú
      // del día, igual que sopa, principios y ensaladas.
      // PRECIO ESPECIAL del día (se fija en el Menú del día): los asados del
      // domingo $24.000, gallina $17.000, pescados $25.000 — el plato vale lo
      // mismo con o sin sopa, y para llevar solo el COMPLETO suma el icopor
      // (el empaque de la bandeja ya va incluido en su $13.000). Sin precio
      // especial rige el almuerzo corriente ($13.000 con sopa · $12.000
      // bandeja, + empaque de llevar).
      cobrar(proteina, 1);
      filas.push({
        productoId: proteina.productoId,
        productoNombre: proteina.nombre,
        tipo: proteina.tipo,
        conSopa: linea.conSopa,
        cantidad: 1,
        precio:
          proteina.precioPropio > 0
            ? precioEspecialDelDia(
                proteina.precioPropio,
                linea.conSopa,
                llevar,
              )
            : precioAlmuerzo(linea.conSopa, llevar),
        grupo: grupoActual,
      });

      if (linea.conSopa && linea.sopaId !== null) {
        const s = porItemId.get(linea.sopaId);
        if (!s || s.tipo !== "SOPA") {
          throw new ErrorDePedido("Esa sopa no está en el menú de hoy.");
        }
        if (s.disponibles === 0) {
          throw new ErrorDePedido(`«${s.nombre}» está agotada. Elige otra o marca «sin sopa».`);
        }
        cobrar(s, 1);
        filas.push({
          productoId: s.productoId,
          productoNombre: s.nombre,
          tipo: s.tipo,
          conSopa: null,
          cantidad: 1,
          precio: 0,
          grupo: grupoActual,
        });
      }

      for (const itemId of linea.principios) {
        const p = porItemId.get(itemId);
        if (!p || p.tipo !== "PRINCIPIO") {
          throw new ErrorDePedido("Uno de los principios ya no está en el menú de hoy.");
        }
        if (p.disponibles === 0) {
          throw new ErrorDePedido(`«${p.nombre}» se agotó. Quítalo del pedido o elige otro.`);
        }
        cobrar(p, 1);
        filas.push({
          productoId: p.productoId,
          productoNombre: p.nombre,
          tipo: p.tipo,
          conSopa: null,
          cantidad: 1,
          precio: 0,
          grupo: grupoActual,
        });
      }

      for (const itemId of linea.ensaladas) {
        const e = porItemId.get(itemId);
        if (!e || e.tipo !== "ENSALADA") {
          throw new ErrorDePedido("Una ensalada ya no está en el menú de hoy.");
        }
        if (e.disponibles === 0) {
          throw new ErrorDePedido(`«${e.nombre}» se agotó. Quítala del pedido o elige otra.`);
        }
        cobrar(e, 1);
        filas.push({
          productoId: e.productoId,
          productoNombre: e.nombre,
          tipo: e.tipo,
          conSopa: null,
          cantidad: 1,
          precio: 0,
          grupo: grupoActual,
        });
      }

      // Las categorías propias del cliente entran al plato igual que las
      // ensaladas: porción propia con su descuento de stock, sin precio
      for (const itemId of linea.propios ?? []) {
        const x = porItemId.get(itemId);
        if (!x || !categoriasPropias.has(x.tipo)) {
          throw new ErrorDePedido(
            "Un producto de categoría propia ya no está en el menú de hoy.",
          );
        }
        if (x.disponibles === 0) {
          throw new ErrorDePedido(`«${x.nombre}» se agotó. Quítalo del pedido o elige otro.`);
        }
        cobrar(x, 1);
        filas.push({
          productoId: x.productoId,
          productoNombre: x.nombre,
          tipo: x.tipo,
          conSopa: null,
          cantidad: 1,
          precio: 0,
          grupo: grupoActual,
        });
      }

      // Adicionales pegados al plato: mismo grupo (aparecen dentro del
      // «PEDIDO n» de la comanda), se cobran con su precio de catálogo y
      // se multiplican por los platos de la línea.
      const conteoAdicional = new Map<number, number>();
      for (const productoId of linea.adicionales ?? []) {
        conteoAdicional.set(productoId, (conteoAdicional.get(productoId) ?? 0) + 1);
      }
      for (const [productoId, unidades] of conteoAdicional) {
        const a = porProductoAdicional.get(productoId)!;
        filas.push({
          productoId: a.id,
          productoNombre: a.nombre,
          tipo: a.tipo,
          conSopa: null,
          cantidad: unidades,
          precio: a.precio,
          grupo: grupoActual,
        });
      }
    }
  }

  // Extras compartidos del pedido (grupo 0: no son platos). Con la carga
  // nueva del formulario aquí solo llegan bebidas; los adicionales elegidos
  // en el constructor viajan dentro del plato (lineas[].adicionales). La
  // carga vieja (pedidos a mano) sigue trayendo adicionales por acá.
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
    filas.push({
      productoId: p.id,
      productoNombre: p.nombre,
      tipo: p.tipo,
      conSopa: null,
      cantidad: 1,
      precio: p.precio,
      grupo: 0,
    });
  }

  // Debe haber ALGO: el mesero puede mandar solo el plato del especial (sin
  // principios ni ensalada) o solo bebidas/adicionales, pero no una comanda
  // totalmente vacía.
  if (filas.length === 0) {
    throw new ErrorDePedido(
      "La comanda está vacía: añade al menos un plato o una bebida.",
    );
  }

  return db.$transaction(async (tx) => {
    const consecutivoDia = await siguienteConsecutivo(tx, fechaConsecutivo, "PEDIDO");
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
        fechaConsecutivo,
        consecutivoDia,
        meseroId,
        // El pedido nace disponible para caja: el restaurante prepara fuera
        // del sistema y no necesita marcar pasos de cocina.
        estado: "POR_PAGAR",
        paraLlevar: llevar,
        observaciones,
      },
    });

    await tx.pedidoItem.createMany({
      data: filas.map((l) => ({
        pedidoId: pedido.id,
        productoId: l.productoId,
        productoNombre: l.productoNombre,
        tipo: l.tipo,
        cantidad: l.cantidad,
        precio: l.precio,
        conSopa: l.conSopa,
        grupo: l.grupo,
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

/** Colores para los pocos estados financieros que siguen siendo visibles. */
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
  FIADO:
    "bg-violeta-text/10 text-violeta-text border border-violeta-text/30",
};
