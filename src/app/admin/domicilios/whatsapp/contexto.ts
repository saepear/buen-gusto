// Contexto compartido para entender los mensajes de WhatsApp y la bandera
// de auto-registro. Módulo server (sin "use server"): lo usan los server
// actions de la bandeja y la API de entradas (/api/whatsapp/entrante).
import { db } from "@/lib/db";
import { menuDeHoy } from "@/lib/pedido";
import { ESTADO_DOMICILIO, ESTADO_PEDIDO } from "@/lib/roles";
import { parsearMensaje, type BorradorParseado, type ExtraSimple } from "./parser";

/** Historial de clientes con culquier domicilio registrado */
export type ClienteHistorial = {
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  pedidos: number;
};

/** El contexto de HOY que el parser necesita: menú vigente, catálogo e historial */
export async function contextoParaParsear(): Promise<{
  menu: Awaited<ReturnType<typeof menuDeHoy>>;
  extras: ExtraSimple[];
  clientes: ClienteHistorial[];
}> {
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
      select: {
        cliente: true,
        telefono: true,
        direccion: true,
        barrio: true,
        referencia: true,
      },
      take: 60,
    }),
  ]);

  // Historial por teléfono: el primero que aparece (más reciente) es su
  // contacto vigente. Teléfonos vacíos (registros "solo el nombre") quedan
  // fuera para no cruzar clientes distintos.
  const historial = new Map<
    string,
    {
      contacto: {
        cliente: string;
        telefono: string;
        direccion: string;
        barrio: string | null;
        referencia: string | null;
      };
      pedidos: number;
    }
  >();
  for (const dom of ultimosDomicilios) {
    if (dom.telefono.trim() === "") continue;
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
  const clientes = [...historial.values()]
    .sort((a, b) => b.pedidos - a.pedidos)
    .map((h) => ({ ...h.contacto, pedidos: h.pedidos }));

  return {
    menu,
    extras: extras.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      precio: p.precio,
    })) satisfies ExtraSimple[],
    clientes,
  };
}

/** Analiza un mensaje contra el contexto de HOY, sin FormData de por medio */
export async function borradorDeMensaje(mensaje: string): Promise<BorradorParseado> {
  return parsearMensaje(mensaje, await contextoParaParsear());
}

const CLAVE_AUTO = "whatsapp_auto_registrar";

/** ¿El sistema crea el domicilio solo cuando el mensaje sale armable? */
export async function leerAutoRegistrar(): Promise<boolean> {
  const fila = await db.configuracion.findUnique({ where: { clave: CLAVE_AUTO } });
  return (fila?.valor ?? "1") === "1";
}

/** Invierte la bandera del auto-registro y devuelve el valor nuevo */
export async function alternarBanderaAuto(): Promise<boolean> {
  const actual = await leerAutoRegistrar();
  const nuevo = actual ? "0" : "1";
  await db.configuracion.upsert({
    where: { clave: CLAVE_AUTO },
    update: { valor: nuevo },
    create: { clave: CLAVE_AUTO, valor: nuevo },
  });
  return !actual;
}
