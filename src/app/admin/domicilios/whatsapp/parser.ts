// Parser Fase 1 "Pegar y armar": convierte el texto crudo de un mensaje de
// WhatsApp en el borrador de un domicilio, casando las palabras con el menú
// del día y el catálogo. Es puro y sin dependencias de valor: se prueba
// aislado y lo usan solo las server actions de la bandeja. Cuando entre la
// IA (Fase 2), esta misma estructura de borrador es la que devolverá el modelo.

import type { ItemMenuHoy } from "@/lib/pedido";

/** Producto del catálogo (bebida o adicional) tal como llega del action */
export type ExtraSimple = {
  id: number;
  nombre: string;
  tipo: string;
  precio: number;
};

/** Cliente con historial de domicilios, para autocompletar contacto */
export type ClienteHistorial = {
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  pedidos: number;
};

/** Línea del menú de hoy reconocida en el mensaje */
export type LineaMenu = { itemId: number; productoId: number; nombre: string };

/** Extra reconocido con su cantidad */
export type LineaExtra = {
  productoId: number;
  nombre: string;
  precio: number;
  cantidad: number;
};

/** Lo que la bandeja muestra y luego convierte en el domicilio */
export type BorradorParseado = {
  /** Cuántos almuerzos idénticos se crearán (1 = el corriente) */
  cantidad: number;
  /** Con sopa (completo) o bandeja. Si el mensaje no menciona la sopa en
   *  ninguna forma, es bandeja: solo con sopa si el cliente lo dijo. */
  conSopa: boolean;
  /** ¿Se identificó al menos la proteína? (lo mínimo para armar) */
  armable: boolean;
  proteina: LineaMenu | null;
  principios: LineaMenu[];
  ensaladas: LineaMenu[];
  /** Sopa por nombre; null = la cocina decide (queda sin elegir) */
  sopa: LineaMenu | null;
  /** Hora de entrega detectada ("las 12", "la 1 y media"); null si no la dijo */
  hora: string | null;
  extras: LineaExtra[];
  /** Contacto resuelto del historial o detectado; vacío si hay que escribirlo */
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string;
  referencia: string;
  /** true si el teléfono salió del propio mensaje */
  telefonoDelMensaje: boolean;
  /** Aclaraciones de la interpretación ("asumí con sopa", etc.) */
  notas: string[];
};

const SIN_ACENTOS = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Ruido que no es plato ni cliente (el parser lo suelta) */
const STOP_TOKENS = new Set([
  "un", "una", "dos", "tres", "cuatro", "cinco", "seis",
  "de", "del", "la", "las", "el", "los", "le", "lo", "y", "e", "o", "al",
  "con", "sin", "para", "por", "favor", "gracias", "hola", "buenas",
  "buenos", "buen", "dia", "dias", "tardes", "noches",
  "quiero", "necesito", "manda", "mande", "envia", "enviar",
  "domicilio", "domicilios", "pedido", "pedidos", "encargo",
  "almuerzo", "almuerzos", "completa", "completo", "completas", "completos",
  "bandeja", "bandejas", "plato", "platos",
  "sopa", "sopas", "principio", "principios", "proteina", "proteinas",
  "extra", "extras", "adicional", "adicionales",
  "soy", "mas", "solo", "muy", "hasta", "luego", "tengo", "hago",
  // Palabras de conversación real: poseativos y promesas de entrega
  "porfa", "regalas", "regalo", "quieres", "desean", "deseo",
  "sus", "casa", "casas", "hora",
]);

const PALABRA_A_NUMERO: Record<string, number> = {
  un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
};

/** Palabras significativas de un nombre (sin acentos ni stopwords) */
function tokensDe(nombre: string): string[] {
  return SIN_ACENTOS(nombre)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_TOKENS.has(w));
}

/**
 * ¿El token del mensaje apunta al token del nombre?
 * Igualdad directa, o plural/cerilla cercana: "gaseosas" → gaseosa,
 * "danielito" → Daniel. Con tope de 3 letras de sobra para que
 * "reservado" no salga como "Res".
 */
const apunta = (msg: string, tok: string): boolean =>
  msg === tok || (msg.startsWith(tok) && msg.length - tok.length <= 3);

