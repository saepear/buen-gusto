// Formato de dinero y fechas para Colombia (COP enteros)

export function formatCOP(valor: number): string {
  return `$${valor.toLocaleString("es-CO")}`;
}

export function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatHora(fecha: Date): string {
  return fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

/** yyyy-mm-dd para agrupar menús por día */
export function claveDia(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
