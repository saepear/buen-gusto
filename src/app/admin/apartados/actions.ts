"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCOP, claveDia } from "@/lib/format";
import { minutosDeHora } from "@/lib/hora";
import { precioAlmuerzo, precioEspecialDelDia } from "@/lib/precios";
import { ES_METODO_PAGO, ESTADO_APARTADO, ESTADO_PEDIDO } from "@/lib/roles";
import { crearCuentaFiadaTx } from "@/lib/fiados";
import { exigirAdmin } from "@/lib/session";
import { reservasPorMenuItem } from "@/lib/pedido";
import { realtime } from "@/lib/realtime";
import { buscarClientesPagina, coincidenciasDeCliente, crearClienteNuevo, telefonoNormalizado, type ClienteResumen } from "@/lib/clientes";

export type EstadoAccionApartado = { error: string | null; ok: string | null };

class ErrorDeApartado extends Error {}

/** El nombre de la mesa virtual sobre la que nace la comanda del apartado */
const MESA_APARTADOS = "Apartados";

/**
 * Cómo se entrega un apartado: para RECOGER (lleva empaque y sus precios de
 * llevar; el valor por defecto, como siempre) o para SERVIR EN MESA del
 * salón (precios de salón, sin recargos de icopor). Lo decide el admin en el
 * constructor y se congela con el apartado.
 */

const CANTIDAD_MAX = 50;
const ITEM_OTRO_MAX = 60;

// ─── Carga del formulario ─────────────────────────────────────────────────────

export type LineaAlmuerzoApartado = {
  conSopa: boolean;
  /** Proteína del menú DE LA FECHA DE ENTREGA (id de Producto) */
  proteinaProductoId: number;
  /** Principios del menú de esa fecha (ids de Producto; incluidos en el plato) */
  principiosProductoIds?: number[];
  /** Ensaladas del menú de esa fecha (ids de Producto; incluidas en el plato) */
  ensaladasProductoIds?: number[];
  /** Sopa escogida del menú (id de Producto); null/omitido = la sopa del día */
  sopaProductoId?: number | null;
  /** Adicionales del catálogo DENTRO del plato: un id por unidad pedida */
  adicionalesProductoIds?: number[];
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
  /** Cómo se entrega: recoger y llevar (precios de empaque) o comer en mesa */
  paraLlevar?: boolean;
  lineas: LineaAlmuerzoApartado[];
  extras: ExtraApartado[];
  otros: OtroApartado[];
  observaciones?: string;
};

/** Un componente del menú DE UNA FECHA, listo para armar platos */
export type ComponenteMenuApartado = {
  /** id del MenuDiaItem de esa fecha (informativo: para reservas Fase 5) */
  itemId: number;
  productoId: number;
  nombre: string;
  tipo: string; // PROTEINA | PRINCIPIO | ENSALADA | SOPA
  /** Precio especial de esa fecha (0 = rige el almuerzo corriente) */
  precioPropio: number;
  /** Porciones libres ahora mismo; null = ilimitado (informativo en Fase 4) */
  disponibles: number | null;
};

export type MenuDeFechaApartado = {
  fecha: string;
  /** false: ese día no tiene menú apartado → solo extras y lo narrado */
  existeMenu: boolean;
  componentes: ComponenteMenuApartado[];
};

const TIPOS_PLATO_MENU = ["PROTEINA", "PRINCIPIO", "ENSALADA", "SOPA"] as const;

