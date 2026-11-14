// Formato de dinero y fechas para Colombia (COP enteros)

export function formatCOP(valor: number): string {
  return `$${valor.toLocaleString("es-CO")}`;
}

export function formatFecha(fecha: Date): string {
  return fecha.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  });
}

export function formatHora(fecha: Date): string {
  return fecha.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
}

/** yyyy-mm-dd para agrupar menús por día */
export function claveDia(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(fecha);
  const parte = (tipo: string) => partes.find(p => p.type === tipo)?.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
