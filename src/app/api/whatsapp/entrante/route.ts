// Entrada de WhatsApp al sistema, SIN nube ni webhooks. El sistema es local,
// así que quien tiene la sesión de WhatsApp es el puente (whatsapp-bridge/,
// Baileys): corre en la misma PC y reenvía cada mensaje de cliente acá.
// Si en vez del puente usas una app forwarder de notificaciones en el teléfono,
// también entra: manda { remitente, texto } en lugar de nombre/teléfono.
// Guardias: secreto compartido (x-puente-secreto) + antiduplicados de 3 min.
//
// Config en .env del servidor:
//   WHATSAPP_BRIDGE_SECRET="el mismo secreto del puente"
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { realtime } from "@/lib/realtime";
import { enviarWhatsapp, normalizarTelefono } from "@/lib/whatsapp";
import { avisoNoEntendido, confirmacionDomicilio } from "@/lib/mensajes-whatsapp";
import { precioAlmuerzo } from "@/lib/precios";
import { borradorDeMensaje, leerAutoRegistrar } from "@/app/admin/domicilios/whatsapp/contexto";
import { cargaDeBorrador, crearDomiciliosDeBorrador } from "@/app/admin/domicilios/whatsapp/crear";

/** Secreto compartido con el puente (o con el forwarder del teléfono) */
const SECRETO = process.env.WHATSAPP_BRIDGE_SECRET ?? process.env.WHATSAPP_API_KEY ?? "";

/** Ventana en la que un mismo mensaje crudo cuenta como duplicado */
const VENTANA_DUPLICADO_MS = 3 * 60 * 1000;

export type RespuestaEntrante = {
  ok: boolean;
  duplicado?: boolean;
  /** true si el sistema ya creó el domicilio solo */
  registrado?: boolean;
  armable?: boolean;
  autoCreado?: boolean;
  pedidoIds?: number[];
  notas?: string[];
  /** Qué pasó, en una frase: lo que el puente imprime en su consola */
  motivo?: string;
  error?: string;
};

export async function POST(req: NextRequest): Promise<Response> {
  // 1) Guardia del puente / forwarder
  if (!SECRETO || req.headers.get("x-puente-secreto") !== SECRETO) {
    return Response.json(
      { ok: false, error: "No autorizado." } satisfies RespuestaEntrante,
      { status: 401 },
    );
  }

  // 2) El cuerpo: teléfono y nombre del remitente (puente) o remitente (forwarder)
  let cuerpo: { telefono?: unknown; nombre?: unknown; remitente?: unknown; texto?: unknown };
  try {
    cuerpo = (await req.json()) as typeof cuerpo;
  } catch {
    return Response.json(
      { ok: false, error: "JSON inválido." } satisfies RespuestaEntrante,
      { status: 400 },
    );
  }
  const telefono = normalizarTelefono(cuerpo.telefono);
  const remitente = String(cuerpo.nombre ?? cuerpo.remitente ?? "").trim().slice(0, 60);
  const texto = String(cuerpo.texto ?? "").trim().slice(0, 600);
  if (texto.length < 2) {
    return Response.json(
      { ok: false, error: "Mensaje sin texto suficiente." } satisfies RespuestaEntrante,
      { status: 400 },
    );
  }

  // 3) Antiduplicados: la misma notificación reenviada cae en el mismo hash
  //    dentro de la ventana; el mismo texto de otro día entra normal.
  const claveDedupe = crypto
    .createHash("sha256")
    .update(`${telefono}|${texto}`)
    .digest("hex");
  const duplicado = await db.entradaWhatsapp.findFirst({
    where: {
      claveDedupe,
      recibidoAt: { gte: new Date(Date.now() - VENTANA_DUPLICADO_MS) },
    },
    select: { id: true },
  });
  if (duplicado) {
    return Response.json({ ok: true, duplicado: true } satisfies RespuestaEntrante);
  }

  // 4) Entender el mensaje contra el menú de HOY y guardar la entrada
  const [borrador, auto] = await Promise.all([borradorDeMensaje(texto), leerAutoRegistrar()]);

  const entrada = await db.entradaWhatsapp.create({
    data: {
      remitente,
      telefono,
      texto,
      claveDedupe,
      armable: borrador.armable,
      borrador: JSON.stringify(borrador),
    },
  });

  const respuesta: RespuestaEntrante = {
    ok: true,
    armable: borrador.armable,
    notas: borrador.notas,
    registrado: false,
    motivo: "guardado en la bandeja",
  };

  if (auto && borrador.armable) {
    // 5) Auto-registro: el domicilio queda creado al instante y el cliente
    //    recibe su confirmación; luego al repartidor solo le queda entregar.
    const resultado = await crearDomiciliosDeBorrador(cargaDeBorrador(borrador), {
      // El nombre del contacto guardado vale como cliente (Martina); los
      // datos de ruta quedan vacíos a propósito: el repartidor la conoce.
      cliente: borrador.cliente || remitente || "Cliente WhatsApp",
      telefono: borrador.telefono || telefono,
      direccion: borrador.direccion || "",
      barrio: borrador.barrio || null,
      referencia: borrador.referencia || null,
      horaEntrega: borrador.hora,
      observaciones: null,
    });

    if (resultado.creados > 0) {
      await db.entradaWhatsapp.update({
        where: { id: entrada.id },
        data: { estado: "CONVERTIDO", pedidoId: resultado.pedidoIds[0] ?? null },
      });
      respuesta.autoCreado = true;
      respuesta.registrado = true;
      respuesta.pedidoIds = resultado.pedidoIds;
      respuesta.motivo = "domicilio creado";

      const porUno =
        precioAlmuerzo(borrador.conSopa, true) +
        borrador.extras.reduce((s, e) => s + e.precio * e.cantidad, 0);
      await enviarWhatsapp(
        telefono,
        confirmacionDomicilio({
          cantidad: resultado.creados,
          conSopa: borrador.conSopa,
          proteina: borrador.proteina?.nombre ?? "almuerzo",
          total: porUno * resultado.creados,
          hora: borrador.hora,
          parcial: resultado.error,
        }),
      );
    }
    if (resultado.error) {
      // Nada creado → la entrada queda NUEVO para revisarla en la bandeja;
      // lote a medias → quedó lo bueno y el error se entrega al puente
      respuesta.motivo = resultado.error;
      if (resultado.creados === 0) {
        respuesta.autoCreado = false;
        respuesta.error = resultado.error;
      }
    }
  } else if (borrador.armable) {
    // El borrador es bueno, pero el auto-registro está apagado: lo confirma el admin
    respuesta.motivo = "auto-registro apagado";
  } else {
    // No se pudo armar: el equipo lo revisa a mano, pero el cliente recibe aviso
    respuesta.motivo = "no se pudo armar";
    await enviarWhatsapp(telefono, avisoNoEntendido());
  }

  // 6) Que la bandeja y el tablero se refresquen solos
  revalidatePath("/admin", "layout");
  revalidatePath("/ordenes", "layout");
  revalidatePath("/domicilios", "layout");
  revalidatePath("/admin/domicilios/whatsapp", "layout");
  realtime.broadcast("update");

  return Response.json(respuesta, {
    status: respuesta.error ? 422 : 200,
  });
}