export async function menuDeFechaApartado(
  fechaCruda: string,
): Promise<MenuDeFechaApartado> {
  const cruda = String(fechaCruda ?? "");
  // Sin fecha o inválida → hoy (el «sin fecha» del constructor es hoy)
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(cruda) ? cruda : claveDia(new Date());
  try {
    await exigirAdmin();
  } catch {
    return { fecha, existeMenu: false, componentes: [] };
  }
  const menu = await db.menuDia.findUnique({
    where: { fecha },
    include: { items: { include: { producto: true } } },
  });
  if (!menu) return { fecha, existeMenu: false, componentes: [] };
  // Disponibilidad real: stock − vendidos − lo que ya reservaron otros
  // apartados pendientes de ESTA fecha
  const reservadas = await reservasPorMenuItem(menu.items.map((i) => i.id));
  const componentes = menu.items
    .filter(
      (item) =>
        item.producto && // guard defensivo: los MenuDiaItems de un producto
        item.producto.activo && // borrado desaparecen con él, pero el menú
        item.visible && // de una fecha vieja puede aún tener huérfanos
        (TIPOS_PLATO_MENU as readonly string[]).includes(item.producto.tipo),
    )
    .map((item) => ({
      itemId: item.id,
      productoId: item.productoId,
      nombre: item.producto.nombre,
      tipo: item.producto.tipo,
      precioPropio:
        item.precioEspecial ?? (item.producto.precio > 0 ? item.producto.precio : 0),
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
  return { fecha, existeMenu: true, componentes };
}

// ─── Plato congelado (el JSON que revive el plato al entregar) ────────────────

type PlatoReferencia = { productoId: number; nombre: string };

/** Snapshot inmutable de UN almuerzo apartado: nombre/id de cada componente
 *  congelados al apartar. La sopa solo va si la eligieron exacta; null +
 *  conSopa = «la sopa del día» del menú del día de entrega. Los principios y
 *  ensaladas son porciones incluidas (no se cobran); los adicionales sí. */
type DetallePlato = {
  conSopa: boolean;
  proteina: PlatoReferencia;
  principios: PlatoReferencia[];
  ensaladas: PlatoReferencia[];
  sopa: PlatoReferencia | null;
  adicionales: {
    productoId: number;
    nombre: string;
    cantidad: number;
    precioUnidad: number;
  }[];
};

const ES_ID = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

/** Lista de ids de producto bien formada (o [] si no vino nada) */
function listaDeIds(bruto: unknown, max: number): number[] | null {
  if (bruto === undefined || bruto === null) return [];
  if (!Array.isArray(bruto) || bruto.length > max) return null;
  const ids: number[] = [];
  for (const x of bruto) {
    if (!ES_ID(x)) return null;
    ids.push(x);
  }
  return ids;
}

/** Relee el JSON guardado en ApartadoItem.detalle sin confiar ciegamente en él:
 *  algo malformado devuelve null y la entrega usa el respaldo de siempre. */
function leerDetallePlato(crudo: unknown): DetallePlato | null {
  if (!crudo || typeof crudo !== "object") return null;
  const d = crudo as Record<string, unknown>;
  if (typeof d.conSopa !== "boolean") return null;
  const referencia = (x: unknown): PlatoReferencia | null => {
    if (!x || typeof x !== "object") return null;
    const r = x as Record<string, unknown>;
    if (!ES_ID(r.productoId)) return null;
    const nombre = String(r.nombre ?? "").trim();
    return nombre ? { productoId: r.productoId, nombre } : null;
  };
  const proteina = referencia(d.proteina);
  if (!proteina) return null;
  const lista = (v: unknown): PlatoReferencia[] => {
    if (!Array.isArray(v)) return [];
    const salida: PlatoReferencia[] = [];
    for (const x of v) {
      const r = referencia(x);
      if (r) salida.push(r);
    }
    return salida;
  };
  const adicionales: DetallePlato["adicionales"] = [];
  if (Array.isArray(d.adicionales)) {
    for (const x of d.adicionales) {
      if (!x || typeof x !== "object") continue;
      const a = x as Record<string, unknown>;
      if (!ES_ID(a.productoId)) continue;
      const cantidad = Number(a.cantidad);
      const precioUnidad = Number(a.precioUnidad);
      if (!Number.isInteger(cantidad) || cantidad < 1) continue;
      if (!Number.isInteger(precioUnidad) || precioUnidad < 0) continue;
      adicionales.push({
        productoId: a.productoId,
        nombre: String(a.nombre ?? "").trim() || "Adicional",
        cantidad,
        precioUnidad,
      });
    }
  }
  return {
    conSopa: d.conSopa,
    proteina: d.proteina as PlatoReferencia,
    principios: lista(d.principios),
    ensaladas: lista(d.ensaladas),
    sopa: referencia(d.sopa),
    adicionales,
  };
}

/** Valores congelados de UNA línea, calculados en el servidor */
type FilaCongelada = {
  productoId: number | null;
  nombre: string;
  tipo: string;
  cantidad: number;
  precio: number;
  conSopa: boolean | null;
  nota: string | null;
  /** DetallePlato en JSON si la fila es un almuerzo completo; null en lo demás */
  detalle: string | null;
  /** Porciones del menú DE ESA FECHA que reserva mientras está pendiente
   *  (proteína, sopa exacta, principios y ensaladas), × cantidad de platos */
  reservasPorcion: {
    menuDiaItemId: number;
    productoId: number;
    productoNombre: string;
    cantidad: number;
  }[];
};

function revalidar() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");
}

// ─── Crear ──────────────────────────────────────────────────────────────────

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
  // Modalidad de entrega: por defecto se aparta para COMER EN MESA (precios
  // de salón, sin empaque); el admin puede cambiarlo a recoger y llevar. El
  // modo queda congelado con el apartado y manda sobre el precio de cada
  // plato (nunca se confía en el total que mande el navegador).
  const paraLlevar = carga.paraLlevar === true;

  // ── Preproceso las líneas: defiendo cada campo antes de tocar la base
  const lineas = Array.isArray(carga.lineas) ? carga.lineas.slice(0, 30) : [];
  const extras = Array.isArray(carga.extras) ? carga.extras.slice(0, 50) : [];
  const otros = Array.isArray(carga.otros) ? carga.otros.slice(0, 20) : [];

  if (lineas.length === 0 && extras.length === 0 && otros.length === 0) {
    return { error: "Aparta al menos un almuerzo o un ítem.", ok: null };
  }

  const preparadas: {
    conSopa: boolean;
    proteinaProductoId: number;
    cantidad: number;
    principios: number[];
    ensaladas: number[];
    sopaProductoId: number | null;
    adicionales: number[];
    nota: string | null;
  }[] = [];
  for (const linea of lineas) {
    const conSopa =
      typeof linea.conSopa === "boolean" ? linea.conSopa : null;
    if (conSopa === null) {
      return { error: "Aclara si el almuerzo lleva sopa o no.", ok: null };
    }
    const proteinaProductoId = Number(linea.proteinaProductoId);
    if (!ES_ID(proteinaProductoId)) {
      return { error: "Escoge la proteína de cada almuerzo.", ok: null };
    }
    const cantidad = Number(linea.cantidad);
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > CANTIDAD_MAX) {
      return { error: "La cantidad no es válida (1 a 50).", ok: null };
    }
    const principios = listaDeIds(linea.principiosProductoIds, 10);
    if (!principios) {
      return {
        error: "Uno de los principios no es válido. Recarga la página.",
        ok: null,
      };
    }
    const ensaladas = listaDeIds(linea.ensaladasProductoIds, 10);
    if (!ensaladas) {
      return {
        error: "Una de las ensaladas no es válida. Recarga la página.",
        ok: null,
      };
    }
    let sopaProductoId: number | null = null;
    if (conSopa && linea.sopaProductoId !== undefined && linea.sopaProductoId !== null) {
      const sid = Number(linea.sopaProductoId);
      if (!ES_ID(sid)) {
        return {
          error: "Esa sopa no es válida. Recarga la página.",
          ok: null,
        };
      }
      sopaProductoId = sid;
    }
    const adicionales = listaDeIds(linea.adicionalesProductoIds, CANTIDAD_MAX);
    if (!adicionales) {
      return {
        error: "Uno de los adicionales del plato no es válido. Recarga la página.",
        ok: null,
      };
    }
    preparadas.push({
      conSopa,
      proteinaProductoId,
      cantidad,
      principios,
      ensaladas,
      sopaProductoId,
      adicionales,
      nota: String(linea.nota ?? "").trim().slice(0, ITEM_OTRO_MAX) || null,
    });
  }

  // ── Catálogo de bebidas/adicionales (extras compartidos Y adicionales
  // dentro del plato), de una sola consulta
  const idsCatalogo = new Set<number>();
  for (const p of preparadas) for (const id of p.adicionales) idsCatalogo.add(id);
  for (const e of extras) {
    const id = Number(e.productoId);
    if (ES_ID(id)) idsCatalogo.add(id);
  }
  const catalogo =
    idsCatalogo.size > 0
      ? await db.producto.findMany({
          where: {
            id: { in: [...idsCatalogo] },
            activo: true,
            tipo: { in: ["BEBIDA", "ADICIONAL"] },
            precio: { gt: 0 },
          },
        })
      : [];
  if (catalogo.length !== idsCatalogo.size) {
    return {
      error: "Una bebida o adicional ya no está disponible. Recarga.",
      ok: null,
    };
  }
  const porProductoCatalogo = new Map(catalogo.map((p) => [p.id, p] as const));

  const filas: FilaCongelada[] = [];

  // ── Congelar los platos contra el menú DE LA FECHA DE ENTREGA. Nunca «hoy»
  // en silencio: el cliente apartó para ese día y así se le respeta el precio.
  if (preparadas.length > 0) {
    const fechaDelMenu = fechaEntrega ?? claveDia(new Date());
    const menu = await db.menuDia.findUnique({
      where: { fecha: fechaDelMenu },
      include: { items: { include: { producto: true } } },
    });
    if (!menu) {
      return {
        error: `Para el ${fechaDelMenu} todavía no hay menú. Elige otra fecha o aparta solo bebidas y lo narrado a mano.`,
        ok: null,
      };
    }

    // Componentes del menú de esa fecha por id de producto (con su ítem del
    // menú: para reservar porciones y avisar stock)
    const componentes = new Map<
      number,
      {
        itemId: number;
        stockPorciones: number | null;
        vendidos: number;
        tipo: string;
        nombre: string;
        precioPropio: number;
      }
    >();
    for (const item of menu.items) {
      if (!item.producto || !item.producto.activo || !item.visible) continue;
      if (!(TIPOS_PLATO_MENU as readonly string[]).includes(item.producto.tipo))
        continue;
      componentes.set(item.productoId, {
        itemId: item.id,
        stockPorciones: item.stockPorciones,
        vendidos: item.vendidos,
        tipo: item.producto.tipo,
        nombre: item.producto.nombre,
        precioPropio:
          item.precioEspecial ?? (item.producto.precio > 0 ? item.producto.precio : 0),
      });
    }

    for (const prep of preparadas) {
      const proteina = componentes.get(prep.proteinaProductoId);
      if (!proteina || proteina.tipo !== "PROTEINA") {
        return {
          error:
            "Un plato ya no está en el menú de esa fecha. Recarga la página y vuelve a armar los almuerzos.",
          ok: null,
        };
      }

      // Principios y ensaladas: porciones incluidas del plato (sin precio).
      // Los ids repetidos se defienden con Set para no duplicar filas.
      const principios: PlatoReferencia[] = [];
      const vistosP = new Set<number>();
      for (const id of prep.principios) {
        if (vistosP.has(id)) continue;
        const c = componentes.get(id);
        if (!c || c.tipo !== "PRINCIPIO") {
          return {
            error:
              "Un principio ya no está en el menú de esa fecha. Recarga la página.",
            ok: null,
          };
        }
        vistosP.add(id);
        principios.push({ productoId: id, nombre: c.nombre });
      }
      const ensaladas: PlatoReferencia[] = [];
      const vistosE = new Set<number>();
      for (const id of prep.ensaladas) {
        if (vistosE.has(id)) continue;
        const c = componentes.get(id);
        if (!c || c.tipo !== "ENSALADA") {
          return {
            error:
              "Una ensalada ya no está en el menú de esa fecha. Recarga la página.",
            ok: null,
          };
        }
        vistosE.add(id);
        ensaladas.push({ productoId: id, nombre: c.nombre });
      }

      // Sopa exacta si la eligieron; null = «sopa del día» al entregar
      let sopa: PlatoReferencia | null = null;
      if (prep.sopaProductoId !== null) {
        const s = componentes.get(prep.sopaProductoId);
        if (!s || s.tipo !== "SOPA") {
          return {
            error:
              "Esa sopa ya no está en el menú de esa fecha. Recarga la página.",
            ok: null,
          };
        }
        sopa = { productoId: prep.sopaProductoId, nombre: s.nombre };
      }
      if (prep.conSopa === false) sopa = null;

      // Adicionales DENTRO del plato: se cobran con su precio de catálogo,
      // congelado también al apartar
      const conteo = new Map<number, number>();
      for (const id of prep.adicionales) conteo.set(id, (conteo.get(id) ?? 0) + 1);
      const adicionalesDetalle: DetallePlato["adicionales"] = [];
      let sumaAdicionales = 0;
      for (const [id, unidades] of conteo) {
        const p = porProductoCatalogo.get(id);
        if (!p || p.tipo !== "ADICIONAL") {
          return {
            error: "Un adicional ya no está disponible. Recarga.",
            ok: null,
          };
        }
        sumaAdicionales += p.precio * unidades;
        adicionalesDetalle.push({
          productoId: id,
          nombre: p.nombre,
          cantidad: unidades,
          precioUnidad: p.precio,
        });
      }

      // Congelar el precio AHORA: especial del día (asados de domingo…) o
      // almuerzo en su modalidad — llevar (completo $14.500 · bandeja
      // $13.000) o en mesa ($13.000 · $12.000) — más los adicionales
      const precio =
        sumaAdicionales +
        (proteina.precioPropio > 0
          ? precioEspecialDelDia(proteina.precioPropio, prep.conSopa, paraLlevar)
          : precioAlmuerzo(prep.conSopa, paraLlevar));

      // Porciones del menú de esa fecha que este apartado reserva mientras
      // esté pendiente (proteína, sopa exacta si la eligieron, principios y
      // ensaladas), cada una × cuántos platos pidió. «Sopa del día» no se
      // reserva: se cuadra con la sopa del menú el día de la entrega.
      const porcionesReservadas: FilaCongelada["reservasPorcion"] = [
        {
          menuDiaItemId: proteina.itemId,
          productoId: prep.proteinaProductoId,
          productoNombre: proteina.nombre,
          cantidad: prep.cantidad,
        },
      ];
      if (sopa && prep.conSopa) {
        const si = componentes.get(sopa.productoId);
        if (!si) {
          return { error: "Esa sopa ya no está. Recarga la página.", ok: null };
        }
        porcionesReservadas.push({
          menuDiaItemId: si.itemId,
          productoId: sopa.productoId,
          productoNombre: sopa.nombre,
          cantidad: prep.cantidad,
        });
      }
      for (const p of principios) {
        const c = componentes.get(p.productoId);
        if (!c) {
          return {
            error: "Un principio ya no está en el menú. Recarga la página.",
            ok: null,
          };
        }
        porcionesReservadas.push({
          menuDiaItemId: c.itemId,
          productoId: p.productoId,
          productoNombre: p.nombre,
          cantidad: prep.cantidad,
        });
      }
      for (const e of ensaladas) {
        const c = componentes.get(e.productoId);
        if (!c) {
          return {
            error: "Una ensalada ya no está en el menú. Recarga la página.",
            ok: null,
          };
        }
        porcionesReservadas.push({
          menuDiaItemId: c.itemId,
          productoId: e.productoId,
          productoNombre: e.nombre,
          cantidad: prep.cantidad,
        });
      }

      const detalle: DetallePlato = {
        conSopa: prep.conSopa,
        proteina: { productoId: prep.proteinaProductoId, nombre: proteina.nombre },
        principios,
        ensaladas,
        sopa,
        adicionales: adicionalesDetalle,
      };
      filas.push({
        productoId: prep.proteinaProductoId,
        nombre: proteina.nombre,
        tipo: "ALMUERZO",
        cantidad: prep.cantidad,
        precio,
        conSopa: prep.conSopa,
        nota: prep.nota,
        detalle: JSON.stringify(detalle),
        reservasPorcion: porcionesReservadas,
      });
    }
  }

  // ── Extras compartidos (bebidas/adicionales de todo el apartado)
  for (const e of extras) {
    const p = porProductoCatalogo.get(Number(e.productoId));
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
      detalle: null,
      reservasPorcion: [],
    });
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
      detalle: null,
      reservasPorcion: [],
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
      // ── Las porciones que pediría este apartado, agregadas por ítem del menú
      const porItemPlan = new Map<number, number>();
      for (const f of filas) {
        for (const r of f.reservasPorcion) {
          porItemPlan.set(
            r.menuDiaItemId,
            (porItemPlan.get(r.menuDiaItemId) ?? 0) + r.cantidad,
          );
        }
      }
      if (porItemPlan.size > 0) {
        // Verificación DENTRO de la transacción: dos admins apartando a la
        // misma hora no pueden sobrecomprometer el mismo stock
        const ids = [...porItemPlan.keys()];
        const itemsDeMenu = await tx.menuDiaItem.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            stockPorciones: true,
            vendidos: true,
            producto: { select: { nombre: true } },
          },
        });
        if (itemsDeMenu.length !== ids.length) {
          throw new ErrorDeApartado(
            "El menú de esa fecha cambió mientras apartabas: recarga y vuelve a armar los almuerzos.",
          );
        }
        const tomadas = await tx.apartadoReserva.groupBy({
          by: ["menuDiaItemId"],
          _sum: { cantidad: true },
          where: {
            menuDiaItemId: { in: ids },
            apartado: { estado: ESTADO_APARTADO.PENDIENTE },
          },
        });
        const porItemTomadas = new Map(
          tomadas.map((t) => [t.menuDiaItemId as number, t._sum.cantidad ?? 0]),
        );
        for (const [itemId, cantidadPedida] of porItemPlan) {
          const item = itemsDeMenu.find((x) => x.id === itemId);
          if (!item) continue; // defiende el length !== ids.length de arriba
          if (item.stockPorciones === null) continue; // porciones ilimitadas
          const yaTomadas = porItemTomadas.get(itemId) ?? 0;
          if (item.vendidos + yaTomadas + cantidadPedida > item.stockPorciones) {
            throw new ErrorDeApartado(
              `No alcanzan las porciones de ${item.producto?.nombre ?? "un producto del menú"}: quedan ` +
                `${item.stockPorciones - item.vendidos - yaTomadas} y el apartado ` +
                `pide ${cantidadPedida}. Ajusta el stock en Menú del día o quita alguna.`,
            );
          }
        }
      }

      const apartado = await tx.apartado.create({
        data: {
          clienteId,
          estado: ESTADO_APARTADO.PENDIENTE,
          fechaEntrega,
          horaEntrega,
          horaEntregaMinutos: horaMin,
          total,
          paraLlevar,
          observaciones,
          createdById: adminId,
        },
      });
      // Ítems uno a uno: cada reserva necesita el id de su propio ítem
      for (const f of filas) {
        const item = await tx.apartadoItem.create({
          data: {
            apartadoId: apartado.id,
            productoId: f.productoId,
            nombre: f.nombre,
            tipo: f.tipo,
            cantidad: f.cantidad,
            precio: f.precio,
            conSopa: f.conSopa,
            nota: f.nota,
            detalle: f.detalle,
          },
        });
        if (f.reservasPorcion.length > 0) {
          await tx.apartadoReserva.createMany({
            data: f.reservasPorcion.map((r) => ({
              apartadoId: apartado.id,
              apartadoItemId: item.id,
              menuDiaItemId: r.menuDiaItemId,
              productoId: r.productoId,
              productoNombre: r.productoNombre,
              cantidad: r.cantidad,
            })),
          });
        }
      }
      return apartado.id;
    });
  } catch (e) {
    if (e instanceof ErrorDeApartado) {
      return { error: e.message, ok: null };
    }
    return { error: "No se pudo guardar el apartado. Intenta otra vez.", ok: null };
  }

  revalidar();
  return {
    error: null,
    ok: `Apartado #${nuevoId} de ${cliente.nombre} por ${formatCOP(total)} guardado (entrega a ${horaEntrega ?? "más tarde"}).`,
  };
}

