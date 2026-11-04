import ExcelJS from "exceljs";
import { TIPO_PRODUCTO_LABEL } from "@/lib/roles";
import { formatHora } from "@/lib/format";
import { ETIQUETA_METODO, type DatosReporte } from "./datos-reporte";

/**
 * Construye el archivo Excel del reporte diario (librería ExcelJS) con las
 * 10 hojas de la casa: Resumen financiero, Ventas y pedidos, Productos,
 * Métodos de pago, Gastos, Cuentas por cobrar, Pagos y abonos, Apartados,
 * Domicilios y Cierre de caja.
 *
 * Recibe EXACTAMENTE los números que la página de Reportes pinta (vienen
 * de `datosReporte`), así el archivo y la pantalla nunca discrepan. No
 * inventa campos: solo lo que vive en la base de datos, en formato COP.
 */

const COP = '"$"#,##0';
const COLOR_TINTA = "FF3B2415"; // marrón oscuro de la marca
const COLOR_AMBAR = "FFF2A63D"; // ámbar de la marca
const COLOR_BANDA = "FFFCF7EC"; // crema suave para filas pares
const COLOR_TOTAL = "FFF0E4CB"; // banda un poco más fuerte para totales
const COLOR_SUBTITULO = "FF6B5D4A";
const COLOR_NOTA = "FF9A8A70";
const METODO_KEYS = Object.keys(ETIQUETA_METODO); // EFECTIVO, TARJETA, TRANSFERENCIA

type Hoja = ExcelJS.Worksheet;
/** Una fila de tabla: solo cadenas, números o nulos */
type Valor = string | number | null;

/** Celda de encabezado de tabla: ámbar de la marca con letra marrón */
function cabeceraTabla(
  hoja: Hoja,
  fila: number,
  etiquetas: string[],
  desdeCol = 1,
): void {
  etiquetas.forEach((texto, idx) => {
    const celda = hoja.getCell(fila, desdeCol + idx);
    celda.value = texto;
    celda.font = { bold: true, color: { argb: COLOR_TINTA }, size: 11 };
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_AMBAR },
    };
    celda.alignment = { vertical: "middle", horizontal: "left" };
    celda.border = bordeSuave();
  });
}

function bordeSuave(): ExcelJS.Borders {
  const lado = { style: "thin" as const, color: { argb: "FFD8CDB6" } };
  return {
    top: lado,
    left: lado,
    bottom: lado,
    right: lado,
  } as unknown as ExcelJS.Borders;
}

/** Título del libro en cada hoja: nombre + día reportado + momento generado */
function tituloHoja(
  hoja: Hoja,
  titulo: string,
  hastaCol: number,
  dia: string,
  generado: string,
): void {
  hoja.mergeCells(1, 1, 1, hastaCol);
  const t = hoja.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 15, color: { argb: COLOR_TINTA } };

  hoja.mergeCells(2, 1, 2, hastaCol);
  const d = hoja.getCell(2, 1);
  d.value = `Día del reporte: ${dia}`;
  d.font = { size: 11, color: { argb: COLOR_SUBTITULO } };

  hoja.mergeCells(3, 1, 3, hastaCol);
  const g = hoja.getCell(3, 1);
  g.value = `Generado: ${generado}`;
  g.font = { size: 9, color: { argb: COLOR_NOTA } };

  hoja.getRow(4).height = 6; // aire bajo el título
}

/** Par etiqueta/valor de los bloques del Resumen (A = etiqueta, B = valor) */
function filaResumen(
  hoja: Hoja,
  fila: number,
  etiqueta: string,
  valor: Valor,
  opciones: { dinero?: boolean; fuerte?: boolean; advertencia?: boolean } = {},
): void {
  const et = hoja.getCell(fila, 1);
  et.value = etiqueta;
  et.font = {
    bold: opciones.fuerte === true,
    color: { argb: opciones.advertencia ? COLOR_SUBTITULO : COLOR_TINTA },
  };

  const va = hoja.getCell(fila, 2);
  va.value = valor ?? "—";
  va.alignment = { horizontal: "right" };
  if (opciones.dinero && typeof valor === "number") va.numFmt = COP;
  va.font = {
    bold: opciones.fuerte === true || opciones.advertencia === true,
    color: { argb: opciones.advertencia ? COLOR_AMBAR : COLOR_TINTA },
  };
}

/** Subtítulo de bloque dentro del Resumen */
function subtituloBloque(hoja: Hoja, fila: number, texto: string): void {
  const c = hoja.getCell(fila, 1);
  c.value = texto;
  c.font = { bold: true, size: 12, color: { argb: COLOR_SUBTITULO } };
}

