// ═════════ Motor de cálculo de Nómina ═════════
// Dos piezas:
//  • clasificarJornada(): reparte cada minuto trabajado en los bucketes con
//    los que se guarda la JornadaLaboral (se congelan al guardar).
//  • liquidarEmpleado(): convierte jornadas + novedades aprobadas de un
//    período en la situación guardable de LiquidacionNomina + conceptos.
//
// Reglas de oro:
//  • Dinero en COP ENTEROS con redondeo UNA sola vez por concepto.
//  • Porcentajes en diezmilésimas (100.00 % = 1_000_000): nunca flotantes.
//  • Las horas extra y recargos NACEN de jornadas, no de novedades.
//  • No se inventan fórmulas: lo dudoso queda documentado con
//    pendienteVerificar y no se usa hasta confirmarse.
import { CLAVE_PARAM, FACTORES_PRESTACIONES } from "./parametros-data";
import { salarioDelCiclo } from "./salario-ciclo";

// ─────────────────────────── Helpers de dinero ───────────────────────────

/**
 * Proporción entera: redondearCOP(valor, casos, total) con casos/total
 * enteros. Numeradores exactos en enteros + un único Math.round final:
 * sin acumulación de flotantes.
 */
export function redondearCOP(valor: number, casos: number, total: number): number {
  return Math.round((valor * casos) / total);
}

/** El % (diezmilésimas) aplicado a un valor COP, redondeado una vez. */
export function aplicarPorcentaje(valor: number, porDiezmiles: number): number {
  return Math.round((valor * porDiezmiles) / 1_000_000);
}

// ─────────────────── Clasificador de minutos de jornada ───────────────────

export type MinutosJornada = {
  minutosOrdinarios: number;
  minutosNocturnos: number;
  minutosFestivos: number;
  minutosExtraDiurnas: number;
  minutosExtraNocturnas: number;
  minutosExtraFestivasDiurnas: number;
  minutosExtraFestivasNocturnas: number;
  minutosTrabajados: number;
};

const BUCKETS_CERO: MinutosJornada = {
  minutosOrdinarios: 0,
  minutosNocturnos: 0,
  minutosFestivos: 0,
  minutosExtraDiurnas: 0,
  minutosExtraNocturnas: 0,
  minutosExtraFestivasDiurnas: 0,
  minutosExtraFestivasNocturnas: 0,
  minutosTrabajados: 0,
};

/** 06:00 — la noche laboral termina a esta hora (Art. 161 CST). */
const FIN_NOCTURNO_MIN = 360;

/**
 * Clasifica UNA jornada, minuto a minuto. El resultado se guarda congelado
 * en la fila (buckets); la liquidación SOLO lee estos números guardados.
 *
 *  • entrada/salida: minutos desde medianoche. salida ≤ entrada significa
 *    que cruza a medianoche (termina al día siguiente).
 *  • descansoMinutos: pausas NO remuneradas que se restan del span.
 *  • esDiaRecargo: festivo (tabla Festivo) o el día de descanso semanal
 *    del empleado → aplica recargo dominical/festivo a toda la jornada.
 *  • jornadaSemanalMinutos: capacidad diaria ordinaria = jornada/6 (CST
 *    divide la semana en 6 días de trabajo). Los minutos por encima de
 *    esa capacidad son EXTRA.
 *  • inicioNocturnoMin: hora desde la que es nocturno (parámetro con
 *    vigencia: 21:00 antes de la reforma, 19:00 desde ella).
 */
