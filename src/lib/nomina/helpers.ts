// ═════════ Herramientas compartidas de Nómina (server) ═════════
// Utilidades que comparten las acciones de todas las rutas de Nómina:
// fotos de contrato, rangos de período y etiquetas.
import { claveDia, formatCOP } from "@/lib/format";
import { db } from "@/lib/db";
import type { ContratoVersion, LiquidacionNomina } from "@prisma/client";
import type { ContratoFoto } from "./calculo";
import {
  CLAVE_PARAM,
  cargarParametros,
  mapaParametros,
  type ParametroVigente,
} from "./parametros";

export { claveDia as claveFecha };

/** yyyy-mm-dd de HOY */
export function hoy(): string {
  return claveDia(new Date());
}

/** Contrato FOTO para el liquidador, a partir de la ContratoVersion.
 *  La clase ARP vive en el empleado: se compondrá aparte; esto garantiza
 *  la foto sin atravesar pedidos. */
export function contratoDeVersion(v: ContratoVersion, arpClase: number): ContratoFoto {
  return {
    modalidad: v.modalidad,
    remuneracion: v.remuneracion,
    salarioMensual: v.salarioMensual,
    salarioDiario: v.salarioDiario,
    valorHora: v.valorHora,
    jornadaSemanalMinutos: v.jornadaSemanalMinutos,
    periodicidadPago: v.periodicidadPago,
    diaDescanso: v.diaDescanso,
    auxilioTransporte: v.auxilioTransporte,
    metodoPago: v.metodoPago,
    arpClase,
  };
}

/** La ContratoVersion VIGENTE en una fecha (yyyy-mm-dd): la más reciente
 *  con `desde` ≤ esa fecha (la foto del período queda estable así). */
export async function contratoVigente(
  empleadoId: number,
  fecha: string, // yyyy-mm-dd
): Promise<ContratoVersion | null> {
  const versiones = await db.contratoVersion.findMany({
    where: { empleadoId, desde: { lte: new Date(`${fecha}T12:00:00.000Z`) } },
    orderBy: { desde: "desc" },
    take: 1,
  });
  return versiones[0] ?? null;
}

/** Parámetros vigentes a la fecha FINAL del período (para la foto y el cálculo) */
export async function parametrosDelPeriodo(
  desde: string,
  hasta: string,
): Promise<{ filas: ParametroVigente[]; mapa: Record<string, number> }> {
  void desde; // la vigencia se fija a la fecha final del período
  const filas = await cargarParametros(new Date(`${hasta}T12:00:00.000Z`));
  return { filas, mapa: mapaParametros(filas) };
}

/** ¿La marca auto del auxilio de transporte? Salario ≤ 2 SMMLV del período */
export function aplicaAuxilioTransporte(
  salarioMensual: number,
  parametros: Record<string, number>,
): boolean {
  const smmlv = parametros[CLAVE_PARAM.SALARIO_MINIMO] ?? 0;
  return smmlv > 0 && salarioMensual > 0 && salarioMensual <= 2 * smmlv;
}

/** Límites de un período QUINCENAL, MENSUAL o CICLOS:
 *  • MENSUAL: del 1 al último día del mes.
 *  • QUINCENA 1: del 1 al 15   ·  QUINCENA 2: del 16 al último día.
 *  • CICLOS (cortes del 7 / 14 / 21 y fin de mes):
 *      corte 1: 1–7 · corte 2: 8–14 · corte 3: 15–21 · corte 4: 22–fin.
 *  Responde nulo con datos fuera de rango. */
export function rangoDePeriodo(
  tipo: "QUINCENAL" | "MENSUAL" | "CICLOS",
  anio: number,
  mes: number, // 1–12
  parte: 1 | 2 | 3 | 4 = 1, // quincena 1|2, o corte del ciclo 1–4
): { desde: string; hasta: string } | null {
  if (mes < 1 || mes > 12 || anio < 2000 || anio > 2200) return null;
  const ultimo = new Date(anio, mes, 0).getDate();
  const mm = String(mes).padStart(2, "0");
  const dd = (n: number) => String(n).padStart(2, "0");
  if (tipo === "MENSUAL") {
    return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${dd(ultimo)}` };
  }
  if (tipo === "CICLOS") {
    const inicios = [1, 8, 15, 22] as const;
    const finales = [7, 14, 21, ultimo] as const;
    if (parte < 1 || parte > 4) return null;
    return {
      desde: `${anio}-${mm}-${dd(inicios[parte - 1])}`,
      hasta: `${anio}-${mm}-${dd(finales[parte - 1])}`,
    };
  }
  return parte === 1
    ? { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-15` }
    : { desde: `${anio}-${mm}-16`, hasta: `${anio}-${mm}-${dd(ultimo)}` };
}

/** Los 4 cortes CICLOS de un mes: 1–7, 8–14, 15–21 y 22–fin. */
export function ciclosDeMes(
  anio: number,
  mes: number,
): { desde: string; hasta: string }[] {
  const res: { desde: string; hasta: string }[] = [];
  for (const corte of [1, 2, 3, 4] as const) {
    const r = rangoDePeriodo("CICLOS", anio, mes, corte);
    if (r) res.push(r);
  }
  return res;
}

/** Etiquetas de TIPO de ciclo (páginas y fichas) */
export const TIPO_PERIODO_LABEL: Record<string, string> = {
  QUINCENAL: "Quincena",
  MENSUAL: "Mes",
  CICLOS: "Ciclo (7/14/21/fin)",
};

/** Formato de dinero común de las páginas de nómina */
export const fmtCOP = formatCOP;

/** Etiquetas de estados */
export const ESTADO_LIQUIDACION_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  APROBADA: "Aprobada",
};

export const ESTADO_PAGO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PARCIALMENTE: "Pago parcial",
  PAGADO: "Pagado",
};

/** El saldo pendiente de una liquidación (neto − pagado) */
export function pendienteDeLiquidacion(
  l: Pick<LiquidacionNomina, "netoAPagar" | "pagado">,
): number {
  return Math.max(l.netoAPagar - l.pagado, 0);
}