/**
 * Tabla de datos: cabecera ámbar + cuerpo cebra + fila de total opcional.
 * `colDinero` son los NÚMEROS de columna (1-based) que llevan formato COP.
 * Devuelve el número de la última fila escrita.
 */
function tablaSimple(
  hoja: Hoja,
  filaInicio: number,
  cabeceras: string[],
  cuerpo: Valor[][],
  opciones: { colDinero?: number[]; total?: Valor[] } = {},
): number {
  cabeceraTabla(hoja, filaInicio, cabeceras);

  cuerpo.forEach((filaDatos, i) => {
    const f = filaInicio + 1 + i;
    filaDatos.forEach((valor, j) => {
      const celda = hoja.getCell(f, j + 1);
      celda.value = valor ?? "—";
      celda.font = { color: { argb: COLOR_TINTA } };
      if ((opciones.colDinero ?? []).includes(j + 1) && typeof valor === "number") {
        celda.numFmt = COP;
        celda.alignment = { horizontal: "right" };
      }
      if (i % 2 === 1) {
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLOR_BANDA },
        };
      }
      celda.border = bordeSuave();
      celda.alignment = celda.alignment ?? { vertical: "middle" };
    });
  });

  let filaFin = filaInicio + cuerpo.length;
  if (opciones.total) {
    filaFin += 1;
    opciones.total.forEach((valor, j) => {
      const celda = hoja.getCell(filaFin, j + 1);
      celda.value = valor ?? "";
      celda.font = { bold: true, color: { argb: COLOR_TINTA } };
      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_TOTAL },
      };
      celda.border = bordeSuave();
      if ((opciones.colDinero ?? []).includes(j + 1)) celda.numFmt = COP;
    });
  }
  return filaFin;
}

/** Bloque de texto suave (notas aclaratorias del reporte) */
function notaHoja(hoja: Hoja, fila: number, texto: string, hastaCol: number): void {
  hoja.mergeCells(fila, 1, fila, hastaCol);
  const c = hoja.getCell(fila, 1);
  c.value = texto;
  c.font = { size: 9, italic: true, color: { argb: COLOR_NOTA } };
}

function formatoHora(d: Date): string {
  return formatHora(d);
}

