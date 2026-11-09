import { requerirRol } from "@/lib/session";
import { db } from "@/lib/db";
import { fechaColombia, fechaNominaValida } from "@/lib/nomina/resumen";
import { datosReporteNomina } from "./datos-reporte";
import { PanelReportesNomina } from "./panel-reportes";

export const metadata = { title: "Reportes de nómina · El Buen Gusto" };

export default async function PaginaReportesNomina(props: PageProps<"/admin/nomina/reportes">) {
  await requerirRol("ADMIN");
  const params = await props.searchParams;
  const anio = fechaColombia(new Date()).slice(0, 4);
  const desde = typeof params.desde === "string" && fechaNominaValida(params.desde) ? params.desde : `${anio}-01-01`;
  const hasta = typeof params.hasta === "string" && fechaNominaValida(params.hasta) ? params.hasta : `${anio}-12-31`;
  const empleadoId = typeof params.empleadoId === "string" && /^\d+$/.test(params.empleadoId) ? Number(params.empleadoId) : null;
  const [datos, empleados] = await Promise.all([
    datosReporteNomina(desde, hasta, empleadoId),
    db.empleado.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true, apellidos: true } }),
  ]);
  return <PanelReportesNomina datos={datos} empleados={empleados} desde={desde} hasta={hasta} empleadoId={empleadoId} />;
}
