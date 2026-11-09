// ═════════ Reportes de Nómina — ÚNICA fuente de cálculo ═════════
// La página y el Excel consumen ESTE módulo (nunca duplicar consultas).
// Igual que en Reportes del restaurante: `datos-reporte.ts` calcula,
// las vistas solo pintan.
import { db } from "@/lib/db";

export type ResumenNomina = {
  totalDevengado: number;
  totalDeducciones: number;
  totalPagado: number;
  totalPendiente: number;
  totalAportes: number;
  totalPrestaciones: number;
};

export type FilaEmpleado = {
  empleadoId: number;
  nombre: string;
  totalDevengado: number;
  horasExtras: number;
  deducciones: number;
  neto: number;
  pagado: number;
  pendiente: number;
  aportesEmpleador: number;
  prestaciones: number;
};

export type FilaPago = {
  id: number;
  fecha: string;
  empleado: string;
  metodo: string;
  referencia: string | null;
  monto: number;
  gastoId: number | null;
};

export type DatosReporteNomina = {
  resumen: ResumenNomina;
  porEmpleado: FilaEmpleado[];
  pagos: FilaPago[];
};

export async function datosReporteNomina(
  desde: string,
  hasta: string,
  empleadoId: number | null = null,
): Promise<DatosReporteNomina> {
  // El rango del reporte vive en el PERÍODO (no en la liquidación)
  const rango = {
    periodo: {
      fechaDesde: { lte: hasta },
      fechaHasta: { gte: desde },
    },
  };
  const dondeEmpleado = empleadoId ? { empleadoId } : {};

  const liquidaciones = await db.liquidacionNomina.findMany({
    where: { ...rango, ...dondeEmpleado },
    include: { empleado: true },
    orderBy: [{ periodoId: "asc" }, { empleadoId: "asc" }],
  });

  const porEmpleadoMap = new Map<number, FilaEmpleado>();
  for (const l of liquidaciones) {
    const fila =
      porEmpleadoMap.get(l.empleadoId) ??
      ({
        empleadoId: l.empleadoId,
        nombre: `${l.empleado.nombre} ${l.empleado.apellidos}`,
        totalDevengado: 0,
        horasExtras: 0,
        deducciones: 0,
        neto: 0,
        pagado: 0,
        pendiente: 0,
        aportesEmpleador: 0,
        prestaciones: 0,
      } satisfies FilaEmpleado);
    fila.totalDevengado += l.totalDevengado;
    fila.horasExtras += l.horasExtraRecargos;
    fila.deducciones += l.totalDeducciones;
    fila.neto += l.netoAPagar;
    fila.pagado += l.pagado;
    fila.pendiente += Math.max(l.netoAPagar - l.pagado, 0);
    fila.aportesEmpleador += l.costoEmpleador;
    fila.prestaciones +=
      l.prestacionPrima + l.prestacionCesantias + l.prestacionIntereses + l.prestacionVacaciones;
    porEmpleadoMap.set(l.empleadoId, fila);
  }
  const porEmpleado = [...porEmpleadoMap.values()];

  const resumen: ResumenNomina = {
    totalDevengado: porEmpleado.reduce((s, f) => s + f.totalDevengado, 0),
    totalDeducciones: porEmpleado.reduce((s, f) => s + f.deducciones, 0),
    totalPagado: porEmpleado.reduce((s, f) => s + f.pagado, 0),
    totalPendiente: porEmpleado.reduce((s, f) => s + f.pendiente, 0),
    totalAportes: porEmpleado.reduce((s, f) => s + f.aportesEmpleador, 0),
    totalPrestaciones: porEmpleado.reduce((s, f) => s + f.prestaciones, 0),
  };

  const pagos = await db.pagoNomina.findMany({
    where: {
      fecha: { gte: new Date(`${desde}T00:00:00.000-05:00`), lte: new Date(`${hasta}T23:59:59.999-05:00`) },
      ...(empleadoId ? { liquidacion: { empleadoId } } : {}),
    },
    include: { liquidacion: { include: { empleado: true } } },
    orderBy: { fecha: "desc" },
    take: 100,
  });
  const pagosFila: FilaPago[] = pagos.map((p) => ({
    id: p.id,
    fecha: new Date(p.fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota" }),
    empleado: `${p.liquidacion.empleado.nombre} ${p.liquidacion.empleado.apellidos}`,
    metodo: p.metodo,
    referencia: p.referencia,
    monto: p.monto,
    gastoId: p.gastoId,
  }));

  return { resumen, porEmpleado, pagos: pagosFila };
}
