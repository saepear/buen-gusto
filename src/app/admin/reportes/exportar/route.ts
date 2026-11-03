import { NextResponse } from "next/server";
import { claveDia } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import { getSesion } from "@/lib/session";
import { datosReporte } from "../datos-reporte";
import { construirLibroExcel } from "../exportar-excel";

/**
 * GET /admin/reportes/exportar?fecha=YYYY-MM-DD
 *
 * Descarga el reporte del día en formato .xlsx (solo ADMIN). Responde con
 * JSON 401/403 si no hay sesión o el rol no es admin: dentro de una
 * descarga no hay a dónde redirigir. Por defecto exporta HOY, igual que
 * la página; con `?fecha=` exporta ese día EXACTO — el mismo que llega
 * desde el selector de la página, así pantalla y archivo nunca discrepan.
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
      { ok: false, error: "Solo el administrador puede exportar reportes." },
      { status: 403 },
    );
  }

  // Fecha pedida: hoy por defecto; solo se acepta la forma YYYY-MM-DD
  const fechaParam =
    new URL(request.url).searchParams.get("fecha") ?? claveDia(new Date());
  let fechaFila = inicioDeHoy();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
    const [y, m, d] = fechaParam.split("-").map(Number);
    fechaFila = new Date(y, m - 1, d);
  }

  const datos = await datosReporte(fechaFila);
  const buffer = await construirLibroExcel(datos);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Reporte_El_Buen_Gusto_${datos.claveDiaReporte}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
