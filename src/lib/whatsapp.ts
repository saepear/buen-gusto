// Puente de WhatsApp: el sistema es local (sin hosting), así que un proceso
// aparte (whatsapp-bridge/, con Baileys) es el que tiene la sesión de WhatsApp
// Web y habla en los dos sentidos con este servidor por 127.0.0.1.
//   - Entrada:  el bridge POSTea a /api/whatsapp/entrante
//   - Salida:   este módulo POSTea al bridge (/enviar) para responder al cliente
// Si el bridge no está levantado, todo lo de aquí es "mejor esfuerzo": el
// sistema nunca se cae por WhatsApp.

const URL_PUENTE = (process.env.WHATSAPP_BRIDGE_URL ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
const SECRETO = process.env.WHATSAPP_BRIDGE_SECRET ?? "";

/** ¿Hay un puente configurado? (sin secreto, no se manda nada) */
export function puenteConfigurado(): boolean {
  return SECRETO.length > 0;
}

/**
 * Deja solo los dígitos del teléfono (quita jids de WhatsApp, guiones y
 * espacios). No inventa el indicativo del país: el bridge arma el jid.
 */
export function normalizarTelefono(bruto: string): string {
  return String(bruto ?? "")
    .replace(/@.*$/, "")
    .replace(/\D/g, "");
}

/** ¿El texto se ve como una nota/plantilla válida para mandar? */
const textoValido = (texto: string) => texto.trim().length > 0 && texto.length <= 4096;

/**
 * Le pide al bridge que envíe un WhatsApp. Devuelve true solo si el bridge
 * confirmó el envío; en cualquier otro caso (sin puente, caído, error) false,
 * sin lanzar: quien llama decide qué hacer con el "no se pudo".
 */
export async function enviarWhatsapp(telefono: string, texto: string): Promise<boolean> {
  const destino = normalizarTelefono(telefono);
  if (!puenteConfigurado() || destino.length < 7 || !textoValido(texto)) return false;

  try {
    const res = await fetch(`${URL_PUENTE}/enviar`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-puente-secreto": SECRETO,
      },
      body: JSON.stringify({ telefono: destino, texto: texto.trim() }),
      // El bridge es local: si no contesta rápido, es que está caído.
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** ¿El puente está vivo ahora mismo? (para mostrarlo en la UI de admin) */
export async function puenteVivo(): Promise<boolean> {
  if (!puenteConfigurado()) return false;
  try {
    const res = await fetch(`${URL_PUENTE}/estado`, {
      headers: { "x-puente-secreto": SECRETO },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
