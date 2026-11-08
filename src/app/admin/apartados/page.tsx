import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  PackageOpen,
  Plus,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatCOP, formatHora } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import {
  ESTADO_APARTADO,
  ESTADO_APARTADO_LABEL,
  ESTADO_CUENTA_LABEL,
  type EstadoApartado,
  type EstadoCuenta,
} from "@/lib/roles";
import { requerirRol } from "@/lib/session";
import { AccionesEntregaApartado } from "./acciones-cliente";
import "./apartados.css";

export const metadata = { title: "Apartados · El Buen Gusto" };

const CHIP_ESTADO: Record<EstadoApartado, string> = {
  PENDIENTE: "bg-info/10 text-info-text ring-1 ring-info/25",
  ENTREGADO: "bg-success/10 text-success-text ring-1 ring-success/25",
  CANCELADO: "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app",
};

/** Resumen del plato congelado a partir del JSON de ApartadoItem.detalle:
 *  «Arroz, ensalada, Sopa de hoy, Huevo ×2». Vacío si no hay/está corrupto. */
function resumenDetallePlato(crudo: string | null): string {
  if (!crudo) return "";
  let d: unknown;
  try {
    d = JSON.parse(crudo);
  } catch {
    return "";
  }
  if (!d || typeof d !== "object") return "";
  const raiz = d as {
    conSopa?: unknown;
    principios?: unknown;
    ensaladas?: unknown;
    sopa?: { nombre?: unknown } | null;
    adicionales?: { nombre?: unknown; cantidad?: unknown }[];
  };
  const nombres = (lista: unknown): string[] =>
    Array.isArray(lista)
      ? lista.flatMap((x) => {
          const nombre = x && typeof x === "object" ? (x as { nombre?: unknown }).nombre : null;
          return typeof nombre === "string" ? [nombre] : [];
        })
      : [];
  const comps = [
    ...nombres(raiz.principios),
    ...nombres(raiz.ensaladas),
    raiz.sopa && typeof raiz.sopa === "object" && typeof raiz.sopa.nombre === "string"
      ? raiz.sopa.nombre
      : raiz.conSopa === true
        ? "sopa del día"
        : "",
    ...(Array.isArray(raiz.adicionales)
      ? raiz.adicionales.flatMap((a) => {
          if (!a || typeof a.nombre !== "string") return [];
          return [
            typeof a.cantidad === "number" && a.cantidad > 1
              ? `${a.nombre} ×${a.cantidad}`
              : a.nombre,
          ];
        })
      : []),
  ].filter(Boolean);
  return comps.length ? ` · ${comps.join(", ")}` : "";
}

