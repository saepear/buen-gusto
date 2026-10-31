// Interpreta la hora de entrega que el cliente dijo por WhatsApp ("las 12",
// "la 1 y media", "12:30", "mediodía") y la vuelve minutos desde medianoche
// para poder ORDENAR el tablero. Es una heurística de almuerzo: 1–6 se leen
// de la tarde (13–18) y 7–11 de la mañana; "tarde"/"noche"/"pm" fuerzan PM.

/** Minutos desde medianoche; null si el texto no trae una hora entendible */
export function minutosDeHora(bruto: string | null | undefined): number | null {
  const t = String(bruto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!t) return null;

  if (/\bmediodia\b/.test(t)) return 12 * 60;

  const m = /(\d{1,2})(?::(\d{2}))?/.exec(t);
  if (!m) return null;

  let h = Number(m[1]);
  if (!Number.isFinite(h) || h > 23) return null;
  const min = m[2] ? Math.min(59, Number(m[2])) : /\by\s+media\b/.test(t) ? 30 : /\by\s+cuarto\b/.test(t) ? 15 : 0;

  const pm = /\btarde\b|\bnoche\b|\bpm\b|\bde la tarde\b/.test(t);
  if (pm && h >= 1 && h <= 11) h += 12;
  else if (h >= 1 && h <= 6) h += 12; // almuerzo: "la 1" es la 1 de la tarde

  return h * 60 + min;
}
