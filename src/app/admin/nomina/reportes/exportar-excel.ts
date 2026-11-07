// ═════════ Excel del reporte de Nómina (exceljs) ═════════
// Consume EXACTAMENTE los datos de `datos-reporte.ts` (misma consulta que
// la pantalla). Dinero numFmt COP '"$"#,##0', igual que el resto del POS.
import ExcelJS from "exceljs";
import type { DatosReporteNomina } from "./datos-reporte";

const NUM_COP = '"$"#,##0';

type Datos = DatosReporteNomina & { desde: string; hasta: string };

function estiloEncabezado(
  hoja: ExcelJS.Worksheet,
  fila: number,
  columnas: number,
): void {
  const filaActual = hoja.getRow(fila);
  filaActual.font = { bold: true };
  filaActual.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE7A3" },
  };
  for (let i = 1; i <= columnas; i++) {
    hoja.getColumn(i).alignment = { vertical: "top" };
  }
}

export async function construirLibroExcelNomina(datos: Datos): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "POS El Buen Gusto";
  libro.created = new Date();

  // ── Hoja 1: resumen por empleado ──
  const hoja1 = libro.addWorksheet("Nómina por empleado");
  hoja1.columns = [
    { header: "Empleado", key: "nombre", width: 32 },
    { header: "Devengado", key: "devengado", width: 15, style: { numFmt: NUM_COP } },
    { header: "Extras y recargos", key: "extras", width: 18, style: { numFmt: NUM_COP } },
    { header: "Deducciones", key: "deducciones", width: 15, style: { numFmt: NUM_COP } },
    { header: "Neto", key: "neto", width: 15, style: { numFmt: NUM_COP } },
    { header: "Pagado", key: "pagado", width: 15, style: { numFmt: NUM_COP } },
    { header: "Pendiente", key: "pendiente", width: 15, style: { numFmt: NUM_COP } },
    { header: "Aportes empleador", key: "aportes", width: 18, style: { numFmt: NUM_COP } },
    { header: "Prestaciones", key: "prestaciones", width: 17, style: { numFmt: NUM_COP } },
  ];
  estiloEncabezado(hoja1, 1, 9);
  for (const f of datos.porEmpleado) {
    hoja1.addRow({
      nombre: f.nombre,
      devengado: f.totalDevengado,
      extras: f.horasExtras,
      deducciones: f.deducciones,
      neto: f.neto,
      pagado: f.pagado,
      pendiente: f.pendiente,
      aportes: f.aportesEmpleador,
      prestaciones: f.prestaciones,
    });
  }
  const total1 = hoja1.addRow({
    nombre: "TOTAL",
    devengado: datos.resumen.totalDevengado,
    deducciones: datos.resumen.totalDeducciones,
    neto: 0,
    pagado: datos.resumen.totalPagado,
    pendiente: datos.resumen.totalPendiente,
    aportes: datos.resumen.totalAportes,
    prestaciones: datos.resumen.totalPrestaciones,
  });
  total1.font = { bold: true };

  // ── Hoja 2: pagos ──
  const hoja2 = libro.addWorksheet("Pagos");
  hoja2.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Empleado", key: "empleado", width: 32 },
    { header: "Método", key: "metodo", width: 14 },
    { header: "Referencia", key: "referencia", width: 26 },
    { header: "Monto", key: "monto", width: 15, style: { numFmt: NUM_COP } },
    { header: "Egreso de caja", key: "gasto", width: 15 },
  ];
  estiloEncabezado(hoja2, 1, 6);
  for (const p of datos.pagos) {
    hoja2.addRow({
      fecha: p.fecha,
      empleado: p.empleado,
      metodo: p.metodo,
      referencia: p.referencia ?? "",
      monto: p.monto,
      gasto: p.gastoId != null ? `#${p.gastoId}` : "—",
    });
  }

  // ── Hoja 3: aportes del empleador y prestaciones (totales del rango) ──
  const hoja3 = libro.addWorksheet("Aportes y prestaciones");
  hoja3.columns = [
    { header: "Concepto", key: "concepto", width: 34 },
    { header: "Valor", key: "valor", width: 17, style: { numFmt: NUM_COP } },
  ];
  estiloEncabezado(hoja3, 1, 2);
  hoja3.addRows([
    { concepto: "Aportes del empleador (costo del empleador)", valor: datos.resumen.totalAportes },
    {
      concepto: "Prestaciones causadas (prima, cesantías, intereses, vacaciones)",
      valor: datos.resumen.totalPrestaciones,
    },
  ]);
  hoja3.getCell("A2").note = {
    texts: [
      {
        font: { size: 10 },
        text: `Rango: ${datos.desde} → ${datos.hasta}. Fuente: liquidaciones del período (fotos congeladas).`,
      },
    ],
  };

  const buffer = await libro.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
