// Estados compartidos de las acciones de la bandeja de WhatsApp.
// Van aparte porque los archivos "use server" solo pueden exportar
// funciones async: un objeto como valor inicial de useActionState
// no puede vivir ahí (Next lo rechaza al importarlo).

/** Resultado de las acciones simples de la bandeja (descartar, alternar…) */
export type EstadoBandeja = {
  error: string | null;
  ok: string | null;
  auto: boolean | null;
};

/** Valor inicial neutro para useActionState de las acciones simples */
export const BANDEJA_VACIA: EstadoBandeja = { error: null, ok: null, auto: null };
