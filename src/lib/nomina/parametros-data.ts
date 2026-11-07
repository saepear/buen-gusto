// ═════════ Parámetros laborales — DATOS (sin dependencias) ═════════
// Módulo importable desde scripts (tsx) y desde la app. Las funciones con
// acceso a base de datos viven en `parametros.ts`.
//
// Convenciones de la tabla ParametroLaboral:
//  • Dinero (unidad COP): valor = pesos colombianos enteros.
//  • Porcentajes (unidad PORCENTAJE): diezmilésimas. 100.00 % = 1_000_000,
//    4 % = 40_000, 0.522 % = 5_220.
//  • Tiempos (unidad MINUTOS): minutos del día desde la medianoche.
//  • Una modificación normativa entra como FILA NUEVA desde su vigenciaDesde;
//    nunca se edita una fila vigente en el pasado.
//  • Las liquidaciones cerradas guardan la FOTO (JSON) de los parámetros
//    que usaron, así que estos datos NO pueden cambiar el pasado.

export const CLAVE_PARAM = {
  SALARIO_MINIMO: "SALARIO_MINIMO",
  AUXILIO_TRANSPORTE: "AUXILIO_TRANSPORTE",
  UVT: "UVT",
  JORNADA_SEMANAL_MIN: "JORNADA_SEMANAL_MIN",
  HORA_INICIO_NOCTURNO: "HORA_INICIO_NOCTURNO",
  RECARGO_NOCTURNO: "RECARGO_NOCTURNO",
  RECARGO_DOMINICAL: "RECARGO_DOMINICAL",
  RECARGO_EXTRA_DIURNA: "RECARGO_EXTRA_DIURNA",
  RECARGO_EXTRA_NOCTURNA: "RECARGO_EXTRA_NOCTURNA",
  APOS_SALUD_TRABAJADOR: "APOS_SALUD_TRABAJADOR",
  APOS_PENSION_TRABAJADOR: "APOS_PENSION_TRABAJADOR",
  APOS_SALUD_EMPRESA: "APOS_SALUD_EMPRESA",
  APOS_PENSION_EMPRESA: "APOS_PENSION_EMPRESA",
  ARP_CLASE_1: "ARP_CLASE_1",
  ARP_CLASE_2: "ARP_CLASE_2",
  ARP_CLASE_3: "ARP_CLASE_3",
  ARP_CLASE_4: "ARP_CLASE_4",
  ARP_CLASE_5: "ARP_CLASE_5",
  ARP_CLASE_6: "ARP_CLASE_6",
  APOS_CAJA_EMPRESA: "APOS_CAJA_EMPRESA",
  FSP_TRABAJADOR: "FSP_TRABAJADOR",
} as const;

export type ClaveParam = (typeof CLAVE_PARAM)[keyof typeof CLAVE_PARAM];

export const CLAVE_PARAM_LABEL: Record<ClaveParam, string> = {
  SALARIO_MINIMO: "Salario mínimo mensual (SMMLV)",
  AUXILIO_TRANSPORTE: "Auxilio de transporte",
  UVT: "UVT",
  JORNADA_SEMANAL_MIN: "Jornada legal semanal",
  HORA_INICIO_NOCTURNO: "Hora de inicio del trabajo nocturno",
  RECARGO_NOCTURNO: "Recargo nocturno",
  RECARGO_DOMINICAL: "Recargo dominical/festivo",
  RECARGO_EXTRA_DIURNA: "Hora extra diurna",
  RECARGO_EXTRA_NOCTURNA: "Hora extra nocturna",
  APOS_SALUD_TRABAJADOR: "Salud del trabajador",
  APOS_PENSION_TRABAJADOR: "Pensión del trabajador",
  APOS_SALUD_EMPRESA: "Salud del empleador",
  APOS_PENSION_EMPRESA: "Pensión del empleador",
  ARP_CLASE_1: "ARP clase I",
  ARP_CLASE_2: "ARP clase II",
  ARP_CLASE_3: "ARP clase III",
  ARP_CLASE_4: "ARP clase IV",
  ARP_CLASE_5: "ARP clase V",
  ARP_CLASE_6: "ARP clase VI",
  APOS_CAJA_EMPRESA: "Caja de compensación (empleador)",
  FSP_TRABAJADOR: "Fondo de solidaridad pensional",
};

export const UNIDAD_PARAM = {
  COP: "COP",
  PORCENTAJE: "PORCENTAJE",
  MINUTOS: "MINUTOS",
} as const;

