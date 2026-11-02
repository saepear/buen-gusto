// Hashing de PINs con scrypt (node:crypto, sin dependencias externas).
//
// Los PIN ya no se guardan en texto plano: se almacenan como
//   `scrypt:<sal-hex>:<hash-hex>`
// con sal aleatoria de 16 bytes por usuario. Esto costa ~60 ms de CPU y
// 16 MiB de RAM por verificación, mucho más caro que comparar texto.
//
// NOTA DE DISEÑO: el PIN del POS es de 4 dígitos (10^4 combinaciones, no
// se puede ampliar sin cambiar el teclado), así que el hash es una
// defensa razonable, no impenetrable — su función es que un PIN filtrado
// no sea legible a simple vista y que probarlos a mano cueste minutos por
// usuario. La defensa primaria del sistema es que prisma/dev.db no sale
// del equipo (por eso .gitignore ya lo excluye).
//
// MIGRACIÓN SIN BLOQUEOS: los PIN antiguos en texto plano siguen
// funcionando (verificarPin los admite) y se reescriben con hash la
// primera vez que cada usuario inicia sesión, o cuando el admin los
// cambia. Nadie se queda fuera si la app se despliega antes de migrar.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Parámetros de scrypt (vals por defecto de RFC 7914) */
const SCRYPT = { N: 16384, r: 8, p: 1 };
const MARCA = "scrypt";

/** ¿El valor guardado ya es `scrypt:sal:hash`? */
export function esPinHasheado(guardado: string): boolean {
  return guardado.startsWith(`${MARCA}:`);
}

/** Convierte un PIN de 4 dígitos a su forma almacenada (sal aleatoria) */
export function hashearPin(pin: string): string {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("hashearPin espera un PIN de 4 dígitos.");
  }
  const sal = randomBytes(16);
  const clave = scryptSync(pin, sal, 32, SCRYPT);
  return `${MARCA}:${sal.toString("hex")}:${clave.toString("hex")}`;
}

/** ¿El PIN ingresado corresponde al valor guardado?
 *  Acepta los dos formatos (hash nuevo y texto plano legado) para que
 *  la migración no bloquee el acceso de nadie. */
export function verificarPin(ingresado: string, guardado: string): boolean {
  if (esPinHasheado(guardado)) {
    const [, salHex = "", hashHex = ""] = guardado.split(":");
    const sal = Buffer.from(salHex, "hex");
    const esperado = Buffer.from(hashHex, "hex");
    if (sal.length === 0 || esperado.length === 0) return false;
    const calculado = scryptSync(ingresado, sal, esperado.length, SCRYPT);
    return timingSafeEqual(calculado, esperado);
  }

  // Compatibilidad: PIN legado guardado como texto de 4 dígitos.
  // (el app ya validó que `ingresado` sean 4 dígitos antes de llegar aquí)
  const a = Buffer.from(ingresado, "utf8");
  const b = Buffer.from(guardado, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