export function clasificarJornada(
  entrada: number,
  salida: number,
  descansoMinutos: number,
  esDiaRecargo: boolean,
  jornadaSemanalMinutos: number,
  inicioNocturnoMin: number,
): MinutosJornada {
  const span = salida > entrada ? salida - entrada : 24 * 60 - entrada + salida;
  const minutosTrabajados = Math.max(span - Math.max(descansoMinutos, 0), 0);

  const capacidadDiaria = Math.floor(jornadaSemanalMinutos / 6);
  const r: MinutosJornada = { ...BUCKETS_CERO, minutosTrabajados };

  for (let i = 1; i <= minutosTrabajados; i++) {
    const minuto = ((entrada + i - 1) % 1440 + 1440) % 1440;
    const esNocturno = minuto >= inicioNocturnoMin || minuto < FIN_NOCTURNO_MIN;
    const esExtra = i > capacidadDiaria;

    if (esDiaRecargo) {
      if (esExtra) {
        // Extra en festivo = recargo dominical + recargo extra (HEDF/HENF).
        if (esNocturno) r.minutosExtraFestivasNocturnas++;
        else r.minutosExtraFestivasDiurnas++;
      } else {
        r.minutosFestivos++;
      }
    } else if (esExtra) {
      if (esNocturno) r.minutosExtraNocturnas++;
      else r.minutosExtraDiurnas++;
    } else if (esNocturno) {
      r.minutosNocturnos++;
    } else {
      r.minutosOrdinarios++;
    }
  }

  return r;
}

/**
 * ¿El día de entrada es festivo (tabla) o el descanso semanal del empleado?
 * (trabajo en dominical/festivo y en el día de descanso llevan el mismo
 * recargo dominical — Art. 179 y 184 CST).
 */
export function esDiaRecargado(
  fecha: string, // yyyy-mm-dd del día de ENTRADA
  diaDescanso: number, // 0=domingo … 6=sábado
  festivos: Set<string>,
): boolean {
  if (festivos.has(fecha)) return true;
  const d = new Date(`${fecha}T12:00:00.000Z`).getUTCDay();
  return d === diaDescanso;
}

// ─────────────────────────── Liquidador ───────────────────────────

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

