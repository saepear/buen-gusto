// ═════════ Tipos compartidos del cálculo de Nómina ═════════
// El pago interno se calcula en `pago.ts` (base pactada + ajustes).
// Dinero en COP ENTEROS; los porcentajes van en DIEZMILÉSIMAS.

export type ContratoFoto = {
  modalidad: string; // LABORAL | INDEPENDIENTE
  remuneracion: string; // MENSUAL | DIARIO | HORARIO
  salarioMensual: number;
  salarioDiario: number;
  valorHora: number;
  jornadaSemanalMinutos: number;
  periodicidadPago: string;
  diaDescanso: number;
  auxilioTransporte: boolean;
  metodoPago: string;
  arpClase: number; // 1..6 (riesgo laboral)
};

export type NovedadResumen = {
  id: number;
  tipo: string;
  fecha: string;
  dias: number | null;
  valor: number | null;
  descripcion: string;
};

export type ConceptoLiquidacion = {
  tipo: "DEVENGADO" | "DEDUCCION" | "EMPRESA" | "PRESTACION";
  clave: string;
  etiqueta: string;
  valor: number;
  detalle: string | null;
};

/** Resultado del liquidador, listo para persistirse en transacción */
export type CalculoLiquidacion = {
  diasTrabajados: number;
  salarioBase: number;
  horasExtrasRecargos: number;
  comisionesBonos: number;
  auxilioTransporte: number;
  otrosDevengados: number;
  totalDevengado: number;
  deduccionSalud: number;
  deduccionPension: number;
  otrosDescuentos: number;
  totalDeducciones: number;
  netoAPagar: number;
  empresaSalud: number;
  empresaPension: number;
  empresaRiesgos: number;
  empresaCaja: number;
  costoEmpleador: number;
  prestacionPrima: number;
  prestacionCesantias: number;
  prestacionIntereses: number;
  prestacionVacaciones: number;
  conceptos: ConceptoLiquidacion[];
  notasCalculo: string[];
};

/** Días de calendario entre dos fechas yyyy-mm-dd (inclusivo en ambos extremos) */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T12:00:00.000Z`).getTime();
  const b = new Date(`${hasta}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1;
}
