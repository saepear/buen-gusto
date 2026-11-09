import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { ciclosDeMes } from "@/lib/nomina/helpers";
import { PanelNomina } from "./panel-nomina";
import { seleccionPago, serializarPago } from "./pagos/datos-pago";
import { fechaColombia, resumenEmpleado } from "@/lib/nomina/resumen";

export const metadata = { title: "Nómina · El Buen Gusto" };

export default async function PaginaNomina({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    corte?: string;
    periodo?: string;
    empleado?: string;
  }>;
}) {
  await requerirRol("ADMIN");
  const params = await searchParams;
  const hoy = fechaColombia(new Date());
  const mes =
    typeof params.mes === "string" &&
    /^20\d{2}-(0[1-9]|1[0-2])$/.test(params.mes)
      ? params.mes
      : hoy.slice(0, 7);
  const [anio, numeroMes] = mes.split("-").map(Number);
  const cortes = ciclosDeMes(anio, numeroMes);
  const dia = Number(hoy.slice(8));
  const corte = /^[1-4]$/.test(params.corte ?? "")
    ? Number(params.corte) - 1
    : mes === hoy.slice(0, 7)
      ? Math.min(Math.floor((dia - 1) / 7), 3)
      : 0;
  const periodos = await db.periodoNomina.findMany({
    where: {
      fechaDesde: { lte: `${mes}-31` },
      fechaHasta: { gte: `${mes}-01` },
    },
    orderBy: { fechaDesde: "asc" },
  });
  const periodo =
    periodos.find((p) => String(p.id) === params.periodo) ??
    periodos.find(
      (p) =>
        p.fechaDesde === cortes[corte].desde &&
        p.fechaHasta === cortes[corte].hasta,
    );
  const rango = periodo
    ? { desde: periodo.fechaDesde, hasta: periodo.fechaHasta }
    : cortes[corte];
  const [
    empleados,
    productos,
    liquidaciones,
    vales,
    parametrosPendientes,
    parametrosTotal,
  ] = await Promise.all([
    db.empleado.findMany({
      orderBy: [{ estado: "asc" }, { nombre: "asc" }],
      select: {
        id: true,
        nombre: true,
        apellidos: true,
        cargo: true,
        estado: true,
        documentoTipo: true,
        documentoNumero: true,
        fechaIngreso: true,
        remuneracion: true,
        salarioMensual: true,
        salarioDiario: true,
        valorHora: true,
        diaDescanso: true,
        metodoPago: true,
      },
    }),
    db.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, precio: true },
    }),
    periodo
      ? db.liquidacionNomina.findMany({
          where: { periodoId: periodo.id },
          select: seleccionPago,
        })
      : Promise.resolve([]),
    db.valeNomina.findMany({
      where: {
        OR: [
          ...(periodo ? [{ cicloId: periodo.id }] : []),
          { cicloId: null, fecha: { gte: rango.desde, lte: rango.hasta } },
        ],
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      select: {
        id: true,
        empleadoId: true,
        productoNombre: true,
        cantidad: true,
        precioUnitario: true,
        total: true,
        fecha: true,
        estado: true,
        liquidacionId: true,
      },
    }),
    db.parametroLaboral.count({ where: { pendienteVerificar: true } }),
    db.parametroLaboral.count(),
  ]);
  return (
    <PanelNomina
      key={`${rango.desde}-${rango.hasta}`}
      datos={{
        hoy,
        mes,
        corte,
        rango,
        cortes: cortes.map((r) => ({
          ...r,
          periodoId:
            periodos.find(
              (p) => p.fechaDesde === r.desde && p.fechaHasta === r.hasta,
            )?.id ?? null,
        })),
        periodo: periodo
          ? {
              id: periodo.id,
              tipo: periodo.tipo,
              estado: periodo.estado,
              fechaPago: periodo.fechaPagoPrevista ?? periodo.fechaHasta,
            }
          : null,
        periodos: periodos.map((p) => ({
          id: p.id,
          desde: p.fechaDesde,
          hasta: p.fechaHasta,
        })),
        productos,
        empleados: empleados.map((e) => ({
          ...e,
          fechaIngreso: e.fechaIngreso.toISOString(),
          liquidacion: (() => { const pago = liquidaciones.find((l) => l.empleadoId === e.id); return pago ? serializarPago(pago) : null; })(),
          vales: vales.filter((v) => v.empleadoId === e.id),
          ...resumenEmpleado(
            liquidaciones.find((l) => l.empleadoId === e.id) ?? null,
            vales.filter((v) => v.empleadoId === e.id),
          ),
        })),
        parametrosPendientes,
        parametrosTotal,
        empleadoInicial: Number(params.empleado) || null,
      }}
    />
  );
}
