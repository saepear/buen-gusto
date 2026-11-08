export const EVENTO_PROGRESO_DOMICILIO = "domicilio:progreso";

export function actualizarProgresoDomicilio(paso: number) {
  window.dispatchEvent(
    new CustomEvent<number>(EVENTO_PROGRESO_DOMICILIO, { detail: paso }),
  );
}