// ─── Cancelar ───────────────────────────────────────────────────────────────

/** Cancela un apartado pendiente: libera las porciones reservadas (stock) y
 *  queda anulado con trazabilidad (no se borra el registro). */
export async function cancelarApartado(
  _previa: EstadoAccionApartado,
  datos: FormData,
): Promise<EstadoAccionApartado> {
  let adminId: number;
  try {
    const sesion = await exigirAdmin();
    adminId = sesion.id;
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
  try {
    // El guard de estado DENTRO de la transacción hace idempotente la
    // cancelación: si la entrega ganó la carrera primero, nadie pierde stock.
    await db.$transaction(async (tx) => {
      const guardia = await tx.apartado.updateMany({
        where: { id: apartadoId, estado: ESTADO_APARTADO.PENDIENTE },
        data: {
          estado: ESTADO_APARTADO.CANCELADO,
          canceladoById: adminId,
          canceladoAt: new Date(),
        },
      });
      if (guardia.count !== 1) {
        throw new ErrorDeApartado("Ese apartado ya se entregó: no se puede cancelar.");
      }
      // Libera las porciones que tenía reservadas en su fecha de entrega
      await tx.apartadoReserva.deleteMany({ where: { apartadoId } });
    });
  } catch (e) {
    if (e instanceof ErrorDeApartado) {
      return { error: e.message, ok: null };
    }
    return { error: "No se pudo cancelar el apartado. Intenta otra vez.", ok: null };
  }
  revalidar();
  return { error: null, ok: "Apartado cancelado: las porciones quedaron libres." };
}

// ─── Entregar (cobrado o fiado) ──────────────────────────────────────────────

/**
 * Entrega un apartado: nace la comanda (cocina la ve en Órdenes, la mesa
 * queda LIBRE para que la caja no la muestre), los precios CONGELADOS del
 * apartado viajan tal cual y las porciones RESERVADAS se convierten en
 * consumo real (vendidos) — el ledger se libera. Con método termina en cobro
 * con propina y vueltas (como Domicilios) y recibo; sin método queda fiado
 * (nace la deuda «Apartado #N»).
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

  // Cobro COMO DOMICILIOS: propina por preset y billete con el que paga;
  // las vueltas las calcula el servidor (nada de celulares en la caja)
  let propina = 0;
  let montoPagado: number | null = null;
  let vueltas: number | null = null;
  if (!fiado) {
    propina = Number.parseInt(
      String(datos.get("propina") ?? "").replace(/[^0-9]/g, "") || "0",
      10,
    );
    if (!Number.isInteger(propina) || propina < 0 || propina > 1_000_000) {
      return { error: "La propina ingresada no es válida.", ok: null };
    }
    // «¿Con cuánto paga?» solo tiene sentido en efectivo; tarjeta y
    // transferencia se cobran al centavo (exacto, sin vueltas)
    const crudoPagado = String(datos.get("montoPagado") ?? "").replace(/[^0-9]/g, "");
    if (crudoPagado !== "") {
      montoPagado = Number.parseInt(crudoPagado, 10);
      if (!Number.isInteger(montoPagado) || montoPagado <= 0) {
        return { error: "El monto recibido no es válido.", ok: null };
      }
    }
  }

  const apartado = await db.apartado.findUnique({
    where: { id: apartadoId },
    include: { items: true, cliente: true, reservas: true },
  });
  if (!apartado) return { error: "Ese apartado ya no existe.", ok: null };
  if (apartado.estado !== ESTADO_APARTADO.PENDIENTE) {
    return { error: "Ese apartado ya se entregó o se canceló.", ok: null };
  }
  // Si el apartado ya se FIO desde «Cuentas por cobrar», la entrega solo
  // nace fiada (esa deuda es la misma promesa): no se cobra aquí — el dinero
  // entra con abonos — ni se crea otra deuda (no se cuenta doble).
  if (apartado.cuentaId !== null && !fiado) {
    return {
      error:
        `Este apartado ya está fiado (deuda en «Cuentas por cobrar»): ` +
        "se entrega fiado y el cobro se hace con abonos.",
      ok: null,
    };
  }
  if (apartado.items.every((i) => i.cantidad < 1)) {
    return { error: "El apartado no tiene ítems con entrega.", ok: null };
  }
  if (
    montoPagado !== null &&
    montoPagado < apartado.total + propina
  ) {
    return {
      error:
        `No alcanza: el cliente entregó ${formatCOP(montoPagado)} y la cuenta ` +
        `es ${formatCOP(apartado.total + propina)}.`,
      ok: null,
    };
  }
  vueltas =
    montoPagado !== null ? montoPagado - apartado.total - propina : null;

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
      if (!item.producto || !item.producto.activo || !item.visible) continue;
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
  // Por id de ítem del menú (las reservas apuntan por ahí, no por producto)
  const nombreDelMenuItem = new Map<number, string>();
  for (const item of menuHoy?.items ?? []) {
    if (item.producto) nombreDelMenuItem.set(item.id, item.producto.nombre);
  }

  // Lo que consume: las porciones RESERVADAS por el apartado (el ledger se
  // convierte en consumo real al entregar), más la sopa del día de los platos
  // que la dejaron decidir. Los apartados viejos (sin reservas) siguen el
  // respaldo de siempre: proteína y sopa del menú de HOY.
  const vaConReservas = apartado.reservas.length > 0;
  const consumo = new Map<number, { nombre: string; cantidad: number }>();
  if (vaConReservas) {
    for (const r of apartado.reservas) {
      if (!r.menuDiaItemId) continue; // le borraron el ítem del menú: nada que aguantar
      const previa = consumo.get(r.menuDiaItemId);
      consumo.set(r.menuDiaItemId, {
        nombre:
          nombreDelMenuItem.get(r.menuDiaItemId) ??
          previa?.nombre ??
          "un componente del menú",
        cantidad: (previa?.cantidad ?? 0) + r.cantidad,
      });
    }
    // Sopa del día de los platos que no la eligieron exacta
    for (const item of apartado.items) {
      const esAlmuerzo = item.tipo === "ALMUERZO" || item.tipo === "ALMUEZO";
      if (!esAlmuerzo || item.conSopa !== true) continue;
      if (item.detalle) {
        try {
          if (leerDetallePlato(JSON.parse(item.detalle))?.sopa) continue;
        } catch {
          // detalle roto: cae al fallback legacy abajo
        }
      }
      if (!sopaDeHoy) continue;
      const previa = consumo.get(sopaDeHoy[1].itemId);
      consumo.set(sopaDeHoy[1].itemId, {
        nombre: sopaDeHoy[1].nombre,
        cantidad: (previa?.cantidad ?? 0) + item.cantidad,
      });
    }
  } else {
    // Respaldo para apartados guardados antes de las reservas: lo que consume
    // del menú de HOY es la proteína y la sopa de cada almuerzo
    for (const item of apartado.items) {
      // «ALMUEZO» = filas viejas guardadas antes del renombre
      if (!item.tipo || (item.tipo !== "ALMUEZO" && item.tipo !== "ALMUERZO")) {
        continue;
      }
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

      // Las reservas SE CONVIRTIERON en consumo real: salen del ledger. Si la
      // transacción falla (guardo abajo), el rollback las devuelve.
      await tx.apartadoReserva.deleteMany({ where: { apartadoId: apartado.id } });

      const pedido = await tx.pedido.create({
        data: {
          mesaId: mesa.id,
          meseroId: adminId,
          estado: "SERVIDO",
          // La modalidad congelada al apartar: recoger sale con empaque,
          // «en mesa» sale a los platos del salón
          paraLlevar: apartado.paraLlevar,
          observaciones,
        },
      });

      // Comandas: cada almuerzo es un grupo completo (proteína que cobra el
      // plato con su precio congelado, su sopa y sus porciones incluidas);
      // los extras compartidos viajan en el grupo 0.
      const filasPedido: {
        productoId: number;
        /** FOTO del nombre: la línea sobrevive al borrado del producto */
        productoNombre: string;
        tipo: string;
        cantidad: number;
        precio: number | null;
        conSopa: boolean | null;
        grupo: number;
        nota: string | null;
      }[] = [];
      let grupo = 0;

      for (const item of apartado.items) {
        // «ALMUEZO» = filas viejas guardadas antes del renombre
        const esAlmuerzo = item.tipo === "ALMUERZO" || item.tipo === "ALMUEZO";
        if (!esAlmuerzo || !item.productoId) continue;
        let detalle: DetallePlato | null = null;
        if (item.detalle) {
          try {
            detalle = leerDetallePlato(JSON.parse(item.detalle));
          } catch {
            detalle = null;
          }
        }
        // El precio congelado del apartado INCLUYE los adicionales del plato:
        // la fila de la proteína imprime el plato solo, y cada adicional
        // viaja en su propia fila (igual que en las comandas del mesero)
        const sumaAdicionales = detalle
          ? detalle.adicionales.reduce((s, a) => s + a.precioUnidad * a.cantidad, 0)
          : 0;
        const precioPlatoCongelado = Math.max(0, item.precio - sumaAdicionales);
        for (let i = 0; i < item.cantidad; i++) {
          grupo += 1;
          filasPedido.push({
            productoId: item.productoId,
            productoNombre: item.nombre, // congelado al apartar
            tipo: "PROTEINA",
            cantidad: 1,
            precio: precioPlatoCongelado, // congelado al apartar (sin adicionales)
            conSopa: item.conSopa,
            grupo,
            nota: item.nota, // nota de cocina congelada con el apartado
          });
          if (item.conSopa === true) {
            // La sopa congelada exacta o la Sopa del día de la entrega
            const sopaEntrega: { productoId: number; nombre: string } | null =
              detalle?.sopa
                ? { productoId: detalle.sopa.productoId, nombre: detalle.sopa.nombre }
                : sopaDeHoy
                  ? { productoId: sopaDeHoy[0], nombre: sopaDeHoy[1].nombre }
                  : null;
            if (sopaEntrega) {
              filasPedido.push({
                productoId: sopaEntrega.productoId,
                productoNombre: sopaEntrega.nombre,
                tipo: "SOPA",
                cantidad: 1,
                precio: 0,
                conSopa: null,
                grupo,
                nota: null,
              });
            }
          }
          // Porciones incluidas y adicionales congelados, dentro del «PEDIDO n»
          if (detalle) {
            for (const p of detalle.principios) {
              filasPedido.push({
                productoId: p.productoId,
                productoNombre: p.nombre,
                tipo: "PRINCIPIO",
                cantidad: 1,
                precio: 0,
                conSopa: null,
                grupo,
                nota: null,
              });
            }
            for (const e of detalle.ensaladas) {
              filasPedido.push({
                productoId: e.productoId,
                productoNombre: e.nombre,
                tipo: "ENSALADA",
                cantidad: 1,
                precio: 0,
                conSopa: null,
                grupo,
                nota: null,
              });
            }
            for (const a of detalle.adicionales) {
              filasPedido.push({
                productoId: a.productoId,
                productoNombre: a.nombre,
                tipo: "ADICIONAL",
                cantidad: a.cantidad,
                precio: a.precioUnidad,
                conSopa: null,
                grupo,
                nota: null,
              });
            }
          }
        }
      }

      for (const item of apartado.items) {
        if (!item.productoId) continue;
        if (
          item.tipo === "ALMUEZO" ||
          item.tipo === "ALMUERZO" ||
          item.tipo === "OTRO"
        ) {
          continue;
        }
        filasPedido.push({
          productoId: item.productoId,
          productoNombre: item.nombre, // congelado al apartar
          tipo: item.tipo,
          cantidad: item.cantidad,
          precio: item.precio,
          conSopa: null,
          grupo: 0,
          nota: null,
        });
      }

      if (filasPedido.length === 0 && narrados.length === 0) {
        throw new ErrorDeApartado("El apartado quedó sin líneas de comanda.");
      }
      await tx.pedidoItem.createMany({
        data: filasPedido.map((f) => ({
          pedidoId: pedido.id,
          productoId: f.productoId,
          productoNombre: f.productoNombre,
          tipo: f.tipo,
          cantidad: f.cantidad,
          precio: f.precio,
          conSopa: f.conSopa,
          grupo: f.grupo,
          nota: f.nota,
        })),
      });

      // La mesa queda LIBRE: la caja no debe listar apartados
      await tx.mesa.update({
        where: { id: mesa.id },
        data: { estado: "LIBRE" },
      });

      if (fiado) {
        // FOTO del desglose: los items recién creados (sus ids y sus precios
        // congelados) alimentan CuentaPorCobrarItem vía el motor de fiados
        const itemsFoto = await tx.pedidoItem.findMany({
          where: { pedidoId: pedido.id },
          include: { producto: { select: { nombre: true, precio: true } } },
        });
        let cuentaId: number;
        if (apartado.cuentaId !== null) {
          // Ya se fió ANTES de entregar (cuenta ligada al apartado): la
          // comanda nace con esa MISMA deuda — no se vuelve a fiar, no se
          // toca caja. Trazabilidad: la deuda ancla también a la comanda.
          cuentaId = apartado.cuentaId;
          await tx.cuentaPorCobrar.update({
            where: { id: cuentaId },
            data: { pedidoId: pedido.id },
          });
        } else {
          cuentaId = await crearCuentaFiadaTx(tx, {
            clienteId: apartado.clienteId,
            concepto: `Apartado #${apartado.id}`,
            valorOriginal: apartado.total,
            pedidoId: pedido.id,
            createdById: adminId,
            items: itemsFoto,
          });
        }
        // Comanda FIADA: sale de todas las colas (cocina/ordenes/caja); el
        // recaudo entra el día de los abonos, no el día del fiado
        await tx.pedido.update({
          where: { id: pedido.id },
          data: { estado: ESTADO_PEDIDO.FIADO },
        });
        // Guard idempotente DENTRO de la transacción: si otra pantalla entregó
        // o canceló primero, la cuenta nace ya no y el rollback deshace todo
        const guardia = await tx.apartado.updateMany({
          where: { id: apartado.id, estado: ESTADO_APARTADO.PENDIENTE },
          data: {
            estado: ESTADO_APARTADO.ENTREGADO,
            pedidoId: pedido.id,
            cuentaId,
            entregadoAt: new Date(),
          },
        });
        if (guardia.count !== 1) {
          throw new ErrorDeApartado(
            "Ese apartado acaba de entregarse o cancelarse en otra pantalla.",
          );
        }
        return null;
      }

      const pago = await tx.pago.create({
        data: {
          pedidoId: pedido.id,
          total: apartado.total,
          propina,
          metodo: crudoMetodo,
          montoPagado,
          vueltas,
        },
      });
      await tx.pedido.update({
        where: { id: pedido.id },
        data: { estado: "COBRADO" },
      });
      const guardia = await tx.apartado.updateMany({
        where: { id: apartado.id, estado: ESTADO_APARTADO.PENDIENTE },
        data: {
          estado: ESTADO_APARTADO.ENTREGADO,
          pedidoId: pedido.id,
          entregadoAt: new Date(),
        },
      });
      if (guardia.count !== 1) {
        throw new ErrorDeApartado(
          "Ese apartado acaba de entregarse o cancelarse en otra pantalla.",
        );
      }
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