/** Valores para siembra (idempotente): fila nueva por vigencia. */
export type ParametroSemilla = {
  clave: ClaveParam;
  valor: number;
  unidad: string;
  vigenciaDesde: string; // yyyy-mm-dd
  vigenciaHasta: string | null; // yyyy-mm-dd o null = sin fin declarado
  descripcion: string;
  fuente: string;
  pendienteVerificar: boolean;
  nota: string | null;
  categoria: string;
};

const INDICADOR = "INDICADOR";
const RECARGO = "RECARGO";
const APOS_TRABAJADOR = "APOS_TRABAJADOR";
const APOS_EMPRESA = "APOS_EMPRESA";
const JORNADA = "JORNADA";

// Fuente general de los indicadores 2026 (Decreto 1470 de 29 dic 2025 vía
// calculadorasonline.co — verificado en esta implementación; el dueño debe
// cotejar el Decreto en la DIAN antes de la nómina de enero 2026).
const FUENTE_2026 = "Decreto 1470 de 29 dic 2025 (SMMLV/auxilio/UVT 2026)";
const FUENTE_2025 = "Decreto 982 de 9 jul 2024 (SMMLV/auxilio/UVT 2025)";

export const PARAMETROS_SEMILLA: ParametroSemilla[] = [
  // ── Indicadores anuales ──
  {
    clave: CLAVE_PARAM.SALARIO_MINIMO,
    valor: 1_423_500,
    unidad: UNIDAD_PARAM.COP,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: "2025-12-31",
    descripcion: "SMMLV calendario 2025",
    fuente: FUENTE_2025,
    pendienteVerificar: false,
    nota: null,
    categoria: INDICADOR,
  },
  {
    clave: CLAVE_PARAM.SALARIO_MINIMO,
    valor: 1_750_905,
    unidad: UNIDAD_PARAM.COP,
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: null,
    descripcion: "SMMLV calendario 2026",
    fuente: FUENTE_2026,
    pendienteVerificar: false,
    nota: null,
    categoria: INDICADOR,
  },
  {
    clave: CLAVE_PARAM.AUXILIO_TRANSPORTE,
    valor: 200_000,
    unidad: UNIDAD_PARAM.COP,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: "2025-12-31",
    descripcion: "Auxilio de transporte 2025 (hasta 2 SMMLV)",
    fuente: FUENTE_2025,
    pendienteVerificar: false,
    nota: null,
    categoria: INDICADOR,
  },
  {
    clave: CLAVE_PARAM.AUXILIO_TRANSPORTE,
    valor: 249_095,
    unidad: UNIDAD_PARAM.COP,
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: null,
    descripcion: "Auxilio de transporte 2026 (aplica a quienes devenguen hasta 2 SMMLV)",
    fuente: FUENTE_2026,
    pendienteVerificar: false,
    nota: null,
    categoria: INDICADOR,
  },
  {
    clave: CLAVE_PARAM.UVT,
    valor: 47_065,
    unidad: UNIDAD_PARAM.COP,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: "2025-12-31",
    descripcion: "UVT calendario 2025",
    fuente: FUENTE_2025,
    pendienteVerificar: false,
    nota: null,
    categoria: INDICADOR,
  },
  {
    clave: CLAVE_PARAM.UVT,
    valor: 52_374,
    unidad: UNIDAD_PARAM.COP,
    vigenciaDesde: "2026-01-01",
    vigenciaHasta: null,
    descripcion: "UVT calendario 2026",
    fuente: FUENTE_2026,
    pendienteVerificar: false,
    nota: null,
    categoria: INDICADOR,
  },

  // ── Jornada (Ley 2101 de 2021: reducción gradual) ──
  {
    clave: CLAVE_PARAM.JORNADA_SEMANAL_MIN,
    valor: 2_640, // 44 h
    unidad: UNIDAD_PARAM.MINUTOS,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: "2026-07-14",
    descripcion: "Jornada máxima legal 44 h semanales",
    fuente: "Ley 2101 de 2021",
    pendienteVerificar: false,
    nota: null,
    categoria: JORNADA,
  },
  {
    clave: CLAVE_PARAM.JORNADA_SEMANAL_MIN,
    valor: 2_520, // 42 h
    unidad: UNIDAD_PARAM.MINUTOS,
    vigenciaDesde: "2026-07-15",
    vigenciaHasta: null,
    descripcion: "Jornada máxima legal 42 h semanales",
    fuente: "Ley 2101 de 2021",
    pendienteVerificar: true,
    nota: "Verificado en fuentes secundarias; confirmar el acto reglamentario que fija la fecha exacta.",
    categoria: JORNADA,
  },

  // ── Nocturno ──
  {
    clave: CLAVE_PARAM.HORA_INICIO_NOCTURNO,
    valor: 1_320, // 21:00
    unidad: UNIDAD_PARAM.MINUTOS,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: "2025-12-24",
    descripcion: "Trabajo nocturno entre 21:00 y 06:00",
    fuente: "Art. 161 CST",
    pendienteVerificar: false,
    nota: null,
    categoria: JORNADA,
  },
  {
    clave: CLAVE_PARAM.HORA_INICIO_NOCTURNO,
    valor: 1_140, // 19:00
    unidad: UNIDAD_PARAM.MINUTOS,
    vigenciaDesde: "2025-12-25",
    vigenciaHasta: null,
    descripcion: "Trabajo nocturno entre 19:00 y 06:00 (reforma laboral)",
    fuente: "Ley 2466 de 2025",
    pendienteVerificar: true,
    nota: "Verificado en fuentes secundarias; confirmar la entrada en vigencia exacta (25 dic 2025).",
    categoria: JORNADA,
  },
  {
    clave: CLAVE_PARAM.RECARGO_NOCTURNO,
    valor: 350_000, // 35 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Recargo sobre la hora nocturna ordinaria",
    fuente: "Art. 168 CST, literales e/f",
    pendienteVerificar: false,
    nota: null,
    categoria: RECARGO,
  },

  // ── Dominical/festivo ──
  {
    clave: CLAVE_PARAM.RECARGO_DOMINICAL,
    valor: 800_000, // 80 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: "2026-07-14",
    descripcion: "Recargo sobre la hora dominical/festiva ordinaria",
    fuente: "Art. 179 CST + Ley 2466 de 2025",
    pendienteVerificar: false,
    nota: null,
    categoria: RECARGO,
  },
  {
    clave: CLAVE_PARAM.RECARGO_DOMINICAL,
    valor: 900_000, // 90 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2026-07-15",
    vigenciaHasta: "2027-07-14",
    descripcion: "Recargo dominical/festivo 90 % (transición de la reforma)",
    fuente: "Ley 2466 de 2025",
    pendienteVerificar: true,
    nota: "Fechas exactas del inicio de 90 % pendientes de confirmar en el texto oficial de la Ley 2466.",
    categoria: RECARGO,
  },
  {
    clave: CLAVE_PARAM.RECARGO_DOMINICAL,
    valor: 1_000_000, // 100 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2027-07-15",
    vigenciaHasta: null,
    descripcion: "Recargo dominical/festivo 100 % (límite final de la reforma)",
    fuente: "Ley 2466 de 2025",
    pendienteVerificar: true,
    nota: "Fechas exactas del inicio de 100 % pendientes de confirmar en el texto oficial de la Ley 2466.",
    categoria: RECARGO,
  },

  // ── Horas extra ──
  {
    clave: CLAVE_PARAM.RECARGO_EXTRA_DIURNA,
    valor: 250_000, // 25 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Recargo adicional de la hora extra diurna",
    fuente: "Art. 168 CST, literal a",
    pendienteVerificar: false,
    nota: null,
    categoria: RECARGO,
  },
  {
    clave: CLAVE_PARAM.RECARGO_EXTRA_NOCTURNA,
    valor: 750_000, // 75 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Recargo adicional de la hora extra nocturna",
    fuente: "Art. 168 CST, literal b",
    pendienteVerificar: false,
    nota: null,
    categoria: RECARGO,
  },

  // ── Aportes del trabajador (base salarial SIN auxilio de transporte) ──
  {
    clave: CLAVE_PARAM.APOS_SALUD_TRABAJADOR,
    valor: 40_000, // 4 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Aporte a salud del trabajador",
    fuente: "Ley 100 de 1993, art. 204 + Ley 2466 de 2025",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_TRABAJADOR,
  },
  {
    clave: CLAVE_PARAM.APOS_PENSION_TRABAJADOR,
    valor: 40_000, // 4 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Aporte a pensión del trabajador",
    fuente: "Ley 100 de 1993, art. 14 + Ley 2466 de 2025",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_TRABAJADOR,
  },

  // ── Aportes del EMPLEADOR (costo informativo, NUNCA restan del neto) ──
  {
    clave: CLAVE_PARAM.APOS_SALUD_EMPRESA,
    valor: 85_000, // 8.5 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Aporte a salud del empleador",
    fuente: "Ley 100 de 1993, art. 205",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  {
    clave: CLAVE_PARAM.APOS_PENSION_EMPRESA,
    valor: 120_000, // 12 %
   unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Aporte a pensión del empleador",
    fuente: "Ley 100 de 1993, art. 17",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  // ARP por clase de riesgo (tabla vigente Ley 2466 de 2025: I–VI) — el
  // Empleado declara su clase (arpClase).
  {
    clave: CLAVE_PARAM.ARP_CLASE_1,
    valor: 5_220, // 0.522 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Tarifa ARP clase de riesgo I",
    fuente: "Tabla vigente de riesgos laborales (Decreto 1072 de 2015, art. 2.2.4.2.6)",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  {
    clave: CLAVE_PARAM.ARP_CLASE_2,
    valor: 9_360, // 0.936 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Tarifa ARP clase de riesgo II",
    fuente: "Tabla vigente de riesgos laborales (Decreto 1072 de 2015, art. 2.2.4.2.6)",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  {
    clave: CLAVE_PARAM.ARP_CLASE_3,
    valor: 12_520, // 1.252 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Tarifa ARP clase de riesgo III",
    fuente: "Tabla vigente de riesgos laborales (Decreto 1072 de 2015, art. 2.2.4.2.6)",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  {
    clave: CLAVE_PARAM.ARP_CLASE_4,
    valor: 28_120, // 2.812 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Tarifa ARP clase de riesgo IV",
    fuente: "Tabla vigente de riesgos laborales (Decreto 1072 de 2015, art. 2.2.4.2.6)",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  {
    clave: CLAVE_PARAM.ARP_CLASE_5,
    valor: 40_580, // 4.058 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Tarifa ARP clase de riesgo V",
    fuente: "Tabla vigente de riesgos laborales (Decreto 1072 de 2015, art. 2.2.4.2.6)",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  {
    clave: CLAVE_PARAM.ARP_CLASE_6,
    valor: 69_600, // 6.96 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Tarifa ARP clase de riesgo VI",
    fuente: "Tabla vigente de riesgos laborales (Decreto 1072 de 2015, art. 2.2.4.2.6)",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  {
    clave: CLAVE_PARAM.APOS_CAJA_EMPRESA,
    valor: 40_000, // 4 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Caja de compensación (base incluye el auxilio de transporte)",
    fuente: "Ley 21 de 1982, art. 30",
    pendienteVerificar: false,
    nota: null,
    categoria: APOS_EMPRESA,
  },
  // Sembrado pero NO CALCULADO todavía: la regla exacta de la Ley 2466
  // (piso de 4 SMMLV y aporte del 1 % sobre el excedente) queda pendiente de
  // verificación antes de usarla. Ver nota en calculo.ts.
  {
    clave: CLAVE_PARAM.FSP_TRABAJADOR,
    valor: 10_000, // 1 %
    unidad: UNIDAD_PARAM.PORCENTAJE,
    vigenciaDesde: "2025-01-01",
    vigenciaHasta: null,
    descripcion: "Fondo de solidaridad pensional (excedente sobre 4 SMMLV)",
    fuente: "Ley 100 de 1993, art. 25 (tarifa y piso a confirmar)",
    pendienteVerificar: true,
    nota: "SEMBRADO PERO NO CALCULADO: no se aplica ninguna retención de FSP hasta verificar la regla exacta de la Ley 2466 de 2025.",
    categoria: APOS_TRABAJADOR,
  },
];

// ═════════ Fórmulas de prestaciones (proporciones fijas, no cambiantes) ═════════
// NO son parámetros de vigencia: son definiciones del Código Sustantivo del
// Trabajo; se congelan igual en la foto de cada liquidación.
export const FACTORES_PRESTACIONES = {
  /** Prima de servicios: 1 salario (y auxilio) de cada 12 meses — Art. 184 CST. */
  PRIMA_MESES: 12,
  /** Cesantías: 1 salario (y auxilio) de cada 12 meses — Art. 249 CST. */
  CESANTIAS_MESES: 12,
  /** Intereses a las cesantías: 12 % anual sobre las cesantías, causado
   *  sobre los días del período con base 365 días — Art. 240 CST. */
  INTERESES_ANUAL: 120_000, // 12 % en diezmilésimas
  INTERESES_DIAS_ANIO: 365,
  /** Vacaciones: 15 días hábiles de cada año laboral = devengado salarial
   *  (sin auxilio) / 24 — Art. 186 CST (auxilio NO causa vacaciones). */
  VACACIONES_MESES: 24,
  /** Días del mes usado para las proporciones de salario y auxilio (CST). */
  DIAS_MES: 30,
} as const;
