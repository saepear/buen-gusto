import { NextResponse } from "next/server";
import { getSesion } from "@/lib/session";
import { datosReporteNomina } from "../datos-reporte";
import { construirLibroExcelNomina } from "../exportar-excel";

/**
 * GET /admin/nomina/reportes/exportar?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *                      [&empleadoId=ID]
 *
 * Descarga el reporte de nómina del rango (solo ADMIN) con la MISMA consulta
 * de la página (datos-reporte.ts: pantalla y archivo nunca discrepan).
 * JSON 401/403 si no hay sesión o no es admin (no hay a dónde redirigir).
 */
export async function GET(request: Request): Promise<Response> {
  const sesion = await getSesion();
  if (!sesion) {
    return NextResponse.json(
      { ok: false, error: "Inicia sesión para descargar el reporte." },
      { status: 401 },
    );
  }
  if (sesion.rol !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "Solo el administrador puede exportar reportes de nómina." },
      { status: 403 },
    );
  }

  const params = new URL(request.url).searchParams;
  const ahora = new Date();
  const defDesde = `${ahora.getFullYear()}-01-01`;
  const defHasta = `${ahora.getFullYear()}-12-31`;
  const desdeParam = params.get("desde") ?? defDesde;
  const hastaParam = params.get("hasta") ?? defHasta;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeParam) || !/^\d{4}-\d{2}-\d{2}$/.test(hastaParam)) {
    return NextResponse.json(
      { ok: false, error: "Fechas inválidas: usa el formato YYYY-MM-DD." },
      { status: 400 },
    );
  }
  const empleadoIdParam = params.get("empleadoId");
  const empleadoId =
    empleadoIdParam && /^\d+$/.test(empleadoIdParam)
      ? Number.parseInt(empleadoIdParam, 10)
      : null;

  const datos = await datosReporteNomina(desdeParam, hastaParam, empleadoId);
  const buffer = await construirLibroExcelNomina({
    desde: desdeParam,
    hasta: hastaParam,
    ...datos,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Nomina_El_Buen_Gusto_${desdeParam}_${hastaParam}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