export default async function PaginaApartados() {
  await requerirRol("ADMIN");
  const hoy = inicioDeHoy();
  const hoyClave = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const [pendientes, historial] = await Promise.all([
    db.apartado.findMany({
      where: { estado: ESTADO_APARTADO.PENDIENTE },
      orderBy: [{ fechaEntrega: "asc" }, { horaEntregaMinutos: "asc" }, { createdAt: "asc" }],
      include: { items: true, cliente: true },
    }),
    db.apartado.findMany({
      where: { estado: { not: ESTADO_APARTADO.PENDIENTE } },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: {
        cliente: true,
        pedido: true,
        cuenta: true,
        creadoPor: true,
      },
    }),
  ]);

  const totalPorEntregar = pendientes.reduce((s, a) => s + a.total, 0);
  const entregadosHoy = historial.filter(
    (a) => a.estado === ESTADO_APARTADO.ENTREGADO && a.entregadoAt && a.entregadoAt >= hoy,
  );

  return (
    <div className="apartados-shell">
      <header className="apartados-hero">
        <span className="apartados-hero-icon" aria-hidden>
          <CalendarClock />
        </span>
        <div className="min-w-0 flex-1">
          <p className="apartados-eyebrow">RESERVAS Y ENTREGAS</p>
          <h1>Apartados</h1>
          <p>Organiza los pedidos reservados, conserva su precio y entrégalos sin perder detalle.</p>
        </div>
        <Link
          href="/admin/apartados/nuevo"
          className="apartados-primary-action"
        >
          <Plus aria-hidden /> Nuevo apartado <ArrowRight aria-hidden />
        </Link>
      </header>

      <div className="apartados-overview">
        <article>
          <span className="apartados-stat-icon is-pending"><Clock3 /></span>
          <div><small>Por entregar</small><strong>{pendientes.length}</strong><p>reservas pendientes</p></div>
        </article>
        <article>
          <span className="apartados-stat-icon is-value"><WalletCards /></span>
          <div><small>Valor comprometido</small><strong>{formatCOP(totalPorEntregar)}</strong><p>precio ya congelado</p></div>
        </article>
        <article>
          <span className="apartados-stat-icon is-done"><CheckCircle2 /></span>
          <div><small>Entregados hoy</small><strong>{entregadosHoy.length}</strong><p>{formatCOP(entregadosHoy.reduce((s, a) => s + a.total, 0))} cobrados</p></div>
        </article>
      </div>

      {/* ════ Por entregar ════ */}
      <div className="apartados-section-heading">
        <div><p>COLA DE ENTREGA</p><h2>Por entregar <span>{pendientes.length}</span></h2></div>
        <small>Ordenados por fecha y hora prometida</small>
      </div>
      {pendientes.length === 0 ? (
        <div className="mb-10 flex min-h-[200px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <PackageOpen className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">
            No hay apartados esperando
          </p>
          <p className="mt-1.5 max-w-md text-sm text-texto-muted/70">
            Cuando un cliente reserve almuerzos con «Nuevo apartado», aparecerán
            aquí ordenados por su fecha y hora de entrega.
          </p>
        </div>
      ) : (
        <div className="apartados-pending-grid">
          {pendientes.map((a) => {
            const retrasado =
              (a.fechaEntrega ? a.fechaEntrega < hoyClave : false) ||
              (!a.fechaEntrega && a.createdAt < hoy);
            return (
              <article
                key={a.id}
                className={
                  "flex flex-col rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app " +
                  (retrasado ? "ring-warning/40" : "")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-texto-app">
                      <Link href={`/admin/clientes/${a.clienteId}`} className="hover:underline">
                        {a.cliente.nombre}
                      </Link>
                      {a.cliente.telefono ? (
                        <span className="ml-2 text-xs font-medium text-texto-muted/50">
                          {a.cliente.telefono}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-texto-muted/60">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {a.fechaEntrega
                        ? `Para el ${a.fechaEntrega}`
                        : `Apartado el ${new Date(a.createdAt).toLocaleDateString("es-CO")}`}
                      {a.horaEntrega ? ` · ${a.horaEntrega}` : ""}
                      {a.paraLlevar === false ? (
                        <span className="ml-1 rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-bold text-info-text">
                          EN MESA
                        </span>
                      ) : null}
                      {retrasado ? (
                        <span className="ml-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-amber-brand">
                          RETRASADO
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <strong className="font-display text-xl text-amber-brand">
                    {formatCOP(a.total)}
                  </strong>
                </div>

                <ul className="mt-2.5 space-y-0.5 text-xs text-texto-muted/80">
                  {a.items.map((it) => (
                    <li key={it.id}>
                      <span className="font-bold text-texto-app">
                        {it.cantidad > 1 ? `${it.cantidad}× ` : ""}
                        {it.nombre}
                      </span>
                      {it.tipo === "ALMUERZO" || it.tipo === "ALMUEZO" ? (
                        <span className="text-texto-muted/55">
                          {it.conSopa === true
                            ? " (completo)"
                            : it.conSopa === false
                              ? " (bandeja)"
                              : ""}
                          {resumenDetallePlato(it.detalle)}
                        </span>
                      ) : null}
                      <span className="text-texto-muted/50">
                        {" "}— {formatCOP(it.precio * it.cantidad)}
                      </span>
                      {it.nota && it.nota !== "" ? (
                        <span className="ml-1 italic text-texto-muted/55">
                          «{it.nota}»
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>

                {a.observaciones ? (
                  <p className="mt-2 rounded-xl bg-fondo-app px-3 py-2 text-xs italic text-texto-muted/70 ring-1 ring-borde-app/60">
                    «{a.observaciones}»
                  </p>
                ) : null}

                <div className="mt-auto">
                  <AccionesEntregaApartado apartadoId={a.id} total={a.total} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ════ Historial ════ */}
      <div className="apartados-section-heading is-history">
        <div><p>TRAZABILIDAD</p><h2><History aria-hidden /> Entregados y cancelados</h2></div>
        <small>Últimos 40 movimientos</small>
      </div>
      {historial.length === 0 ? (
        <p className="rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-8 text-center text-sm text-texto-muted/60">
          Todavía no se ha entregado ni cancelado ningún apartado.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl ring-1 ring-borde-app">
          <table className="w-full text-sm">
            <thead className="bg-panel-app text-left text-[11px] uppercase tracking-wide text-texto-muted/50">
              <tr>
                <th className="px-4 py-2.5">Apartado</th>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Cobro</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="bg-panel-app/60">
              {historial.map((a) => (
                <tr key={a.id} className="border-t border-borde-app/50">
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-texto-app">#{a.id}</p>
                    <p className="text-[11px] text-texto-muted/50">
                      creado por {a.creadoPor.nombre}
                      {a.entregadoAt
                        ? ` · entregado ${formatHora(a.entregadoAt)}`
                        : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/clientes/${a.clienteId}`}
                      className="text-texto-app hover:underline"
                    >
                      {a.cliente.nombre}
                    </Link>
                    {a.fechaEntrega ? (
                      <p className="text-[11px] text-texto-muted/45">
                        para {a.fechaEntrega}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase " +
                        CHIP_ESTADO[a.estado as EstadoApartado]
                      }
                    >
                      {ESTADO_APARTADO_LABEL[a.estado as EstadoApartado]}
                    </span>
                    {a.pedidoId ? (
                      <Link
                        href={`/ordenes/comanda/${a.pedidoId}`}
                        className="ml-2 text-[11px] font-bold text-amber-brand hover:underline"
                      >
                        comanda #{a.pedidoId}
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-texto-muted/70">
                    {a.cuentaId ? (
                      <>
                        Fiado ·{" "}
                        <Link href="/admin/cuentas" className="text-danger-text hover:underline">
                          {a.cuenta
                            ? ESTADO_CUENTA_LABEL[a.cuenta.estado as EstadoCuenta]
                            : "deuda"}{" "}
                          {formatCOP((a.cuenta?.valorOriginal ?? 0) - (a.cuenta?.pagado ?? 0))}
                        </Link>
                      </>
                    ) : a.pedidoId ? (
                      "Pagado en la entrega"
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-texto-app">
                    {formatCOP(a.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
