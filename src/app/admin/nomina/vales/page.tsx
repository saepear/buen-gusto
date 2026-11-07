import Link from "next/link";
import { Ticket } from "lucide-react";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { formatCOP } from "@/lib/format";
import { fechaColombia } from "@/lib/nomina/resumen";
import { EncabezadoPagina } from "@/components/encabezado";
import { NavegacionNomina } from "../navegacion";
import { FormularioRegistroVale } from "./formularios";
import { AccionesVale } from "./formularios-acciones";

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
  const campo =
    "w-full rounded-xl bg-campo-app p-2.5 text-sm text-texto-app ring-1 ring-borde-app";
  return (
    <>
      <EncabezadoPagina
        titulo="Vales y consumos"
        subtitulo="Productos entregados a cuenta del sueldo, con precio histórico y autorización"
      />
      <NavegacionNomina actual="/admin/nomina/vales" />
      <div className="mb-6">
        <FormularioRegistroVale
          empleados={empleados
            .filter((e) => e.estado === "ACTIVO")
            .map((e) => ({ id: e.id, nombre: `${e.nombre} ${e.apellidos}` }))}
          productos={productos}
          ciclos={ciclos.map((c) => ({
            id: c.id,
            etiqueta: `${c.fechaDesde} → ${c.fechaHasta}`,
          }))}
          hoy={fechaColombia(new Date())}
          empleadoInicial={empleadoId}
          cicloInicial={cicloId}
        />
      </div>
      <form className="mb-6 grid items-end gap-3 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-texto-muted">
          Empleado
          <select
            name="empleadoId"
            className={campo}
            defaultValue={empleadoId ?? ""}
          >
            <option value="">Todos</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} {e.apellidos}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-texto-muted">
          Ciclo
          <select name="cicloId" className={campo} defaultValue={cicloId ?? ""}>
            <option value="">Todos</option>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fechaDesde} → {c.fechaHasta}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-texto-muted">
          Desde
          <input
            className={campo}
            type="date"
            name="desde"
            defaultValue={desde}
          />
        </label>
        <label className="text-xs text-texto-muted">
          Hasta
          <input
            className={campo}
            type="date"
            name="hasta"
            defaultValue={hasta}
          />
        </label>
        <button className="rounded-xl bg-amber-brand px-4 py-2.5 text-sm font-bold text-brown-950">
          Consultar
        </button>
      </form>
      <div className="mb-5 flex flex-wrap gap-4 text-sm text-texto-muted">
        <p>
          Por autorizar{" "}
          <strong className="text-texto-app">
            {formatCOP(
              vales
                .filter((v) => v.estado === "PENDIENTE")
                .reduce((s, v) => s + v.total, 0),
            )}
          </strong>
        </p>
        <p>
          Autorizados por descontar{" "}
          <strong className="text-amber-brand">
            {formatCOP(
              vales
                .filter((v) => v.estado === "AUTORIZADO")
                .reduce((s, v) => s + v.total, 0),
            )}
          </strong>
        </p>
        <p>
          Mostrando {vales.length}
          {vales.length === 200 ? " más recientes" : " registros"}
        </p>
      </div>
      <div className="space-y-3">
        {vales.map((v) => (
          <article
            key={v.id}
            className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/admin/nomina/empleados/${v.empleadoId}`}
                  className="font-bold text-texto-app"
                >
                  {v.empleado.nombre} {v.empleado.apellidos}
                </Link>
                <h2 className="mt-1 flex items-center gap-2 font-display text-lg">
                  <Ticket className="h-4 w-4 text-amber-brand" />
                  {v.productoNombre}
                </h2>
                <p className="mt-1 text-xs text-texto-muted">
                  {v.cantidad} × {formatCOP(v.precioUnitario)} · {v.fecha} ·{" "}
                  {v.ciclo
                    ? `${v.ciclo.fechaDesde} → ${v.ciclo.fechaHasta}`
                    : "Sin ciclo asignado"}
                </p>
              </div>
              <div className="text-right">
                <strong className="font-display text-xl text-amber-brand">
                  {formatCOP(v.total)}
                </strong>
                <p className="text-xs text-texto-muted">
                  {
                    (
                      {
                        PENDIENTE: "Por autorizar",
                        AUTORIZADO: "Autorizado",
                        DESCONTADO: "Incluido en pago",
                        ANULADO: "Anulado",
                      } as Record<string, string>
                    )[v.estado]
                  }
                </p>
              </div>
            </div>
            {v.autorizadoPor && (
              <p className="mt-2 text-xs text-texto-muted">
                Aprobó: {v.autorizadoPor.nombre}
              </p>
            )}
            {v.observaciones && (
              <p className="mt-2 whitespace-pre-wrap text-xs text-texto-muted">
                {v.observaciones}
              </p>
            )}
            {v.anuladoMotivo && (
              <p className="mt-2 text-xs text-danger-text">
                Motivo: {v.anuladoMotivo}
              </p>
            )}
            {v.liquidacionId ? (
              <Link
                className="mt-3 inline-block text-xs font-bold text-amber-brand"
                href={`/admin/nomina/pagos/${v.liquidacionId}`}
              >
                Consultar liquidación →
              </Link>
            ) : (
              <AccionesVale valeId={v.id} estado={v.estado} />
            )}
          </article>
        ))}
      </div>
      {!vales.length && (
        <p className="rounded-2xl border border-dashed border-borde-app p-10 text-center text-sm text-texto-muted">
          No hay vales con estos filtros. Puedes registrar el primer consumo
          arriba.
        </p>
      )}
      <p className="mt-5 text-xs text-texto-muted">
        Registrar un vale no crea un pago ni un gasto de caja. Las compras
        normales de clientes no se convierten automáticamente en vales.
      </p>
    </>
  );
}