export type JornadaResumen = {
  fecha: string;
  minutosOrdinarios: number;
  minutosNocturnos: number;
  minutosFestivos: number;
  minutosExtraDiurnas: number;
  minutosExtraNocturnas: number;
  minutosExtraFestivasDiurnas: number;
  minutosExtraFestivasNocturnas: number;
  minutosTrabajados: number;
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

/** Tipos de novedad que quitan días de salario (sin pago). INCAPACIDAD se
 *  cuenta como sin pago con nota pendienteVerificar: el manejo exacto de
 *  los primeros 3 días (empleador) y del día 91+ queda por confirmar. */
const TIPOS_AUSENCIA_SIN_PAGO = ["AUSENCIA", "PERMISO_NO_REMUNERADO", "INCAPACIDAD"];

/** Suma los buckets guardados de todas las jornadas del período */
function sumaMinutos(jornadas: JornadaResumen[]): MinutosJornada {
  const r = { ...BUCKETS_CERO };
  for (const j of jornadas) {
    r.minutosOrdinarios += j.minutosOrdinarios;
    r.minutosNocturnos += j.minutosNocturnos;
    r.minutosFestivos += j.minutosFestivos;
    r.minutosExtraDiurnas += j.minutosExtraDiurnas;
    r.minutosExtraNocturnas += j.minutosExtraNocturnas;
    r.minutosExtraFestivasDiurnas += j.minutosExtraFestivasDiurnas;
    r.minutosExtraFestivasNocturnas += j.minutosExtraFestivasNocturnas;
    r.minutosTrabajados += j.minutosTrabajados;
  }
  return r;
}

/** Días de calendario entre dos fechas yyyy-mm-dd (inclusivo en ambos extremos) */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(`${desde}T12:00:00.000Z`).getTime();
  const b = new Date(`${hasta}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

/** 90 → «1 h 30 min»; 35 → «35 min» (detalle de conceptos) */
export function formatMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Liquidación de UN empleado en UN período. PURA: persistir es asunto de
 * las acciones (transacción + fotos + conceptos + marcas de novedades).
 * `novedades` llega SOLO con las APROBADAS (a las que se les estampa
 * liquidacionId para que jamás se cuenten dos veces).
 */
export function liquidarEmpleado(args: {
  contrato: ContratoFoto; // FOTO del contrato vigente
  parametros: Record<string, number>; // mapa clave→valor del período
  jornadas: JornadaResumen[];
  novedades: NovedadResumen[];
  periodoDesde: string;
  periodoHasta: string;
  periodoTipo: string;
}): CalculoLiquidacion {
  const { contrato, parametros, jornadas, novedades, periodoDesde, periodoHasta } = args;
  const conceptos: ConceptoLiquidacion[] = [];
  const notas: string[] = [];

  const diasPeriodo = diasEntre(periodoDesde, periodoHasta);
  const esCiclo = args.periodoTipo === "CICLOS";
  const basePeriodo = esCiclo
    ? salarioDelCiclo(contrato.salarioMensual, periodoDesde)
    : contrato.salarioMensual;
  const detalleBase = esCiclo
    ? `Salario mensual ${contrato.salarioMensual} ÷ 4: ${basePeriodo} COP (ajuste de redondeo en el último corte)`
    : "Salario mensual del período";
  const valorAuxilio = parametros[CLAVE_PARAM.AUXILIO_TRANSPORTE] ?? 0;
  const smmlv = parametros[CLAVE_PARAM.SALARIO_MINIMO] ?? 0;

  // ── Días sin pago por novedades del período ──
  let diasSinPago = 0;
  const idsSinPago = new Set<number>();
  for (const n of novedades) {
    if (!TIPOS_AUSENCIA_SIN_PAGO.includes(n.tipo)) continue;
    diasSinPago += n.dias ?? 1;
    idsSinPago.add(n.id);
  }
  const diasDevengados = Math.max(diasPeriodo - diasSinPago, 0);

  // ── Devengados ──
  let salarioBase = 0;
  let horasExtrasRecargos = 0;
  let comisionesBonos = 0;
  let otrosDevengadosDias = 0;

  const m = sumaMinutos(jornadas);

  if (contrato.modalidad === "INDEPENDIENTE") {
    // Prestación de servicios: el honorario se paga completo. SIN
    // deducciones, SIN aportes del empleador, SIN prestaciones sociales
    // (es la razón de ser de esta modalidad; los impuestos van por UVT
    // fuera de la nómina del trabajador natural).
    salarioBase = redondearCOP(basePeriodo, diasDevengados, diasPeriodo);
    conceptos.push({
      tipo: "DEVENGADO",
      clave: "SALARIO",
      etiqueta: "Honorarios",
      valor: salarioBase,
      detalle: `${detalleBase} · ${diasDevengados} de ${diasPeriodo} días del período`,
    });
  } else if (contrato.remuneracion === "DIARIO") {
    // Salario DIARIO: se paga por cada jornada registrada. Sin horas
    // extra separadas (documentado): lo pactado por día cubre la
    // jornada del día completo.
    const diasConJornada = jornadas.length;
    salarioBase = contrato.salarioDiario * diasConJornada;
    conceptos.push({
      tipo: "DEVENGADO",
      clave: "SALARIO",
      etiqueta: "Salario por días trabajados",
      valor: salarioBase,
      detalle: `${diasConJornada} jornadas × ${contrato.salarioDiario}`,
    });
    otrosDevengadosDias = diasConJornada;
  } else if (contrato.remuneracion === "HORARIO") {
    // Remuneración por hora: se paga cada minuto trabajado a valorHora/60.
    // Sin recargos separados (uso pactado simplificado; si el dueño pacta
    // recargos para alguna persona, se registran como BONIFICACION).
    salarioBase = Math.round((m.minutosTrabajados * contrato.valorHora) / 60);
    conceptos.push({
      tipo: "DEVENGADO",
      clave: "SALARIO",
      etiqueta: "Pago por horas trabajadas",
      valor: salarioBase,
      detalle: `${formatMinutos(m.minutosTrabajados)} × ${contrato.valorHora}/h`,
    });
  } else {
    // La base mensual se reparte antes de aplicar novedades del corte.
    salarioBase = redondearCOP(basePeriodo, diasDevengados, diasPeriodo);
    conceptos.push({
      tipo: "DEVENGADO",
      clave: "SALARIO",
      etiqueta: "Salario del período",
      valor: salarioBase,
      detalle:
        diasSinPago > 0
          ? `${detalleBase} · ${diasSinPago} días sin pago (${diasDevengados}/${diasPeriodo} devengados)`
          : detalleBase,
    });

    // Valor del minuto ordinario (factor mensual = jornada semanal × 5:
    // hora diaria media por 30 días; 44 h → 220 h, 42 h → 210 h).
    // Intermedio en COP×1000 (mili) para no perder centavos; redondeo una
    // vez al convertir a COP.
    const factorMensualMin = contrato.jornadaSemanalMinutos * 5;
    const valorMinutoMili = (contrato.salarioMensual * 1000) / factorMensualMin;

    const recargos: [string, string, number, number][] = [
      [
        "RECARGO_FESTIVO",
        "Recargo dominical/festivo",
        m.minutosFestivos,
        parametros[CLAVE_PARAM.RECARGO_DOMINICAL] ?? 0,
      ],
      [
        "RECARGO_NOCTURNO",
        "Recargo nocturno",
        m.minutosNocturnos,
        parametros[CLAVE_PARAM.RECARGO_NOCTURNO] ?? 0,
      ],
      [
        "HORA_EXTRA_D",
        "Hora extra diurna",
        m.minutosExtraDiurnas,
        parametros[CLAVE_PARAM.RECARGO_EXTRA_DIURNA] ?? 0,
      ],
      [
        "HORA_EXTRA_N",
        "Hora extra nocturna",
        m.minutosExtraNocturnas,
        parametros[CLAVE_PARAM.RECARGO_EXTRA_NOCTURNA] ?? 0,
      ],
      [
        // Extra en festivo diurna = recargo dominical + extra diurna.
        "HORA_EXTRA_FESTIVA_D",
        "Hora extra en festivo (diurna)",
        m.minutosExtraFestivasDiurnas,
        (parametros[CLAVE_PARAM.RECARGO_DOMINICAL] ?? 0) +
          (parametros[CLAVE_PARAM.RECARGO_EXTRA_DIURNA] ?? 0),
      ],
      [
        // Extra en festivo nocturna = recargo dominical + extra nocturna.
        "HORA_EXTRA_FESTIVA_N",
        "Hora extra en festivo (nocturna)",
        m.minutosExtraFestivasNocturnas,
        (parametros[CLAVE_PARAM.RECARGO_DOMINICAL] ?? 0) +
          (parametros[CLAVE_PARAM.RECARGO_EXTRA_NOCTURNA] ?? 0),
      ],
    ];
    for (const [clave, etiqueta, minutos, tasa] of recargos) {
      if (minutos === 0 || tasa === 0) continue;
      const valor = Math.round((valorMinutoMili * minutos * tasa) / (1000 * 1_000_000));
      conceptos.push({
        tipo: "DEVENGADO",
        clave,
        etiqueta,
        valor,
        detalle: formatMinutos(minutos),
      });
      horasExtrasRecargos += valor;
    }
  }

  // ── Novedades de dinero (comisiones, bonos, descuentos autorizados) ──
  for (const n of novedades) {
    if (n.tipo === "COMISION" || n.tipo === "BONIFICACION") {
      const valor = n.valor ?? 0;
      if (valor <= 0) continue;
      comisionesBonos += valor;
      conceptos.push({
        tipo: "DEVENGADO",
        clave: n.tipo,
        etiqueta: n.tipo === "COMISION" ? "Comisión" : "Bonificación",
        valor,
        detalle: n.descripcion,
      });
    } else if (n.tipo === "DESCUENTO") {
      const valor = n.valor ?? 0;
      if (valor <= 0) continue;
      conceptos.push({
        tipo: "DEDUCCION",
        clave: "DESCUENTO",
        etiqueta: "Descuento autorizado",
        valor,
        detalle: n.descripcion,
      });
    }
  }

  // ── Auxilio de transporte: solo LABORAL, proporcional por días ──
  // REGLA: devenga quien devengue hasta 2 SMMLV. La marca del contrato
  // recae en el contrato foto (la acción recalcula esa marca al fijar el
  // salario), y aquí se revisa contra el SMMLV del período.
  let auxilioTransporte = 0;
  const aplicaAuxilio =
    contrato.modalidad === "LABORAL" &&
    contrato.auxilioTransporte &&
    smmlv > 0 &&
    valorAuxilio > 0 &&
    contrato.salarioMensual <= 2 * smmlv;
  if (aplicaAuxilio) {
    auxilioTransporte = redondearCOP(valorAuxilio, diasDevengados, FACTORES_PRESTACIONES.DIAS_MES);
    conceptos.push({
      tipo: "DEVENGADO",
      clave: "AUXILIO_TRANSPORTE",
      etiqueta: "Auxilio de transporte",
      valor: auxilioTransporte,
      detalle: `${diasDevengados} de ${FACTORES_PRESTACIONES.DIAS_MES} días del mes`,
    });
  }

  const totalDevengado =
    salarioBase + horasExtrasRecargos + comisionesBonos + auxilioTransporte;

  // ── Deducciones del TRABAJADOR y aportes del EMPLEADOR (solo LABORAL) ──
  // Base salarial: devengado SIN auxilio de transporte.
  const baseSalarial = totalDevengado - auxilioTransporte;
  const otrosDescuentosNovedades = conceptos
    .filter((c) => c.clave === "DESCUENTO")
    .reduce((a, c) => a + c.valor, 0);
  let deduccionSalud = 0;
  let deduccionPension = 0;
  let totalDeducciones = 0;
  let empresaSalud = 0;
  let empresaPension = 0;
  let empresaRiesgos = 0;
  let empresaCaja = 0;
  let prestacionPrima = 0;
  let prestacionCesantias = 0;
  let prestacionIntereses = 0;
  let prestacionVacaciones = 0;

  if (contrato.modalidad === "LABORAL") {
    deduccionSalud = aplicarPorcentaje(baseSalarial, parametros[CLAVE_PARAM.APOS_SALUD_TRABAJADOR] ?? 0);
    deduccionPension = aplicarPorcentaje(baseSalarial, parametros[CLAVE_PARAM.APOS_PENSION_TRABAJADOR] ?? 0);
    totalDeducciones = deduccionSalud + deduccionPension + otrosDescuentosNovedades;
    conceptos.push(
      {
        tipo: "DEDUCCION",
        clave: "SALUD",
        etiqueta: "Salud (trabajador)",
        valor: deduccionSalud,
        detalle: null,
      },
      {
        tipo: "DEDUCCION",
        clave: "PENSION",
        etiqueta: "Pensión (trabajador)",
        valor: deduccionPension,
        detalle: null,
      },
    );

    // Aportes del EMPLEADOR: COSTO informativo, NUNCA descuentan del neto.
    empresaSalud = aplicarPorcentaje(baseSalarial, parametros[CLAVE_PARAM.APOS_SALUD_EMPRESA] ?? 0);
    empresaPension = aplicarPorcentaje(baseSalarial, parametros[CLAVE_PARAM.APOS_PENSION_EMPRESA] ?? 0);
    const clase = Math.min(Math.max(1, contrato.arpClase || 2), 6);
    const tarifaArp = parametros[`ARP_CLASE_${clase}`] ?? 0;
    empresaRiesgos = aplicarPorcentaje(baseSalarial, tarifaArp);
    // Caja de compensación: base CON auxilio incluido (Ley 21 de 1982,
    // art. 30: sobre el salario devengado + auxilio de transporte).
    empresaCaja = aplicarPorcentaje(totalDevengado, parametros[CLAVE_PARAM.APOS_CAJA_EMPRESA] ?? 0);
    conceptos.push(
      {
        tipo: "EMPRESA",
        clave: "EMPRESA_SALUD",
        etiqueta: "Salud del empleador",
        valor: empresaSalud,
        detalle: null,
      },
      {
        tipo: "EMPRESA",
        clave: "EMPRESA_PENSION",
        etiqueta: "Pensión del empleador",
        valor: empresaPension,
        detalle: null,
      },
      {
        tipo: "EMPRESA",
        clave: "EMPRESA_ARP",
        etiqueta: "Riesgo laboral (ARP)",
        valor: empresaRiesgos,
        detalle: `Clase de riesgo ${clase}`,
      },
      {
        tipo: "EMPRESA",
        clave: "EMPRESA_CAJA",
        etiqueta: "Caja de compensación",
        valor: empresaCaja,
        detalle: null,
      },
    );

    // ── Causación de prestaciones del período ──
    // Prima: devengado CON auxilio / 12 (Art. 184-185 CST: el auxilio
    // prima con los salarios).
    prestacionPrima = Math.round(totalDevengado / FACTORES_PRESTACIONES.PRIMA_MESES);
    // Cesantías: devengado CON auxilio / 12 (Art. 249 CST).
    prestacionCesantias = Math.round(totalDevengado / FACTORES_PRESTACIONES.CESANTIAS_MESES);
    // Intereses: 12 % anual sobre cesantías, causado por los días del
    // período base 365 (Art. 240 CST).
    prestacionIntereses = aplicarPorcentaje(
      Math.round((prestacionCesantias * diasPeriodo) / FACTORES_PRESTACIONES.INTERESES_DIAS_ANIO),
      FACTORES_PRESTACIONES.INTERESES_ANUAL,
    );
    // Vacaciones: devengado SALARIAL (sin auxilio) / 24 — el auxilio NO
    // causa vacaciones (Art. 186 CST).
    prestacionVacaciones = Math.round(baseSalarial / FACTORES_PRESTACIONES.VACACIONES_MESES);
    conceptos.push(
      {
        tipo: "PRESTACION",
        clave: "PRESTACION_PRIMA",
        etiqueta: "Causación prima de servicios",
        valor: prestacionPrima,
        detalle: null,
      },
      {
        tipo: "PRESTACION",
        clave: "PRESTACION_CESANTIAS",
        etiqueta: "Causación cesantías",
        valor: prestacionCesantias,
        detalle: null,
      },
      {
        tipo: "PRESTACION",
        clave: "PRESTACION_INTERESES",
        etiqueta: "Causación intereses a las cesantías",
        valor: prestacionIntereses,
        detalle: null,
      },
      {
        tipo: "PRESTACION",
        clave: "PRESTACION_VACACIONES",
        etiqueta: "Causación vacaciones",
        valor: prestacionVacaciones,
        detalle: null,
      },
    );

    if (diasSinPago > 0)
      conceptos.push({
        tipo: "DEVENGADO",
        clave: "AUSENCIAS",
        etiqueta: "Días sin pago (información)",
        valor: 0,
        detalle: `${diasSinPago} días de novedades sin pago`,
      });

    // FSP: SEMBRADO PERO NO CALCULADO (pendiente regla Ley 2466).
    notas.push("FSP no se calcula: pendiente verificar la regla exacta de la Ley 2466 de 2025.");
    if (diasSinPago > 0 && jornadaPendiente(novedades, "INCAPACIDAD"))
      notas.push("INCAPACIDAD contada como días sin pago, pendiente verificar los 3 primeros días y el día 91.");
  }

  if (contrato.modalidad === "INDEPENDIENTE") {
    notas.push("Prestación de servicios: sin aportes, prestaciones ni deducciones de nómina.");
  }
  if (contrato.remuneracion === "DIARIO") {
    notas.push("Salario diário: se paga por jornada; sin recargos separados (documentado).");
  }
  if (contrato.remuneracion === "HORARIO") {
    notas.push("Pago por horas: cada minuto trabajado a valorHora/60; sin recargos separados (documentado).");
  }

  const netoAPagar = totalDevengado - totalDeducciones;
  const costoEmpleador = empresaSalud + empresaPension + empresaRiesgos + empresaCaja;

  return {
    diasTrabajados: contrato.remuneracion === "DIARIO" ? otrosDevengadosDias : diasDevengados,
    salarioBase,
    horasExtrasRecargos,
    comisionesBonos,
    auxilioTransporte,
    otrosDevengados: 0,
    totalDevengado,
    deduccionSalud,
    deduccionPension,
    otrosDescuentos: otrosDescuentosNovedades,
    totalDeducciones,
    netoAPagar,
    empresaSalud,
    empresaPension,
    empresaRiesgos,
    empresaCaja,
    costoEmpleador,
    prestacionPrima,
    prestacionCesantias,
    prestacionIntereses,
    prestacionVacaciones,
    conceptos,
    notasCalculo: notas,
  };
}

/** ¿Hay alguna novedad del tipo dado en la lista? (para notas) */
function jornadaPendiente(novedades: NovedadResumen[], tipo: string): boolean {
  return novedades.some((n) => n.tipo === tipo);
}
