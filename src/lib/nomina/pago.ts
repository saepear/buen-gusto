import type { CalculoLiquidacion, ContratoFoto, NovedadResumen } from "./calculo";
import { diasEntre } from "./calculo";
import { salarioDelCiclo } from "./salario-ciclo";

/** Registro interno: base pactada + importes aprobados - descuentos aprobados.
 *  No hay control de asistencia: los días salen del calendario del período. */
export function calcularPago(args: {
  contrato: ContratoFoto;
  novedades: NovedadResumen[];
  periodoDesde: string;
  periodoHasta: string;
  periodoTipo: string;
}): CalculoLiquidacion {
  const { contrato: c, novedades } = args;
  const diasPeriodo = diasEntre(args.periodoDesde, args.periodoHasta);
  // Sin registro de jornadas, lo pactado por día/hora se paga por el
  // calendario del período: días completos o la jornada semanal prorrateada.
  const horasPactadas = Math.round(
    (c.jornadaSemanalMinutos / 60) * (diasPeriodo / 7),
  );
  const base =
    c.remuneracion === "DIARIO"
      ? c.salarioDiario * diasPeriodo
      : c.remuneracion === "HORARIO"
        ? horasPactadas * c.valorHora
        : args.periodoTipo === "CICLOS"
          ? salarioDelCiclo(c.salarioMensual, args.periodoDesde)
          : args.periodoTipo === "QUINCENAL"
            ? Number(args.periodoDesde.slice(8)) === 1 ? Math.round(c.salarioMensual / 2) : c.salarioMensual - Math.round(c.salarioMensual / 2)
            : c.salarioMensual;
  const detalle =
    c.remuneracion === "DIARIO"
      ? `${diasPeriodo} días × ${c.salarioDiario} COP`
      : c.remuneracion === "HORARIO"
        ? `${horasPactadas} h pactadas × ${c.valorHora} COP`
        : c.remuneracion === "MENSUAL" && args.periodoTipo === "CICLOS"
          ? `${c.salarioMensual} ÷ 4 · ajuste de redondeo en el último corte`
          : "Según remuneración configurada";
  const conceptos: CalculoLiquidacion["conceptos"] = [{ tipo: "DEVENGADO", clave: "SALARIO", etiqueta: "Pago base", valor: base,
    detalle }];
  let extras = 0;
  let descuentos = 0;
  for (const n of novedades) {
    if (!["COMISION", "BONIFICACION", "DESCUENTO"].includes(n.tipo)) continue;
    const valor = n.valor ?? 0;
    if (!Number.isSafeInteger(valor) || valor < 0) throw new Error("Importe de ajuste inválido");
    const deduccion = n.tipo === "DESCUENTO";
    if (deduccion) descuentos += valor; else extras += valor;
    conceptos.push({ tipo: deduccion ? "DEDUCCION" : "DEVENGADO", clave: n.id > 0 ? `AJUSTE_${n.id}` : n.tipo,
      etiqueta: n.descripcion || (deduccion ? "Deducción" : "Extra / incentivo"), detalle: n.descripcion, valor });
  }
  return {
    diasTrabajados: diasPeriodo, salarioBase: base, horasExtrasRecargos: 0,
    comisionesBonos: extras, auxilioTransporte: 0, otrosDevengados: 0,
    totalDevengado: base + extras, deduccionSalud: 0, deduccionPension: 0,
    otrosDescuentos: descuentos, totalDeducciones: descuentos, netoAPagar: base + extras - descuentos,
    empresaSalud: 0, empresaPension: 0, empresaRiesgos: 0, empresaCaja: 0,
    costoEmpleador: base + extras, prestacionPrima: 0, prestacionCesantias: 0,
    prestacionIntereses: 0, prestacionVacaciones: 0, conceptos,
    notasCalculo: ["Registro interno de pago: base + extras − deducciones. Solo se incluyen ajustes monetarios aprobados."],
  };
}
