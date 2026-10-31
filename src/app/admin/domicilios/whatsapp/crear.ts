// Creación de domicilios desde un borrador pronto (del parser de WhatsApp o
// del formulario pegado a mano). Server-only: lo usan la bandeja y la API de
// entradas. Nunca revalida ni redirecciona: eso lo decide el caller.
import { db } from "@/lib/db";
import { crearPedido, ErrorDePedido, type CargaPedido } from "@/lib/pedido";
import { minutosDeHora } from "@/lib/hora";
import { ESTADO_DOMICILIO } from "@/lib/roles";
import type { BorradorParseado, LineaMenu } from "./parser";

/** El contacto de la entrega: todo opcional salvo lo que el caller pida */
export type ContactoDomicilio = {
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  /** Hora futura que dijo el cliente ("las 12", "la 1 y media"); va al tablero */
  horaEntrega: string | null;
  /** Nota para la cocina, distinta de la hora */
  observaciones: string | null;
};

/** Lo mínimo que necesita la comanda (salido del parser o del formulario) */
export type CargaMinima = {
  cantidad: number;
  conSopa: boolean;
  proteina: LineaMenu | null;
  principios: LineaMenu[];
  ensaladas: LineaMenu[];
  sopa: LineaMenu | null;
  /** productoId + cuántas unidades de ese extra (para	explosión de cantidades) */
  extras: { productoId: number; cantidad: number }[];
};

export type ResultadoCreacion = {
  creados: number;
  pedidoIds: number[];
  /** null = todo bien; con texto = nada creado o el lote quedó a medias */
  error: string | null;
};

/** La carga mínima extraída de un borrador completo del parser */
export function cargaDeBorrador(borrador: BorradorParseado): CargaMinima {
  return {
    cantidad: borrador.cantidad,
    conSopa: borrador.conSopa,
    proteina: borrador.proteina,
    principios: borrador.principios,
    ensaladas: borrador.ensaladas,
    sopa: borrador.sopa,
    extras: borrador.extras.map((e) => ({
      productoId: e.productoId,
      cantidad: e.cantidad,
    })),
  };
}

/**
 * Crea la comanda de 1 a muchos almuerzos idénticos sobre la mesa virtual de
 * domicilios, con su fila Domicilio (contacto + hora de entrega). Si a mitad
 * del lote se agota algo, devuelve lo creado y el error para que el caller
 * decida el mensaje (el resto queda en el tablero para repetirlo).
 */
export async function crearDomiciliosDeBorrador(
  base: CargaMinima,
  contacto: ContactoDomicilio,
): Promise<ResultadoCreacion> {
  if (!base.proteina) {
    return { creados: 0, pedidoIds: [], error: "El borrador no tiene proteína." };
  }

  const mesaVirtual = await db.mesa.findFirst({
    where: { esDomicilio: true },
    select: { id: true },
  });
  if (!mesaVirtual) {
    return {
      creados: 0,
      pedidoIds: [],
      error: "No existe la mesa virtual de domicilios. Corre el seed de datos.",
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

  // La nota para la cocina lleva la hora ("Entrega: la 1 y media"); la hora
  // también queda en el campo propio de Domicilio para el tablero
  const observacionesFinal =
    [contacto.horaEntrega ? `Entrega: ${contacto.horaEntrega}` : null, contacto.observaciones]
      .filter(Boolean)
      .join(" · ") || null;

  const cantidad = Math.min(6, Math.max(1, Math.round(base.cantidad || 1)));
  const pedidoIds: number[] = [];
  let error: string | null = null;

  for (let i = 0; i < cantidad; i++) {
    try {
      const pedidoId = await crearPedido({
        mesaId: mesaVirtual.id,
        meseroId: null,
        carga,
        observaciones: observacionesFinal,
        permitirMesaVirtual: true,
      });
      await db.domicilio.create({
        data: {
          pedidoId,
          cliente: contacto.cliente,
          telefono: contacto.telefono,
          direccion: contacto.direccion,
          barrio: contacto.barrio,
          referencia: contacto.referencia,
          horaEntrega: contacto.horaEntrega,
          horaEntregaMinutos: minutosDeHora(contacto.horaEntrega),
          estado: ESTADO_DOMICILIO.PENDIENTE,
        },
      });
      pedidoIds.push(pedidoId);
    } catch (e) {
      error =
        e instanceof ErrorDePedido
          ? e.message
          : "No se pudo crear el domicilio. Intenta otra vez.";
      break;
    }
  }

  return { creados: pedidoIds.length, pedidoIds, error };
}