export async function construirLibroExcel(
  datos: DatosReporte,
): Promise<ExcelJS.Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "El Buen Gusto · POS";
  libro.created = new Date();

  const diaLegible = datos.fechaDia.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const generado = new Date().toLocaleString("es-CO");

  // ════ Hoja 1 · Resumen financiero ════
  const resumen = libro.addWorksheet("Resumen financiero", {
    views: [{ showGridLines: false }],
  });
  resumen.columns = [{ width: 42 }, { width: 20 }];
  tituloHoja(resumen, "El Buen Gusto · Resumen financiero del día", 2, diaLegible, generado);

  subtituloBloque(resumen, 5, "Ventas (dinero de las comandas)");
  filaResumen(resumen, 6, "Ventas del día (pagos + propinas)", datos.pagadoHoy, {
    dinero: true,
    fuerte: true,
  });
  filaResumen(resumen, 7, "Pagos del día (sin propinas)", datos.totalPagos, { dinero: true });
  filaResumen(resumen, 8, "Propinas recibidas", datos.propinasHoy, { dinero: true });
  filaResumen(resumen, 9, "Cantidad de pagos", datos.numeroPagos);
  filaResumen(resumen, 10, "Comandas servidas (SERVIDO/COBRADO)", datos.numeroComandas);
  filaResumen(resumen, 11, "Comandas en cocina", datos.enCocina.length);
  filaResumen(resumen, 12, "Comandas canceladas", datos.canceladas.length);
  filaResumen(resumen, 13, "Ticket promedio", datos.ticketPromedio, { dinero: true });
  filaResumen(
    resumen,
    14,
    "Recaudo de domicilios entregados",
    datos.recaudoDomicilios,
    { dinero: true },
  );

  let fila = 15;
  fila += 1;
  subtituloBloque(resumen, fila, "Pagos de deudas (abonos) — no son ventas");
  fila += 1;
  filaResumen(resumen, fila, "Abonos recibidos hoy", datos.abonosTotal, { dinero: true, fuerte: true });
  fila += 1;
  filaResumen(resumen, fila, "Cantidad de abonos", datos.numeroAbonos);
  fila += 1;
  for (const m of METODO_KEYS) {
    const valor = datos.abonosPorMetodo.get(m) ?? 0;
    if (valor > 0) {
      filaResumen(resumen, fila, `${ETIQUETA_METODO[m] ?? m} (abonos)`, valor, { dinero: true });
      fila += 1;
    }
  }

  fila += 1;
  subtituloBloque(resumen, fila, "Gastos del día");
  fila += 1;
  filaResumen(resumen, fila, "Gastos pagados desde caja", datos.gastosCaja, {
    dinero: true,
    fuerte: true,
  });
  fila += 1;
  filaResumen(resumen, fila, "…de ellos, en efectivo de caja", datos.gastosCajaEfectivo, { dinero: true });
  fila += 1;
  filaResumen(resumen, fila, "Gastos con dinero externo (auditados)", datos.gastosExternos, { dinero: true });
  fila += 1;
  filaResumen(resumen, fila, "Total de gastos del día", datos.gastosTotal, { dinero: true });

  fila += 1;
  subtituloBloque(resumen, fila, "Flujo de efectivo del día");
  fila += 1;
  filaResumen(resumen, fila, "(+ ) Efectivo de ventas", datos.efectivoVentas, { dinero: true });
  fila += 1;
  filaResumen(resumen, fila, "(+ ) Efectivo de abonos de deudas", datos.efectivoAbonos, { dinero: true });
  fila += 1;
  filaResumen(resumen, fila, "(− ) Gastos pagados con efectivo de caja", datos.gastosCajaEfectivo, { dinero: true });
  fila += 1;
  filaResumen(resumen, fila, "Efectivo disponible", datos.efectivoDisponible, {
    dinero: true,
    fuerte: true,
  });

  fila += 1;
  subtituloBloque(resumen, fila, "Fiados (cuentas por cobrar)");
  fila += 1;
  filaResumen(resumen, fila, "Deudas creadas hoy", datos.cxcCreadasCantidad);
  fila += 1;
  filaResumen(resumen, fila, "Valor fiado hoy", datos.cxcCreadasValor, { dinero: true });
  fila += 1;
  filaResumen(resumen, fila, "Deuda pendiente de cobrar (saldo real)", datos.cxcPendienteTotal, {
    dinero: true,
    fuerte: true,
  });
  fila += 1;
  filaResumen(
    resumen,
    fila,
    `Condonaciones de hoy${datos.numeroCondonaciones > 0 ? ` (${datos.numeroCondonaciones})` : ""}`,
    datos.cxcCondonadoValorHoy,
    { dinero: true, advertencia: true },
  );
  fila += 1;
  filaResumen(resumen, fila, "Apartados creados / entregados", `${datos.apartadosCreados} / ${datos.apartadosEntregados}`);
  filaResumen(resumen, fila + 1, "Cierre de caja", datos.cierreHoy ? "Hecho" : "Pendiente");
  notaHoja(
    resumen,
    fila + 3,
    "Una deuda fiada NO es ingreso de caja: el dinero entra el día en que se paga (abonos). La condonación perdona el saldo restante: tampoco es ingreso. Detalle en las hojas siguientes.",
    2,
  );

  // ════ Hoja 2 · Ventas y pedidos ════
  const pedidosHoja = libro.addWorksheet("Ventas y pedidos", {
    views: [{ showGridLines: false }],
  });
  pedidosHoja.columns = [
    { width: 8 },
    { width: 14 },
    { width: 22 },
    { width: 16 },
    { width: 22 },
    { width: 15 },
    { width: 15 },
  ];
  tituloHoja(pedidosHoja, "El Buen Gusto · Ventas y pedidos del día", 7, diaLegible, generado);

  // Los totales del día excluyen las canceladas (igual que en la página)
  const noCanceladas = datos.filasPedidos.filter(
    (p) => p.estadoLabel !== "Cancelado",
  );
  const filaFinPedidos = tablaSimple(
    pedidosHoja,
    5,
    ["ID", "Hora", "Mesa / modalidad", "Estado", "Métodos de pago", "Total comanda", "Total pagado"],
    datos.filasPedidos.map((p) => [
      p.id,
      formatoHora(p.hora),
      p.canal,
      p.estadoLabel,
      p.metodos ?? "Sin cobrar",
      p.totalComanda,
      p.totalPagado,
    ]),
    {
      colDinero: [6, 7],
      total: [
        "Total",
        "",
        `${datos.filasPedidos.length} pedidos`,
        "",
        "",
        noCanceladas.reduce((s, p) => s + p.totalComanda, 0),
        noCanceladas.reduce((s, p) => s + p.totalPagado, 0),
      ],
    },
  );

  // Ingresos por hora (mismo cálculo de la página) debajo de la tabla
  const filaHora = filaFinPedidos + 2;
  notaHoja(pedidosHoja, filaHora, "Ingresos por hora (pagos + propinas)", 7);
  tablaSimple(
    pedidosHoja,
    filaHora + 1,
    ["Hora", "Ingresos"],
    datos.horasLista.map((h) => [h.etiqueta, h.valor]),
    { colDinero: [2], total: ["Total", datos.pagadoHoy] },
  );
  notaHoja(
    pedidosHoja,
    filaHora + datos.horasLista.length + 4,
    "Los totales excluyen las comandas canceladas. «Total pagado» suma pagos y propinas de caja; los apartados entregados Y cobrados juegan como comandas normales; los fiados entran cuando se abonen.",
    7,
  );

  // ════ Hoja 3 · Productos vendidos ════
  const productosHoja = libro.addWorksheet("Productos", {
    views: [{ showGridLines: false }],
  });
  productosHoja.columns = [
    { width: 26 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 16 },
  ];
  tituloHoja(
    productosHoja,
    "El Buen Gusto · Productos vendidos",
    5,
    diaLegible,
    generado,
  );

  // Almuerzos por proteína: la proteína cobra el plato completo
  let fina = 5;
  notaHoja(productosHoja, fina, "Almuerzos por proteína", 5);
  fina = tablaSimple(
    productosHoja,
    fina + 1,
    ["Proteína", "Unidades", "Sin sopa", "Valor generado"],
    datos.proteinasLista.map(([nombre, f]) => [
      nombre,
      f.unidades,
      f.sinSopa,
      f.recaudo,
    ]),
    {
      colDinero: [4],
      total: [
        "Total",
        datos.proteinasLista.reduce((s, [, f]) => s + f.unidades, 0),
        datos.proteinasLista.reduce((s, [, f]) => s + f.sinSopa, 0),
        datos.proteinasLista.reduce((s, [, f]) => s + f.recaudo, 0),
      ],
    },
  );

  fina += 2;
  notaHoja(productosHoja, fina, "Bebidas, adicionales y demás ítems cobrados aparte", 5);
  fina = tablaSimple(
    productosHoja,
    fina + 1,
    ["Producto", "Tipo", "Unidades", "Valor generado"],
    datos.extrasLista.map(([nombre, f]) => [
      nombre,
      TIPO_PRODUCTO_LABEL[f.tipo as keyof typeof TIPO_PRODUCTO_LABEL] ?? f.tipo,
      f.unidades,
      f.recaudo,
    ]),
    {
      colDinero: [4],
      total: [
        "Total",
        "",
        datos.extrasLista.reduce((s, [, f]) => s + f.unidades, 0),
        datos.extrasLista.reduce((s, [, f]) => s + f.recaudo, 0),
      ],
    },
  );
  notaHoja(
    productosHoja,
    fina + 2,
    "Solo cuenta lo que llegó a servirse (SERVIDO/COBRADO). Sopas, principios y ensaladas del almuerzo van incluidos en el precio del plato y no generan cobro aparte; los valores salen del precio fijado al ordenar.",
    5,
  );

  // ════ Hoja 4 · Métodos de pago ════
  const metodosHoja = libro.addWorksheet("Métodos de pago", {
    views: [{ showGridLines: false }],
  });
  metodosHoja.columns = [{ width: 18 }, { width: 16 }, { width: 14 }, { width: 12 }, { width: 14 }];
  tituloHoja(
    metodosHoja,
    "El Buen Gusto · Métodos de pago",
    5,
    diaLegible,
    generado,
  );

  const cuerpoMetodos: Valor[][] = METODO_KEYS.map((m) => [
    ETIQUETA_METODO[m] ?? m,
    datos.porMetodo.get(m) ?? 0,
    datos.propinasPorMetodo.get(m) ?? 0,
    datos.pagosPorMetodo.get(m) ?? 0,
    datos.pagadoHoy > 0
      ? Math.round(((datos.porMetodo.get(m) ?? 0) / datos.pagadoHoy) * 100)
      : 0,
  ]);
  const filaFinMetodos = tablaSimple(
    metodosHoja,
    5,
    ["Método", "Recaudo", "Propinas", "Pagos", "% del día"],
    cuerpoMetodos,
    {
      colDinero: [2, 3],
      total: ["Total", datos.totalPagos, datos.propinasHoy, datos.numeroPagos, ""],
    },
  );

  const abonosPorMetodo = METODO_KEYS.map((m) => [
    ETIQUETA_METODO[m] ?? m,
    datos.abonosPorMetodo.get(m) ?? 0,
  ]);
  notaHoja(metodosHoja, filaFinMetodos + 2, "Abonos de deudas por método (dinero recibido por fiados, distinto de las ventas)", 5);
  tablaSimple(
    metodosHoja,
    filaFinMetodos + 3,
    ["Método", "Abonos recibidos"],
    abonosPorMetodo,
    {
      colDinero: [2],
      total: [
        "Total",
        METODO_KEYS.reduce((s, m) => s + (datos.abonosPorMetodo.get(m) ?? 0), 0),
      ],
    },
  );

  // ════ Hoja 5 · Gastos ════
  const gastosHoja = libro.addWorksheet("Gastos", {
    views: [{ showGridLines: false }],
  });
  gastosHoja.columns = [
    { width: 8 },
    { width: 13 },
    { width: 34 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 30 },
  ];
  tituloHoja(gastosHoja, "El Buen Gusto · Gastos del día", 8, diaLegible, generado);

  filaResumen(gastosHoja, 5, "Gastos pagados desde caja", datos.gastosCaja, { dinero: true, fuerte: true });
  filaResumen(gastosHoja, 6, "…de ellos, en efectivo (descuentan el efectivo del día)", datos.gastosCajaEfectivo, { dinero: true });
  filaResumen(gastosHoja, 7, "Gastos con dinero externo (solo auditoría)", datos.gastosExternos, { dinero: true });
  filaResumen(gastosHoja, 8, "Total de gastos del día", datos.gastosTotal, { dinero: true, fuerte: true });

  const gastosAnulados = datos.filasGastos.filter((g) => g.anulado);
  if (gastosAnulados.length > 0) {
    filaResumen(gastosHoja, 9, "Gastos anulados HOY (no suman; queda trazabilidad)", gastosAnulados.length);
  }

  const filaGastos = 11;
  notaHoja(gastosHoja, filaGastos, "Registro del día (los anulados aparecen marcados y NO suman)", 8);
  tablaSimple(
    gastosHoja,
    filaGastos + 1,
    ["ID", "Hora", "Descripción", "Categoría", "Método", "Origen", "Valor", "Registró"],
    datos.filasGastos.map((g) => [
      g.id,
      formatoHora(g.hora),
      g.anulado
        ? `${g.descripcion} (ANULADO ${g.anuladoPor ? `por ${g.anuladoPor}` : ""}${g.anuladoMotivo ? `: ${g.anuladoMotivo}` : ""})`
        : g.descripcion,
      g.categoriaLabel,
      g.metodoLabel,
      g.origenLabel,
      g.anulado ? null : g.valor,
      g.usuario,
    ]),
    {
      colDinero: [7],
      total: [
        "Total (sin anulados)",
        "",
        "",
        "",
        "",
        "",
        datos.gastosTotal,
        "",
      ],
    },
  );

  // ════ Hoja 6 · Cuentas por cobrar ════
  const cxcHoja = libro.addWorksheet("Cuentas por cobrar", {
    views: [{ showGridLines: false }],
  });
  cxcHoja.columns = [
    { width: 8 },
    { width: 13 },
    { width: 24 },
    { width: 14 },
    { width: 34 },
    { width: 15 },
    { width: 13 },
    { width: 15 },
    { width: 16 },
  ];
  tituloHoja(cxcHoja, "El Buen Gusto · Fiados (cuentas por cobrar)", 8, diaLegible, generado);

  filaResumen(cxcHoja, 5, "Deudas creadas HOY", datos.cxcCreadasCantidad);
  filaResumen(cxcHoja, 6, "Valor fiado HOY (no es ingreso de caja)", datos.cxcCreadasValor, {
    dinero: true,
    fuerte: true,
  });
  filaResumen(
    cxcHoja,
    7,
    "Condonado HOY (saldo perdonado: tampoco es ingreso)",
    datos.cxcCondonadoValorHoy,
    { dinero: true, advertencia: true },
  );
  filaResumen(cxcHoja, 8, "Deuda TOTAL por cobrar ahora mismo (saldo real)", datos.cxcPendienteTotal, {
    dinero: true,
    fuerte: true,
  });
  notaHoja(cxcHoja, 9, "El listado de pendientes abarca TODAS las deudas vivas (de hoy y anteriores).", 8);

  let filaCxc = 11;
  notaHoja(cxcHoja, filaCxc, "Fiados creados HOY", 8);
  const finCreadas = tablaSimple(
    cxcHoja,
    filaCxc + 1,
    ["ID", "Hora", "Cliente", "Teléfono", "Concepto", "Valor", "Estado", "Pedido ref.", "Registró"],
    datos.filasCuentasCreadas.map((c) => [
      c.id,
      formatoHora(c.hora),
      c.cliente,
      c.telefono,
      c.concepto,
      c.valorOriginal,
      c.estadoLabel,
      c.pedidoId ? `#${c.pedidoId}` : "—",
      c.creadoPor,
    ]),
    {
      colDinero: [6],
      total: [
        "Total vivas (sin anuladas)",
        "",
        "",
        "",
        "",
        datos.cxcCreadasValor,
        "",
        "",
        "",
      ],
    },
  );

  filaCxc = finCreadas + 2;
  notaHoja(cxcHoja, filaCxc, "Condonaciones hechas HOY (perdón del saldo restante; conserva los abonos)", 8);
  const finCondonadas = tablaSimple(
    cxcHoja,
    filaCxc + 1,
    ["ID", "Hora", "Cliente", "Teléfono", "Concepto", "Original", "Abonado", "Condonado", "Hizo la condonación"],
    datos.filasCondonaciones.map((c) => [
      c.id,
      formatoHora(c.hora),
      c.cliente,
      c.telefono,
      c.concepto,
      c.valorOriginal,
      c.abonado,
      c.condonado,
      c.condonadoPor,
    ]),
    {
      colDinero: [6, 7, 8],
      total: [
        "Total",
        "",
        "",
        "",
        "",
        datos.filasCondonaciones.reduce((s, c) => s + c.valorOriginal, 0),
        datos.filasCondonaciones.reduce((s, c) => s + c.abonado, 0),
        datos.cxcCondonadoValorHoy,
        "",
      ],
    },
  );

  filaCxc = finCondonadas + 2;
  notaHoja(cxcHoja, filaCxc, "Deuda pendiente AL MOMENTO de este reporte", 8);
  tablaSimple(
    cxcHoja,
    filaCxc + 1,
    ["ID", "Fecha deuda", "Cliente", "Teléfono", "Concepto", "Valor", "Abonado", "Saldo"],
    datos.cuentasPendientesLista.map((c) => [
      c.id,
      c.fecha,
      c.cliente,
      c.telefono,
      c.concepto,
      c.valor,
      c.abonado,
      c.saldo,
    ]),
    {
      colDinero: [6, 7, 8],
      total: [
        "Total",
        "",
        "",
        "",
        "",
        datos.cuentasPendientesLista.reduce((s, c) => s + c.valor, 0),
        datos.cuentasPendientesLista.reduce((s, c) => s + c.abonado, 0),
        datos.cxcPendienteTotal,
      ],
    },
  );

  // ════ Hoja 7 · Pagos y abonos ════
  const abonosHoja = libro.addWorksheet("Pagos y abonos", {
    views: [{ showGridLines: false }],
  });
  abonosHoja.columns = [
    { width: 8 },
    { width: 13 },
    { width: 22 },
    { width: 12 },
    { width: 30 },
    { width: 14 },
    { width: 14 },
    { width: 26 },
  ];
  tituloHoja(abonosHoja, "El Buen Gusto · Pagos y abonos del día", 8, diaLegible, generado);

  filaResumen(abonosHoja, 5, "Total recibido por deudas HOY", datos.abonosTotal, {
    dinero: true,
    fuerte: true,
  });
  filaResumen(abonosHoja, 6, "Cantidad de abonos", datos.numeroAbonos);
  notaHoja(abonosHoja, 7, "Dinero que ENTRÓ de verdad hoy por fiados anteriores: se reporta aparte de las ventas.", 8);

  let filaAbonos = 9;
  notaHoja(abonosHoja, filaAbonos, "Abonos del día", 8);
  const finAbonos = tablaSimple(
    abonosHoja,
    filaAbonos + 1,
    ["ID", "Hora", "Cliente", "Método", "Concepto de la deuda", "Monto", "Cuenta", "Registró"],
    datos.filasAbonos.map((a) => [
      a.id,
      formatoHora(a.hora),
      a.cliente,
      a.metodoLabel,
      a.concepto,
      a.monto,
      `#${a.cuentaId}`,
      a.usuario,
    ]),
    {
      colDinero: [6],
      total: [
        "Total",
        "",
        "",
        "",
        "",
        datos.abonosTotal,
        "",
        "",
      ],
    },
  );

  // Condonaciones del día: se listan aparte (NO son dinero recibido ni
  // filas de abono). Van después de los abonos y antes del contraste.
  filaAbonos = finAbonos + 2;
  notaHoja(abonosHoja, filaAbonos, "Condonaciones del día (perdón del saldo restante: no es ingreso)", 8);
  const finCondonaciones = tablaSimple(
    abonosHoja,
    filaAbonos + 1,
    ["ID", "Hora", "Cliente", "Concepto de la deuda", "Abonado antes", "Condonado", "Motivo", "Hizo la condonación"],
    datos.filasCondonaciones.map((c) => [
      c.id,
      formatoHora(c.hora),
      c.cliente,
      c.concepto,
      c.abonado,
      c.condonado,
      c.motivo ?? "—",
      c.condonadoPor,
    ]),
    {
      colDinero: [5, 6],
      total: [
        "Total",
        "",
        "",
        "",
        datos.filasCondonaciones.reduce((s, c) => s + c.abonado, 0),
        datos.cxcCondonadoValorHoy,
        "",
        "",
      ],
    },
  );

  filaAbonos = finCondonaciones + 2;
  notaHoja(abonosHoja, filaAbonos, "Pagos de caja del día (ventas), para contraste", 8);
  tablaSimple(
    abonosHoja,
    filaAbonos + 1,
    ["Hora", "Método", "Total", "Propina"],
    datos.pagosHoy.map((p) => [
      formatoHora(p.createdAt),
      ETIQUETA_METODO[p.metodo] ?? p.metodo,
      p.total,
      p.propina,
    ]),
    {
      colDinero: [3, 4],
      total: ["Total", "", datos.totalPagos, datos.propinasHoy],
    },
  );

  // ════ Hoja 8 · Apartados ════
  const apartadosHoja = libro.addWorksheet("Apartados", {
    views: [{ showGridLines: false }],
  });
  apartadosHoja.columns = [
    { width: 8 },
    { width: 13 },
    { width: 22 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
  ];
  tituloHoja(apartadosHoja, "El Buen Gusto · Apartados del día", 9, diaLegible, generado);

  filaResumen(apartadosHoja, 5, "Apartados creados HOY", datos.apartadosCreados);
  filaResumen(apartadosHoja, 6, "Entregados HOY", datos.apartadosEntregados);
  notaHoja(apartadosHoja, 7, "El total queda congelado al apartar; al entregar sale la comanda y el pago entra a caja como venta normal (o fiado → deuda).", 9);

  tablaSimple(
    apartadosHoja,
    9,
    ["ID", "Hora aparto", "Cliente", "Estado", "Entrega (fecha/hora)", "Total", "Comanda", "Fiado", "Registró"],
    datos.filasApartados.map((a) => [
      a.id,
      formatoHora(a.hora),
      a.cliente,
      a.estadoLabel,
      a.fechaEntrega
        ? `${a.fechaEntrega}${a.horaEntrega ? ` · ${a.horaEntrega}` : ""}`
        : (a.horaEntrega ?? "—"),
      a.total,
      a.pedidoId ? `#${a.pedidoId}` : "Sin entregar",
      a.fiado === true ? "Sí (deuda)" : "No",
      a.usuario,
    ]),
    {
      colDinero: [6],
      total: [
        "Total",
        "",
        "",
        "",
        "",
        datos.filasApartados.reduce((s, a) => s + a.total, 0),
        "",
        "",
        "",
      ],
    },
  );

  // ════ Hoja 9 · Domicilios (solo si hay) ════
  if (datos.domiciliosHoy.length > 0) {
    const domHoja = libro.addWorksheet("Domicilios", {
      views: [{ showGridLines: false }],
    });
    domHoja.columns = [
      { width: 8 },
      { width: 13 },
      { width: 20 },
      { width: 14 },
      { width: 16 },
      { width: 26 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];
    tituloHoja(domHoja, "El Buen Gusto · Domicilios", 10, diaLegible, generado);

    filaResumen(domHoja, 5, "Domicilios creados", datos.domiciliosHoy.length);
    filaResumen(domHoja, 6, "Cobrados (pago registrado)", datos.domCobrados.length);
    filaResumen(domHoja, 7, "Pendientes de cobro", datos.domEnCurso.length);
    filaResumen(domHoja, 8, "Cancelados", datos.domFallidos.length);
    filaResumen(domHoja, 9, "Recaudo de los cobrados", datos.recaudoDomicilios, {
      dinero: true,
      fuerte: true,
    });

    let fina = 11;
    notaHoja(domHoja, fina, "Detalle de cada domicilio", 10);
    tablaSimple(
      domHoja,
      fina + 1,
      ["ID", "Hora", "Cliente", "Teléfono", "Barrio", "Dirección", "Hora entrega", "Estado", "Cobrado", "Método"],
      datos.filasDomicilios.map((d) => [
        d.id,
        formatoHora(d.hora),
        d.cliente,
        d.telefono,
        d.barrio,
        d.direccion,
        d.horaEntrega,
        d.estadoLabel,
        d.cobradoMonto ?? null,
        d.cobradoMetodo
          ? ETIQUETA_METODO[d.cobradoMetodo] ?? d.cobradoMetodo
          : "Sin cobrar",
      ]),
      { colDinero: [9] },
    );
  }

  // ════ Hoja 10 · Cierre de caja (solo si existe para el día) ════
  const cierre = datos.cierreHoy;
  if (cierre) {
    const cierreHoja = libro.addWorksheet("Cierre de caja", {
      views: [{ showGridLines: false }],
    });
    cierreHoja.columns = [{ width: 40 }, { width: 18 }, { width: 24 }, { width: 20 }];
    tituloHoja(
      cierreHoja,
      "El Buen Gusto · Cierre de caja",
      4,
      diaLegible,
      generado,
    );

    filaResumen(cierreHoja, 5, "Fecha", cierre.fecha);
    filaResumen(cierreHoja, 6, "Cerrado por", cierre.cerradoPor.nombre);
    filaResumen(cierreHoja, 7, "Momento del cierre", formatoHora(cierre.createdAt));
    filaResumen(cierreHoja, 9, "Efectivo (ventas)", cierre.totalEfectivo, { dinero: true });
    filaResumen(cierreHoja, 10, "Tarjeta", cierre.totalTarjeta, { dinero: true });
    filaResumen(cierreHoja, 11, "Transferencia", cierre.totalTransfer, { dinero: true });
    filaResumen(cierreHoja, 12, "Propinas", cierre.totalPropinas, { dinero: true });
    filaResumen(cierreHoja, 13, "Recaudo de domicilios", cierre.totalDomicilios, { dinero: true });
    filaResumen(cierreHoja, 14, "Total en pagos (sin propinas)", cierre.totalPagos, {
      dinero: true,
      fuerte: true,
    });
    filaResumen(cierreHoja, 15, "Cantidad de pagos", cierre.numeroPagos);
    filaResumen(cierreHoja, 16, "Comandas servidas/cobradas", cierre.numeroComandas);

    if (cierre.abonosTotal !== null) {
      filaResumen(cierreHoja, 18, "Abonos de deudas recibidos", cierre.abonosTotal, { dinero: true, fuerte: true });
      filaResumen(cierreHoja, 19, "Cantidad de abonos", cierre.numeroAbonos ?? 0);
      filaResumen(cierreHoja, 20, "Gastos desde caja", cierre.totalGastosCaja ?? 0, { dinero: true });
      filaResumen(cierreHoja, 21, "…en efectivo de caja", cierre.gastosCajaEfectivo ?? 0, { dinero: true });
      filaResumen(cierreHoja, 22, "Gastos con dinero externo", cierre.totalGastosExternos ?? 0, { dinero: true });
      filaResumen(cierreHoja, 23, "Fiados creados hoy", cierre.cxcCreadasCantidad ?? 0);
      filaResumen(cierreHoja, 24, "Valor fiado hoy", cierre.cxcCreadasValor ?? 0, { dinero: true });
      filaResumen(cierreHoja, 25, "Deuda por cobrar al cierre (saldo real)", cierre.cxcTotalPendiente ?? 0, { dinero: true, fuerte: true });
      filaResumen(
        cierreHoja,
        26,
        `Condonadas hoy${(cierre.cxcCondonadasCantidad ?? 0) > 0 ? ` (${cierre.cxcCondonadasCantidad})` : ""}`,
        cierre.cxcCondonadasValor ?? 0,
        { dinero: true, advertencia: true },
      );
      filaResumen(
        cierreHoja,
        27,
        "Efectivo disponible al cierre",
        Math.max(
          0,
          cierre.totalEfectivo + cierre.totalPropinas + (cierre.abonosEfectivo ?? 0) - (cierre.gastosCajaEfectivo ?? 0),
        ),
        { dinero: true, fuerte: true },
      );
      filaResumen(
        cierreHoja,
        28,
        "Domicilios / apartados del día",
        `${cierre.numeroDomicilios ?? 0} / ${cierre.numeroApartados ?? 0} (${cierre.numeroApartadosEntrega ?? 0} apartados entregados)`,
      );
    }

    if (cierre.efectivoContado !== null) {
      filaResumen(cierreHoja, 29, "Efectivo contado en caja", cierre.efectivoContado, { dinero: true });
      filaResumen(
        cierreHoja,
        30,
        "Diferencia (contado − debería haber en caja)",
        cierre.efectivoContado - (cierre.totalEfectivo - cierre.totalPropinas),
        { dinero: true },
      );
    }
  }

  return libro.xlsx.writeBuffer();
}
