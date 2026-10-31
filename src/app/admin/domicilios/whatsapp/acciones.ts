"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { menuDeHoy, crearPedido, ErrorDePedido, type CargaPedido } from "@/lib/pedido";
import { ESTADO_DOMICILIO, ESTADO_PEDIDO } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import {
  parsearMensaje,
  type BorradorParseado,
  type ClienteHistorial,
  type ExtraSimple,
  type LineaExtra,
  type LineaMenu,
} from "./parser";

/** Resultado de entender un mensaje: o error o el borrador listo para revisar */
export type EstadoAnalisis = {
  error: string | null;
  ok: string | null;
  borrador: BorradorParseado | null;
};

function revalidarDomicilios() {
  revalidatePath("/admin", "layout");
  revalidatePath("/ordenes", "layout");
  revalidatePath("/domicilios", "layout");
  realtime.broadcast("update");
}

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Qué pidió el mensaje: el borrador armado contra el menú de HOY */
export async function analizarMensaje(
  _previa: EstadoAnalisis,
  datos: FormData,
): Promise<EstadoAnalisis> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede usar la bandeja.", ok: null, borrador: null };
  }

  const mensaje = texto(datos.get("mensaje"), 600);
  if (mensaje.length < 4) {
    return {
      error: "Pega el mensaje de WhatsApp (o al menos lo del pedido).",
      ok: null,
      borrador: null,
    };
  }

  const [menu, extras, ultimosDomicilios] = await Promise.all([
    menuDeHoy(),
    db.producto.findMany({
      where: { activo: true, tipo: { in: ["BEBIDA", "ADICIONAL"] } },
    }),
    db.domicilio.findMany({
      where: {
        estado: { not: ESTADO_DOMICILIO.CANCELADO },
        pedido: { estado: { not: ESTADO_PEDIDO.CANCELADO } },
      },
      orderBy: { createdAt: "desc" },
      select: { cliente: true, telefono: true, direccion: true, barrio: true, referencia: true },
      take: 60,
    }),
  ]);

  if (menu.length === 0) {
    return {
      error: "Todavía no hay menú para hoy: ármalo en Menú del día antes de registrar domicilios.",
      ok: null,
      borrador: null,
    };
  }

  // Historial por teléfono: el primero que aparece (día reciente abajo) es
  // su contacto más vigente; cuenta cuántas veces repitió.
  const historial = new Map<string, { contacto: { cliente: string; telefono: string; direccion: string; barrio: string | null; referencia: string | null }; pedidos: number }>();
  for (const dom of ultimosDomicilios) {
    const visto = historial.get(dom.telefono);
    if (visto) visto.pedidos += 1;
    else {
      historial.set(dom.telefono, {
        contacto: {
          cliente: dom.cliente,
          telefono: dom.telefono,
          direccion: dom.direccion,
          barrio: dom.barrio,
          referencia: dom.referencia,
        },
        pedidos: 1,
      });
    }
  }
  const clientes: ClienteHistorial[] = [...historial.values()]
    .sort((a, b) => b.pedidos - a.pedidos)
    .map((h) => ({ ...h.contacto, pedidos: h.pedidos }));

  const borrador = parsearMensaje(mensaje, {
    menu,
    extras: extras.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.tipo, precio: p.precio })) satisfies ExtraSimple[],
    clientes,
  });

  return {
    error: null,
    ok: borrador.armable
      ? "Esto entendí del mensaje: revisa el borrador y confirma."
      : "No pude armar el plato del mensaje: revisa las notas y ábrelo a mano.",
    borrador,
  };
}

/** Píldoras del plato dentro de la carga del borrador (+notas hora, para sobrevivir a un error) */
type CargaBorrador = {
  cantidad: number;
  conSopa: boolean;
  proteina: LineaMenu | null;
  principios: LineaMenu[];
  ensaladas: LineaMenu[];
  sopa: LineaMenu | null;
  extras: LineaExtra[];
  notas: string[];
  hora?: string | null;
};

const esCargaBorrador = (x: unknown): x is CargaBorrador => {
  if (typeof x !== "object" || x === null) return false;
  const b = x as Record<string, unknown>;
  return (
    typeof b.cantidad === "number" &&
    typeof b.conSopa === "boolean" &&
    Array.isArray(b.principios) &&
    Array.isArray(b.ensaladas) &&
    Array.isArray(b.extras) &&
    Array.isArray(b.notas)
  );
};

