import { CircleDollarSign, History, Plus, Search } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { claveDia, formatCOP, formatHora } from "@/lib/format";
import { buscarClientes } from "@/app/admin/clientes/actions";
import { ESTADO_CUENTA, ESTADO_CUENTA_LABEL, type EstadoCuenta } from "@/lib/roles";
import { ETIQUETA_METODO } from "@/app/admin/reportes/datos-reporte";
import {
  FormularioAbono,
  FormularioAnularCuenta,
  FormularioNuevaCuenta,
} from "./formularios";

export const metadata = { title: "Cuentas por cobrar · El Buen Gusto" };

const CHIP_ESTADO: Record<EstadoCuenta, string> = {
  PENDIENTE: "bg-danger/10 text-danger-text ring-1 ring-danger/25",
  PAGADA: "bg-success/10 text-success-text ring-1 ring-success/25",
  ANULADA: "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app",
};

export default async function PaginaCuentas(
  props: PageProps<"/admin/cuentas">,
) {
  const { q, nuevo, estado, desde, hasta } = await props.searchParams;
  const filtro = typeof q === "string" ? q.trim() : "";
  const estadoFiltro =
    typeof estado === "string" && estado in ESTADO_CUENTA ? estado : "";

  const condiciones: {
    createdAt: { gte: Date };
    estado?: string;
  } = { createdAt: { gte: new Date(2020, 0, 1) } };
  if (typeof desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    const [y, m, d] = desde.split("-").map(Number);
    condiciones.createdAt.gte = new Date(y, m - 1, d);
    if (typeof hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      const [yh, mh, dh] = hasta.split("-").map(Number);
      const hastaDt = new Date(yh, mh - 1, dh);
      hastaDt.setDate(hastaDt.getDate() + 1);
      condiciones.createdAt = { gte: condiciones.createdAt.gte, lt: hastaDt } as { gte: Date; lt: Date };
    }
  }
  if (estadoFiltro) condiciones.estado = estadoFiltro;

  const [cuentas, matches, pendientes] = await Promise.all([
    db.cuentaPorCobrar.findMany({
      where: condiciones,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        cliente: true,
        creadoPor: true,
        anuladaPor: true,
        abonos: { orderBy: { createdAt: "desc" }, include: { registradoPor: true } },
      },
    }),
    filtro ? buscarClientes(filtro) : buscarClientes(""),
    db.cuentaPorCobrar.findMany({
      where: { estado: ESTADO_CUENTA.PENDIENTE },
      include: { cliente: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Total adeudado por cliente (todas las pendientes)
  const porCliente = new Map<
    number,
    { nombre: string; telefono: string; saldo: number; cuentas: number }
  >();
  for (const c of pendientes) {
    const fila = porCliente.get(c.clienteId) ?? {
      nombre: c.cliente.nombre,
      telefono: c.cliente.telefono,
      saldo: 0,
      cuentas: 0,
    };
    fila.saldo += c.valorOriginal - c.pagado;
    fila.cuentas += 1;
    porCliente.set(c.clienteId, fila);
  }
  const resumenClientes = [...porCliente.entries()].sort(
    (a, b) => b[1].saldo - a[1].saldo,
  );
  const totalPendiente = resumenClientes.reduce((s, [, f]) => s + f.saldo, 0);

  const mostrarNuevo = typeof nuevo === "string" && nuevo !== "";

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas por cobrar"
        subtitulo="Los fiados: quién debe, cuánto, y cada abono que entra"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={`/admin/cuentas${mostrarNuevo ? "" : `?nuevo=1${filtro ? `&q=${encodeURIComponent(filtro)}` : ""}`}`}
          className="flex items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95"
        >
          <Plus className="h-5 w-5" />
          {mostrarNuevo ? "Cerrar registro" : "Registrar fiado"}
        </Link>
        <span
          data-testid="resumen-total"
          className="flex items-center gap-2 rounded-2xl bg-danger/10 px-4 py-3 text-sm ring-1 ring-danger/25"
        >
          <CircleDollarSign className="h-4 w-4 text-danger-text" />
          <span className="text-danger-text">
            <strong className="font-display">
              {formatCOP(totalPendiente)}
            </strong>{" "}
            por cobrar en total
          </span>
        </span>
      </div>

      {mostrarNuevo ? (
        <div className="mb-6">
          <FormularioNuevaCuenta
            clientes={matches.map((c) => ({
              id: c.id,
              etiqueta: c.telefono ? `${c.nombre} · ${c.telefono}` : c.nombre,
            }))}
          />
        </div>
      ) : null}

      {/* Filtros: cliente, estado, rango de fechas */}
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app"
      >
        <label className="flex flex-1 min-w-56 items-center gap-2.5 rounded-xl bg-fondo-app px-3 py-2 ring-1 ring-borde-app focus-within:ring-amber-brand/60">
          <Search className="h-4 w-4 shrink-0 text-texto-muted/35" />
          <input
            type="search"
            name="q"
            defaultValue={filtro}
            placeholder="Cliente por nombre o teléfono…"
            className="w-full bg-transparent text-sm text-texto-app outline-none placeholder:text-texto-muted/30"
          />
        </label>
        <select
          name="estado"
          defaultValue={estadoFiltro}
          aria-label="Estado de la cuenta"
          className="rounded-xl bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CUENTA_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="text-xs font-bold text-texto-muted/60">
          DESDE
          <input
            type="date"
            name="desde"
            defaultValue={typeof desde === "string" ? desde : ""}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app"
          />
        </label>
        <label className="text-xs font-bold text-texto-muted/60">
          HASTA
          <input
            type="date"
            name="hasta"
            defaultValue={typeof hasta === "string" ? hasta : ""}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
        >
          Filtrar
        </button>
      </form>

      {/* Total adeudado por cliente */}
      {resumenClientes.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl text-texto-app">
            Adeudado por cliente
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {resumenClientes.map(([clienteId, f]) => (
              <Link
                key={clienteId}
                href={`/admin/clientes/${clienteId}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app transition hover:ring-danger/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-texto-app">
                    {f.nombre}
                  </p>
                  <p className="text-[11px] text-texto-muted/50">
                    {f.cuentas} {f.cuentas === 1 ? "cuenta" : "cuentas"} por
                    cobrar
                  </p>
                </div>
                <strong className="font-display text-lg text-danger-text">
                  {formatCOP(f.saldo)}
                </strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Historial / pendientes de cuentas */}
      <h2 className="mb-3 font-display text-xl text-texto-app">
        {estadoFiltro
          ? ESTADO_CUENTA_LABEL[estadoFiltro as EstadoCuenta]
          : "Cuentas"}{" "}
        ({cuentas.length})
      </h2>

      {cuentas.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <History className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">
            Sin cuentas por aquí
          </p>
          <p className="mt-1.5 max-w-md text-sm text-texto-muted/70">
            Registra los fiados con «Registrar fiado» y aparecerán aquí hasta
            que el saldo llegue a cero.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {cuentas.map((cuenta) => {
            const saldo = Math.max(
              0,
              cuenta.valorOriginal - cuenta.pagado,
            );
            return (
              <article
                key={cuenta.id}
                className={
                  "rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app " +
                  (cuenta.estado === ESTADO_CUENTA.ANULADA ? "opacity-60" : "")
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-texto-app">
                      <Link
                        href={`/admin/clientes/${cuenta.clienteId}`}
                        className="hover:underline"
                      >
                        {cuenta.cliente.nombre}
                      </Link>
                      {cuenta.cliente.telefono ? (
                        <span className="ml-2 text-xs font-medium text-texto-muted/50">
                          {cuenta.cliente.telefono}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-texto-muted/80">
                      {cuenta.concepto}
                    </p>
                  </div>
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      CHIP_ESTADO[cuenta.estado as EstadoCuenta]
                    }
                  >
                    {ESTADO_CUENTA_LABEL[cuenta.estado as EstadoCuenta]}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-texto-muted/60">
                  <span>
                    Deuda original:{" "}
                    <strong className="text-texto-app">
                      {formatCOP(cuenta.valorOriginal)}
                    </strong>
                  </span>
                  <span>
                    Abonado:{" "}
                    <strong className="text-success-text">
                      {formatCOP(cuenta.pagado)}
                    </strong>
                  </span>
                  {cuenta.estado === ESTADO_CUENTA.PENDIENTE ? (
                    <span>
                      Saldo:{" "}
                      <strong className="text-danger-text">
                        {formatCOP(saldo)}
                      </strong>
                    </span>
                  ) : null}
                  <span>
                    {claveDia(cuenta.createdAt)} · reg.{" "}
                    {cuenta.creadoPor.nombre}
                    {cuenta.pedidoId ? ` · pedido #${cuenta.pedidoId}` : ""}
                  </span>
                </div>

                {cuenta.abonos.length > 0 ? (
                  <details className="mt-2.5">
                    <summary className="cursor-pointer text-xs font-bold text-texto-muted/60 transition hover:text-texto-app">
                      {cuenta.abonos.length}{" "}
                      {cuenta.abonos.length === 1 ? "abono" : "abonos"}{" "}
                      registrados
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {cuenta.abonos.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-fondo-app px-3 py-2 text-xs text-texto-muted/75"
                        >
                          <strong className="text-success-text">
                            {formatCOP(a.monto)}
                          </strong>
                          <span>
                            {ETIQUETA_METODO[a.metodo] ?? a.metodo}
                          </span>
                          <span className="text-texto-muted/45">
                            {claveDia(a.createdAt)} {formatHora(a.createdAt)}{" "}
                            · {a.registradoPor.nombre}
                          </span>
                          {a.nota ? (
                            <span className="italic">«{a.nota}»</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                {cuenta.estado === ESTADO_CUENTA.PENDIENTE ? (
                  <div className="mt-3 border-t border-borde-app/60 pt-3">
                    <FormularioAbono cuentaId={cuenta.id} saldo={saldo} />
                    <div className="mt-2">
                      <FormularioAnularCuenta cuentaId={cuenta.id} />
                    </div>
                  </div>
                ) : null}

                {cuenta.estado === ESTADO_CUENTA.ANULADA ? (
                  <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger-text ring-1 ring-danger/20">
                    Anulada {cuenta.anuladaAt ? claveDia(cuenta.anuladaAt) : ""}
                    {cuenta.anuladaPor ? ` por ${cuenta.anuladaPor.nombre}` : ""}
                    {cuenta.anuladaMotivo ? ` · «${cuenta.anuladaMotivo}»` : ""}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