const mejorDe = <T extends { nombre: string }>(
  lineas: T[],
  msgTokens: Set<string>,
): { linea: T; puntaje: number } | null => {
  let mejor: { linea: T; puntaje: number } | null = null;
  for (const linea of lineas) {
    let puntaje = 0;
    for (const tok of tokensDe(linea.nombre)) {
      for (const msg of msgTokens) {
        if (apunta(msg, tok)) puntaje += tok.length;
      }
    }
    if (puntaje === 0) continue;
    if (
      !mejor ||
      puntaje > mejor.puntaje ||
      (puntaje === mejor.puntaje && linea.nombre.length > mejor.linea.nombre.length)
    ) {
      mejor = { linea, puntaje };
    }
  }
  return mejor;
};

/** Todos los ítems de una lista que el mensaje menciona (frijol y papa) */
const variosDe = <T extends { nombre: string }>(
  lineas: T[],
  msgTokens: Set<string>,
): T[] => {
  const salida: T[] = [];
  for (const linea of lineas) {
    const toks = tokensDe(linea.nombre);
    if (toks.some((tok) => [...msgTokens].some((m) => apunta(m, tok)))) {
      salida.push(linea);
    }
  }
  return salida;
};

/** Cantidad que pidió de un extra y dónde empezó esa cifra */
function cantidadDelExtra(
  extra: ExtraSimple,
  limpio: string,
): { cantidad: number; indiceNumero: number } {
  const toks = tokensDe(extra.nombre);
  const clave = toks.length ? toks.reduce((a, b) => (b.length > a.length ? b : a)) : "";
  if (!clave) return { cantidad: 1, indiceNumero: -1 };

  const numero = new RegExp(`(\\d{1,2})\\s*[x×]?\\s*${clave}`).exec(limpio);
  if (numero) {
    return { cantidad: Math.min(5, Math.max(1, Number(numero[1]))), indiceNumero: numero.index };
  }

  const palabra = new RegExp(`\\b(un|una|dos|tres|cuatro|cinco)\\s+(?:mas\\s+)?${clave}`).exec(limpio);
  if (palabra) return { cantidad: PALABRA_A_NUMERO[palabra[1]] ?? 1, indiceNumero: palabra.index };

  const alFinal = new RegExp(`${clave}\\s*[x×]\\s*(\\d{1,2})`).exec(limpio);
  if (alFinal) return { cantidad: Math.min(5, Math.max(1, Number(alFinal[1]))), indiceNumero: -1 };

  return { cantidad: 1, indiceNumero: -1 };
}

/** Cliente del historial cuyo nombre aparece en el mensaje */
export function clienteDelMensaje(
  clientes: ClienteHistorial[],
  msgTokens: Set<string>,
): ClienteHistorial | null {
  let mejor: { cliente: ClienteHistorial; puntos: number } | null = null;
  for (const cliente of clientes) {
    let puntos = 0;
    for (const tok of tokensDe(cliente.cliente)) {
      for (const msg of msgTokens) {
        const inverso = tok.startsWith(msg) && tok.length - msg.length <= 3;
        if (apunta(msg, tok) || inverso) puntos += tok.length;
      }
    }
    if (puntos === 0) continue;
    if (
      !mejor ||
      puntos > mejor.puntos ||
      (puntos === mejor.puntos && cliente.pedidos > mejor.cliente.pedidos)
    ) {
      mejor = { cliente, puntos };
    }
  }
  return mejor ? mejor.cliente : null;
}

/**
 * Interpreta el mensaje con el contexto de HOY (menú vigente, catálogo e
 * historial de clientes). Nunca lanza: lo que no cuadra queda en `notas`
 * y el administrador decide. IA propone, humano confirma.
 */