/** Al fallar: reconstruye el borrador fiel (plato + contacto y hora tecleados + notas) */
async function borradorDeRetorno(base: CargaBorrador, datos: FormData): Promise<BorradorParseado> {
  const cliente = texto(datos.get("cliente"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  const direccion = texto(datos.get("direccion"), 120);
  const barrio = texto(datos.get("barrio"), 60) || null;
  const referencia = texto(datos.get("referencia"), 120) || null;
  const hora = texto(datos.get("horaEntrega"), 40) || base.hora || "";
  return {
    cantidad: base.cantidad,
    conSopa: base.conSopa,
    armable: base.proteina !== null,
    proteina: base.proteina,
    principios: base.principios,
    ensaladas: base.ensaladas,
    sopa: base.sopa,
    hora: hora || null,
    extras: base.extras,
    cliente,
    telefono,
    direccion,
    barrio: barrio ?? "",
    referencia: referencia ?? "",
    telefonoDelMensaje: false,
    notas: base.notas ?? [],
  };
}

/**
 * Confirma el borrador: crea N comandas idénticas sobre la mesa virtual de
 * domicilios y los sus filas de entrega. Si a mitad del lote se agota algo,
 * reporta cuántos quedaron creados para no perder la cuenta.
 */
export async function crearDomiciliosDesdeBorrador(
  _previa: EstadoAnalisis,
  datos: FormData,
): Promise<EstadoAnalisis> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede registrar domicilios.", ok: null, borrador: null };
  }

  let base: CargaBorrador | null = null;
  try {
    base = JSON.parse(String(datos.get("borrador") ?? "")) as CargaBorrador;
  } catch {
    base = null;
  }
  if (!base || !esCargaBorrador(base) || !base.proteina) {
    return {
      error: "El borrador se dañó o no tiene proteína: analiza el mensaje otra vez.",
      ok: null,
      borrador: null,
    };
  }

  // Contacto OPCIONAL: los clientes fijos no dan nombre ni dirección (el
  // repartidor los conoce de memoria) y el value del almuerzo cae a
  // Reportes igual, cobrado contra entrega.
  const cliente = texto(datos.get("cliente"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  const direccion = texto(datos.get("direccion"), 120);
  const barrio = texto(datos.get("barrio"), 60) || null;
  const referencia = texto(datos.get("referencia"), 120) || null;
  const observaciones = texto(datos.get("observaciones"), 140) || null;
  const horaEntrega = texto(datos.get("horaEntrega"), 40) || base.hora || null;
  // La hora de entrega va a la comanda como nota para la cocina
  const observacionesFinal =
    [horaEntrega ? `Entrega: ${horaEntrega}` : null, observaciones]
      .filter(Boolean)
      .join(" · ") || null;

  const cantidad = Math.min(6, Math.max(1, Math.round(base.cantidad || 1)));
  const mesaVirtual = await db.mesa.findFirst({
    where: { esDomicilio: true },
    select: { id: true },
  });
  if (!mesaVirtual) {
    return {
      error: "No existe la mesa virtual de domicilios. Corre el seed de datos.",
      ok: null,
      borrador: await borradorDeRetorno(base, datos),
    };
  }

  // La carga del borrador → la carga oficial de crearPedido (extras = 1 id
  // por unidad, igual que manda el formulario)
  const carga: CargaPedido = {
    conSopa: base.conSopa,
    proteinaId: base.proteina.itemId,
    principios: base.principios.map((l) => l.itemId),
    ensaladas: base.ensaladas.map((l) => l.itemId),
    sopaId: base.sopa ? base.sopa.itemId : null,
    extras: base.extras.flatMap((e) =>
      Array.from({ length: Math.min(5, Math.max(1, e.cantidad)) }, () => e.productoId),
    ),
    llevar: true,
  };

  let creados = 0;
  for (let i = 0; i < cantidad; i++) {
    let pedidoId: number;
    try {
      pedidoId = await crearPedido({
        mesaId: mesaVirtual.id,
        meseroId: null,
        carga,
        observaciones: observacionesFinal,
        permitirMesaVirtual: true,
      });
    } catch (e) {
      if (creados > 0) {
        revalidarDomicilios();
        return {
          error: null,
          ok: `Se crearon ${creados} de ${cantidad}: ${
            e instanceof ErrorDePedido ? e.message : "falló el último"
          }. El resto está en el tablero para repetir.`,
          borrador: null,
        };
      }
      return {
        error:
          e instanceof ErrorDePedido
            ? e.message
            : "No se pudo crear el domicilio. Intenta otra vez.",
        ok: null,
        borrador: await borradorDeRetorno(base, datos),
      };
    }

    await db.domicilio.create({
      data: {
        pedidoId,
        cliente,
        telefono,
        direccion,
        barrio,
        referencia,
        estado: ESTADO_DOMICILIO.PENDIENTE,
      },
    });
    creados++;
  }

  revalidarDomicilios();
  redirect("/admin/domicilios");
}
