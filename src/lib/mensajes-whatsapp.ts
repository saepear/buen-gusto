// Plantillas de los WhatsApp automáticos que el sistema le manda al cliente.
// Son textos cortos y cálidos: el sistema confirma, avisa y agradece, sin que
// nadie tenga que escribir a mano. Se usan desde el puente de entrada y desde
// las acciones del repartidor.
import { formatCOP } from "@/lib/format";

/** Confirmación cuando el sistema armó el domicilio solo */
export function confirmacionDomicilio(d: {
  cantidad: number;
  conSopa: boolean;
  proteina: string;
  total: number;
  hora?: string | null;
  /** Mensaje de un lote parcial (se crearon algunos y algo se agotó) */
  parcial?: string | null;
}): string {
  const plato = d.conSopa ? "con sopa" : "sin sopa";
  const cuantos = d.cantidad === 1 ? "1 almuerzo" : `${d.cantidad} almuerzos`;
  const hora = d.hora ? ` · entrega ${d.hora}` : "";
  return [
    "¡Gracias por tu pedido! 🍽️",
    `Anotamos ${cuantos} ${plato} (${d.proteina})${hora}.`,
    `Total: ${formatCOP(d.total)} — se cobra contra entrega.`,
    d.parcial ? "⚠️ Un plato quedó pendiente: el equipo te confirma." : "Te avisamos cuando salga. 🙌",
  ].join("\n");
}

/** El mensaje no se pudo armar: el equipo lo revisa a mano */
export function avisoNoEntendido(): string {
  return "¡Hola! 👋 Recibimos tu mensaje, pero no pudimos armar el pedido automáticamente. Ya lo revisa el equipo y te confirmamos en un momentico.";
}

/** El repartidor salió con el pedido */
export function avisoEnCamino(): string {
  return "🛵 Tu pedido va en camino. ¡Buen provecho!";
}

/** El pedido se entregó */
export function avisoEntregado(): string {
  return "¡Gracias por tu pedido! 🙌 Cualquier cosa, aquí estamos.";
}