export function parsearMensaje(
  mensaje: string,
  contexto: { menu: ItemMenuHoy[]; extras: ExtraSimple[]; clientes: ClienteHistorial[] },
): BorradorParseado {
  const limpio = SIN_ACENTOS(mensaje)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const msgTokens = new Set(limpio.split(" ").filter(Boolean));

  const notas: string[] = [];

  // El plato contra el menú de HOY (se usa desde aquí arriba para la sopa)
  const delTipo = (tipo: string) => contexto.menu.filter((m) => m.tipo === tipo);

  // Sopa del día nombrada por su nombre (crema, consomé…): también cuenta
  // como "con sopa", aunque no dijera la palabra.
  const sopaMejor = mejorDe(delTipo("SOPA"), msgTokens);

  // ¿Completo (con sopa) o bandeja? Regla del negocio: si el mensaje no
  // menciona la sopa en ninguna forma, es SIN sopa (bandeja). Solo se arma
  // con sopa si el cliente lo dijo ("con sopa", "completo") o nombró la
  // sopa del día. "Sin sopa" y "bandeja" lo confirman a la inversa.
  const conSopa = /\bsin sopa\b|\bsin sopita\b|\bbandejas?\b/.test(limpio)
    ? false
    : /\bcon sopa\b|\bsopas?\b|\bsopita\b|\bcomplet[ao]s?\b/.test(limpio) ||
      sopaMejor !== null;

  // Hora de entrega a domicilio: "a las 12 la desean sus casas", "para la
  // 1 y media", "a las 12:30", "mediodía". Va a la comanda como nota
  // "Entrega: …"; no es campo del modelo.
  const msjBajo = mensaje.toLowerCase();
  const AVISO_HORA =
    /(desean?|deseo|quieres?|quiero|quieren|sus cas|mi casa|su casa|llegar|entrega[nsr]?|\b(?:am|pm)\b|mediod[íi]a|:\d{2}|\by\s+(?:media|cuarto)\b)/i;
  let hora: string | null = null;
  let indiceHora = -1;

  // "a las 12", "para la 1 y media": uso el texto crudo del mensaje (con
  // acentos y dos puntos intactos), no la versión limpia
  const horaClasica =
    /(?:\b(?:a|para)\s+)?\b(l[ao]s)\s+(\d{1,2})(?::(\d{2})|\s+y\s+(media|cuarto)|\s+(\d{1,2}))?\b/.exec(
      msjBajo,
    );
  if (horaClasica && Number(horaClasica[2]) <= 23) {
    const alrededor = msjBajo.slice(horaClasica.index, horaClasica.index + 34);
    if (AVISO_HORA.test(alrededor)) {
      let fraseMin = "";
      if (horaClasica[3]) fraseMin = `:${horaClasica[3]}`;
      else if (horaClasica[4] === "media") fraseMin = " y media";
      else if (horaClasica[4] === "cuarto") fraseMin = " y cuarto";
      else if (horaClasica[5] && Number(horaClasica[5]) <= 59) fraseMin = ` y ${horaClasica[5]}`;
      hora = `${horaClasica[1]} ${horaClasica[2]}${fraseMin}`;
      indiceHora = horaClasica.index;
    }
  }
  if (!hora) {
    // Cifra pegada a la frase de entrega: "12 la desean en sus casas"
    const horaCorta =
      /\b(\d{1,2})(?::(\d{2})|\s+y\s+(media|cuarto))?\s*(?:l[ao]s?\s*)?(?:desean?|deseo|quieres?|quiero|quieren|sus cas|mi casa|su casa)\b/.exec(
        msjBajo,
      );
    if (
      horaCorta &&
      Number(horaCorta[1]) <= 23 &&
      !/\b\d{1,2}\s*(?:almuerzos?|complet[oa]s?|bandejas?|platos?|domicilios?|pedidos?)\b/.test(
        msjBajo.slice(horaCorta.index, horaCorta.index + 16),
      )
    ) {
      let fraseMin = "";
      if (horaCorta[2]) fraseMin = `:${horaCorta[2]}`;
      else if (horaCorta[3]) fraseMin = ` y ${horaCorta[3]}`;
      hora = `${horaCorta[1]}${fraseMin}`;
      indiceHora = horaCorta.index;
    }
  }
  if (!hora) {
    const alMediodia = /\bmedio\s?d[íi]?a\b/.exec(msjBajo);
    if (alMediodia) {
      hora = "mediodía";
      indiceHora = alMediodia.index;
    }
  }
  // Dice que lo quiere en su casa pero sin hora: aviso suave
  if (/\bsus cas[ao]s?\b|\ben (?:mi|su|l[ao])? ?casa\b/.test(msjBajo) && !hora) {
    notas.push("Dice que lo desea en su casa, sin hora: revisa a qué hora entregar.");
  }

  // Extras del catálogo (bebidas y adicionales) con su cantidad. Van primero
  // porque sus cifras ("2 gaseosas") no deben contarse como almuerzos.
  const extrasConIndice = contexto.extras
    .filter((extra) =>
      tokensDe(extra.nombre).some((tok) => [...msgTokens].some((m) => apunta(m, tok))),
    )
    .map((extra) => {
      const { cantidad: n, indiceNumero } = cantidadDelExtra(extra, limpio);
      return {
        extra: {
          productoId: extra.id,
          nombre: extra.nombre,
          precio: extra.precio,
          cantidad: n,
        },
        indiceNumero,
      };
    });
  const extras = extrasConIndice.map((e) => e.extra);

  // ¿Cuántos almuerzos idénticos?
  //  a) cifra + palabra del almuerzo ("2 almuerzos", "6 bandejas")
  //  b) "de a 3" / "de a dos" / "para dos"
  //  c) cifra suelta al inicio ("3 crema de ahuyamá con cerdo…") salvo que
  //     esa cifra ya sea de un extra
  const numeros = [
    ...limpio.matchAll(
      /(?:^|\s)(\d{1,2})\s*(?:almuerzos?|completas?|completos?|bandejas?|platos?|domicilios?|pedidos?)/g,
    ),
  ].map((m) => Number(m[1]));
  for (const m of limpio.matchAll(/\b(?:de a|para)\s+(un|una|dos|tres|cuatro|cinco)\b/g)) {
    numeros.push(PALABRA_A_NUMERO[m[1]] ?? 1);
  }
  for (const m of limpio.matchAll(/\bde a\s+(\d{1,2})\b/g)) {
    numeros.push(Number(m[1]));
  }
  let cantidad = numeros.length ? Math.max(...numeros) : 1;
  if (numeros.length === 0) {
    const lider = /^(\d{1,2})\b/.exec(limpio);
    if (
      lider &&
      Number(lider[1]) > 0 &&
      !extrasConIndice.some((e) => e.indiceNumero === 0) &&
      // Si la cifra inicial era la hora ("12 la desean en sus casas"),
      // no es cantidad de almuerzos.
      !(hora !== null && indiceHora <= 4)
    ) {
      cantidad = Number(lider[1]);
    }
  }
  if (cantidad > 6) {
    cantidad = 6;
    notas.push("Pidió varios: se arman máximo 6 por mensaje; repite lo que falte.");
  }

  // La proteína contra el menú de HOY: soporta "asada de res" → Res
  // (el match es por palabra, no por posición en el mensaje)
  const proteinaMejor = mejorDe(delTipo("PROTEINA"), msgTokens);
  const proteina = proteinaMejor
    ? {
        itemId: proteinaMejor.linea.itemId,
        productoId: proteinaMejor.linea.productoId,
        nombre: proteinaMejor.linea.nombre,
      }
    : null;
  if (!proteina) {
    notas.push("No identifiqué la proteína: revisa qué le pidió antes de crear el domicilio.");
  }

  const principios = variosDe(delTipo("PRINCIPIO"), msgTokens).map((linea) => ({
    itemId: linea.itemId,
    productoId: linea.productoId,
    nombre: linea.nombre,
  }));
  const ensaladas = variosDe(delTipo("ENSALADA"), msgTokens).map((linea) => ({
    itemId: linea.itemId,
    productoId: linea.productoId,
    nombre: linea.nombre,
  }));
  // Sopa del día: la que el cliente nombró; sin nombre, la cocina decide
  const sopa = sopaMejor
    ? {
        itemId: sopaMejor.linea.itemId,
        productoId: sopaMejor.linea.productoId,
        nombre: sopaMejor.linea.nombre,
      }
    : null;

  // Cliente y teléfono: primero explícito en el mensaje, luego el historial
  const clienteInfo = clienteDelMensaje(contexto.clientes, msgTokens);
  const telDelMsj = /\b(\d{7,10})\b/.exec(limpio);
  const telefono = telDelMsj ? telDelMsj[1] : (clienteInfo?.telefono ?? "");

  if (/\b(recog|paso por|paso a buscar|voy a buscar)\b/.test(limpio)) {
    notas.push("Parece que pasa a recogerlo; revisa si de verdad es a domicilio.");
  }

  return {
    cantidad,
    conSopa,
    armable: proteina !== null,
    proteina,
    principios,
    ensaladas,
    sopa,
    hora,
    extras,
    cliente: clienteInfo ? clienteInfo.cliente : "",
    telefono,
    direccion: clienteInfo?.direccion ?? "",
    barrio: clienteInfo?.barrio ?? "",
    referencia: clienteInfo?.referencia ?? "",
    telefonoDelMensaje: telDelMsj !== null,
    notas,
  };
}
