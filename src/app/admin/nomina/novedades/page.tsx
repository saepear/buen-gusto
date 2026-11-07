// ═════════ Nómina · Novedades ═════════
// Comisiones, bonos, ausencias, incapacidades, permisos, vacaciones,
// descuentos. Solo las APROBADAS entran a una liquidación y quedan marcadas
// (liquidacionId) para jamás contarse dos veces.
import { ClipboardPen } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";
import { FormularioNovedad } from "./formularios";
import { ESTADO_NOVEDAD, TIPO_NOVEDAD_LABEL } from "./constantes";
import {
  AccionAprobarNovedad,
  AccionRechazarNovedad,
} from "./formularios-acciones";

export const metadata = { title: "Novedades · Nómina · El Buen Gusto" };

const ESTADO_CLASE: Record<string, string> = {
  PENDIENTE: "bg-warning/10 text-warning-text ring-warning/20",
  APROBADA: "bg-success/10 text-success-text ring-success/20",
  RECHAZADA: "bg-danger/10 text-danger-text ring-danger/20",
};

function AprobacionNovedad({ id, estado }: { id: number; estado: string }) {
  if (estado !== ESTADO_NOVEDAD.PENDIENTE) return null;
  return (
    <div className="flex gap-1.5">
      <AccionAprobarNovedad novedadId={id} />
      <AccionRechazarNovedad novedadId={id} />
    </div>
  );
}

export default async function PaginaNovedades(
  props: PageProps<"/admin/nomina/novedades">,
) {
  await requerirRol("ADMIN");
  const { estado } = await props.searchParams;
  const filtroEstado =
    estado === "PENDIENTE" || estado === "APROBADA" || estado === "RECHAZADA"
      ? estado
      : "PENDIENTE";

  const [novedades, empleados] = await Promise.all([
    db.novedadNomina.findMany({
      where: { estado: filtroEstado },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: 120,
      include: { empleado: true, aprobadoPor: true },
    }),
    db.empleado.findMany({
      where: { estado: "ACTIVO" },
      orderBy: { apellidos: "asc" },
      select: { id: true, nombre: true, apellidos: true },
    }),
  ]);

  return (
    <>
      <EncabezadoPagina
        titulo="Novedades de nómina"
        subtitulo="Lo que modifica una liquidación: se aprueba para entrar y jamás se cuenta dos veces"
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/novedades" />
      </div>

      <div className="mb-6">
        <FormularioNovedad
          empleados={empleados.map((e) => ({ id: e.id, nombre: `${e.nombre} ${e.apellidos}` }))}
        />
      </div>

      {/* Filtro de estado */}
      <div className="mb-6 flex flex-wrap gap-2">
        {["PENDIENTE", "APROBADA", "RECHAZADA"].map((s) => (
          <a
            key={s}
            href={`/admin/nomina/novedades?estado=${s}`}
            aria-current={s === filtroEstado ? "page" : undefined}
            className={
              "rounded-xl px-3.5 py-2 text-sm font-bold ring-1 transition " +
              (s === filtroEstado
                ? "bg-amber-brand text-brown-950 ring-amber-brand"
                : "bg-panel-app text-texto-app ring-borde-app hover:bg-panel-hover")
            }
          >
            {s === "PENDIENTE" ? "Pendientes" : s === "APROBADA" ? "Aprobadas" : "Rechazadas"}
          </a>
        ))}
      </div>

      {novedades.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <ClipboardPen className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">
            Sin novedades {filtroEstado.toLowerCase()}s
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {novedades.map((n) => (
            <article key={n.id} className="rounded-2xl bg-panel-app p-3.5 ring-1 ring-borde-app">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-texto-app">
                    {n.empleado.nombre} {n.empleado.apellidos} ·{" "}
                    <span className="text-texto-muted/70">{TIPO_NOVEDAD_LABEL[n.tipo] ?? n.tipo}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-texto-muted/65">{n.descripcion}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-texto-muted/55">
                    <span className={`rounded-full px-2 py-0.5 font-bold ring-1 ${ESTADO_CLASE[n.estado ?? "PENDIENTE"]}`}>
                      {n.estado}
                    </span>
                    <span>{n.fecha}</span>
                    {n.dias != null ? <span>{n.dias} días</span> : null}
                    {n.liquidacionId ? (
                      <span className="font-bold text-info-text">
                        contada en liquidación #{n.liquidacionId}
                      </span>
                    ) : null}
                  </p>
                  {n.estado === "RECHAZADA" && n.rechazoMotivo ? (
                    <p className="mt-1 text-[11px] italic text-danger-text">Motivo: «{n.rechazoMotivo}»</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {n.valor != null ? (
                    <strong className={"font-display text-lg " + (n.tipo === "DESCUENTO" ? "text-danger-text" : "text-success-text")}>
                      {n.tipo === "DESCUENTO" ? "−" : ""}
                      {formatCOP(n.valor)}
                    </strong>
                  ) : null}
                  <AprobacionNovedad id={n.id} estado={n.estado ?? ESTADO_NOVEDAD.PENDIENTE} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
