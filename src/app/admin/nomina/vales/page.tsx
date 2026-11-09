import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { fechaColombia } from "@/lib/nomina/resumen";
import { PanelVales } from "./panel-vales";

export const metadata = { title: "Vales y consumos · El Buen Gusto" };
export default async function PaginaVales({
  searchParams,
}: {
  searchParams: Promise<{
    empleadoId?: string;
    cicloId?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  await requerirRol("ADMIN");
  const q = await searchParams;
  const empleadoId = /^\d+$/.test(q.empleadoId ?? "")
    ? Number(q.empleadoId)
    : undefined;
  const cicloId = /^\d+$/.test(q.cicloId ?? "") ? Number(q.cicloId) : undefined;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(q.desde ?? "") ? q.desde : undefined;
  const hasta = /^\d{4}-\d{2}-\d{2}$/.test(q.hasta ?? "") ? q.hasta : undefined;
  const [empleados, productos, ciclos, vales] = await Promise.all([
    db.empleado.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, apellidos: true, estado: true },
    }),
    db.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, precio: true },
    }),
    db.periodoNomina.findMany({
      where: { estado: "ABIERTO" },
      orderBy: { fechaDesde: "desc" },
    }),
    db.valeNomina.findMany({
      where: {
        ...(empleadoId ? { empleadoId } : {}),
        ...(cicloId
          ? {
              OR: [
                { cicloId },
                {
                  cicloId: null,
                  fecha: {
                    ...(desde ? { gte: desde } : {}),
                    ...(hasta ? { lte: hasta } : {}),
                  },
                },
              ],
            }
          : desde || hasta
            ? {
                fecha: {
                  ...(desde ? { gte: desde } : {}),
                  ...(hasta ? { lte: hasta } : {}),
                },
              }
            : {}),
      },
      include: {
        empleado: true,
        autorizadoPor: { select: { nombre: true } },
        ciclo: true,
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 200,
    }),
  ]);
  return <PanelVales formulario={{
    empleados: empleados.filter(e => e.estado === "ACTIVO").map(e => ({ id:e.id, nombre:`${e.nombre} ${e.apellidos}` })),
    productos,
    ciclos: ciclos.map(c => ({ id:c.id, etiqueta:`${c.fechaDesde} → ${c.fechaHasta}` })),
    hoy: fechaColombia(new Date()),
    empleadoInicial: empleadoId,
  }} vales={vales.map(v => ({
    id:v.id, empleado:`${v.empleado.nombre} ${v.empleado.apellidos}`, empleadoId:v.empleadoId,
    productoNombre:v.productoNombre, cantidad:v.cantidad, precioUnitario:v.precioUnitario, total:v.total,
    fecha:v.fecha, estado:v.estado, observaciones:v.observaciones, anuladoMotivo:v.anuladoMotivo,
    autorizadoPor:v.autorizadoPor?.nombre ?? null,
    ciclo:v.ciclo ? `${v.ciclo.fechaDesde} → ${v.ciclo.fechaHasta}` : "Según fecha de entrega",
  }))} />;
}
