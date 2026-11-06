import { CircleDollarSign, History, Plus, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { claveDia, formatCOP, formatHora } from "@/lib/format";
import { nombreCanonico, telefonoComparacion } from "@/lib/clientes";
import { ESTADO_CUENTA, ESTADO_CUENTA_LABEL, type EstadoCuenta } from "@/lib/roles";
import { ETIQUETA_METODO } from "@/app/admin/reportes/datos-reporte";
import {
  FormularioAbono,
  FormularioAnularCuenta,
  FormularioCondonarCuenta,
  FormularioNuevaCuenta,
} from "./formularios";

export const metadata = { title: "Cuentas por cobrar · El Buen Gusto" };

const CHIP_ESTADO: Record<EstadoCuenta, string> = {
  PENDIENTE: "bg-danger/10 text-danger-text ring-1 ring-danger/25",
  PAGADA: "bg-success/10 text-success-text ring-1 ring-success/25",
  ANULADA: "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app",
  CONDONADA: "bg-warning/10 text-warning ring-1 ring-warning/25",
};

const POR_PAGINA = 20;

/** Fecha «desde/hasta» de los filtros: cada una se valida por separado */
function fechaDeFiltro(
  crudo: unknown,
  fin: boolean,
): Date | null {
  if (typeof crudo !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(crudo)) return null;
  const [y, m, d] = crudo.split("-").map(Number);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (fin) {
    // Hasta incluye el día completo: corte la medianoche siguiente
    dt.setDate(dt.getDate() + 1);
  }
  return dt;
}

export default async function PaginaCuentas(
  props: PageProps<"/admin/cuentas">,
) {
  const {
    q,
    telefono,
    concepto,
    estado,
    desde,
    hasta,
    pagina,
    nuevo,
    clienteId,
  } = await props.searchParams;

  // ── Validación de cada filtro por separado ──
  const filtro = typeof q === "string" ? q.trim() : "";
  const filtroTelefono = typeof telefono === "string" ? telefono.trim() : "";
  const filtroConcepto = typeof concepto === "string" ? concepto.trim() : "";
  const estadoFiltro =
    typeof estado === "string" && estado in ESTADO_CUENTA ? estado : "";
  const desdeDt = fechaDeFiltro(desde, false);
  const hastaDt = fechaDeFiltro(hasta, true);
  const paginaN = Math.max(
    1,
    Number.parseInt(typeof pagina === "string" ? pagina : "1", 10) || 1,
  );

  // ── Contexto de ficha («Gestionar fiados» desde la ficha del cliente) ──
  // Un valor inválido o inexistente NUNCA se descarta en silencio: se avisa
  // con claridad (y si la ficha fue fusionada, se ofrece su destino) y la
  // página se ve como la vista general, sin filtro.
  const crudoClienteId = typeof clienteId === "string" ? clienteId.trim() : "";
  let fichaFija: { id: number; nombre: string; telefono: string } | null = null;
  let avisoFicha = "";
  let destinoDeFichaFusionada = 0;
  if (crudoClienteId) {
    const idFicha = Number.parseInt(crudoClienteId, 10);
    if (!Number.isInteger(idFicha) || idFicha <= 0) {
      avisoFicha = `«${crudoClienteId}» no es un número de ficha válido.`;
    } else {
      const ficha = await db.cliente.findUnique({
        where: { id: idFicha },
        select: { id: true, nombre: true, telefono: true },
      });
      if (ficha) {
        fichaFija = ficha;
      } else {
        const fusion = await db.fusionCliente.findFirst({
          where: { origenId: idFicha },
          orderBy: { createdAt: "desc" },
          select: { destinoId: true },
        });
        if (fusion) {
          destinoDeFichaFusionada = fusion.destinoId;
          avisoFicha = `La ficha #${idFicha} ya no existe: fue fusionada con la ficha #${fusion.destinoId}.`;
        } else {
          avisoFicha = `La ficha #${idFicha} no existe (puede haberse eliminado).`;
        }
      }
    }
  }

  const donde: Prisma.CuentaPorCobrarWhereInput = {};
  if (estadoFiltro) donde.estado = estadoFiltro;
  if (desdeDt || hastaDt) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (desdeDt) createdAt.gte = desdeDt;
    if (hastaDt) createdAt.lt = hastaDt; // «hasta» incluye ese día entero
    donde.createdAt = createdAt;
  }
  if (filtroConcepto) donde.concepto = { contains: filtroConcepto };
  if (filtroTelefono) {
    const digitos = telefonoComparacion(filtroTelefono);
    // La clave guardada va sin "57": un contains de la clave cruce igual
    // fichas nuevas y legacy (el número completo la contiene como subcadena)
    if (digitos.length >= 3) {
      donde.cliente = { telefonoBusqueda: { contains: digitos } };
    }
  }
  if (filtro) {
    const canon = nombreCanonico(filtro);
    const digitos = telefonoComparacion(filtro);
    // «#12» (o un número suelto) busca la ficha por su identificador
    const ficha = /^#?\s*(\d{1,7})$/.exec(filtro);
    const idFicha = ficha ? Number.parseInt(ficha[1], 10) : null;
    const opcionesCliente: Prisma.ClienteWhereInput[] = [];
    if (idFicha !== null) opcionesCliente.push({ id: idFicha });
    if (digitos.length >= 3) {
      opcionesCliente.push({ telefonoBusqueda: { contains: digitos } });
    }
    if (canon) opcionesCliente.push({ nombreBusqueda: { contains: canon } });
    if (opcionesCliente.length > 0) {
      donde.cliente = { OR: opcionesCliente };
    }
  }

  // ── Ficha fijada: filtro POR IDENTIFICADOR (no por coincidencia con el
  // nombre o el teléfono) y se combina con todos los filtros de arriba ──
  if (fichaFija) donde.clienteId = fichaFija.id;

  const salto = (paginaN - 1) * POR_PAGINA;

  const [cuentas, totalCuentas, bloqueResumen] = await Promise.all([
    db.cuentaPorCobrar.findMany({
      where: donde,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: POR_PAGINA,
      skip: salto,
      include: {
        cliente: true,
        creadoPor: true,
        anuladaPor: true,
        condonadoPor: true,
        abonos: {
          orderBy: { createdAt: "desc" },
          include: { registradoPor: true },
        },
        // Desglose de artículos (la foto congelada al fiar)
        items: { orderBy: { id: "asc" } },
      },
    }),
    db.cuentaPorCobrar.count({ where: donde }),
    // El resumen siempre mira deudas VIVAS. Si el filtro exige otro estado
    // (pagada/anulada/condonada) no hay saldo por cobrar dentro de él: el
    // bloque vacío deja «$0 por cobrar» (antes el estado del filtro se
    // pisaba y contaba pendientes ajenos al filtro).
    db.cuentaPorCobrar.groupBy({
      by: ["clienteId", "estado"],
      where: {
        ...donde,
        estado:
          estadoFiltro && estadoFiltro !== ESTADO_CUENTA.PENDIENTE
            ? "ESTADO_SIN_PENDIENTE" // opción imposible: el bloque queda vacío
            : ESTADO_CUENTA.PENDIENTE,
      },
      _sum: {
        valorOriginal: true,
        pagado: true,
        saldoCondonado: true,
      },
      _count: { _all: true },
    }),
  ]);

  // ── Resumen global (solo deudas VIVAS del filtro) ──
  const porClientes = new Map<
    number,
    { id: number; nombre: string; telefono: string; saldo: number; cuentas: number }
  >();
  let totalPendiente = 0;
  let cuentasPendientes = 0;
  let totalOriginalVivo = 0;
  let totalAbonadoVivo = 0;
  for (const b of bloqueResumen) {
    const saldo = Math.max(
      0,
      (b._sum.valorOriginal ?? 0) - (b._sum.pagado ?? 0) - (b._sum.saldoCondonado ?? 0),
    );
    totalOriginalVivo += b._sum.valorOriginal ?? 0;
    totalAbonadoVivo += b._sum.pagado ?? 0;
    cuentasPendientes += b._count._all;
    totalPendiente += saldo;
    const fila = porClientes.get(b.clienteId) ?? {
      id: b.clienteId,
      nombre: "",
      telefono: "",
      saldo: 0,
      cuentas: 0,
    };
    fila.saldo += saldo;
    fila.cuentas += b._count._all;
    porClientes.set(b.clienteId, fila);
  }
  // Nombre y teléfono de los clientes con deuda viva (una sola consulta)
  const idsConDeuda = [...porClientes.keys()];
  if (idsConDeuda.length > 0) {
    const fichas = await db.cliente.findMany({
      where: { id: { in: idsConDeuda } },
      select: { id: true, nombre: true, telefono: true },
    });
    for (const f of fichas) {
      const fila = porClientes.get(f.id);
      if (fila) {
        fila.nombre = f.nombre;
        fila.telefono = f.telefono;
      }
    }
  }
  const resumenClientes = [...porClientes.values()]
    .filter((f) => f.nombre !== "")
    .sort((a, b) => b.saldo - a.saldo);
  const clientesConDeuda = resumenClientes.length;

  const mostrarNuevo = typeof nuevo === "string" && nuevo !== "";
  const paginasTotales = Math.max(1, Math.ceil(totalCuentas / POR_PAGINA));

  // Querystring de filtros para los enlaces de paginación (sin la página)
  const qs = new URLSearchParams();
  if (filtro) qs.set("q", filtro);
  if (filtroTelefono) qs.set("telefono", filtroTelefono);
  if (filtroConcepto) qs.set("concepto", filtroConcepto);
  if (estadoFiltro) qs.set("estado", estadoFiltro);
  if (typeof desde === "string" && desdeDt) qs.set("desde", desde);
  if (typeof hasta === "string" && hastaDt) qs.set("hasta", hasta);
  if (fichaFija) qs.set("clienteId", String(fichaFija.id));
  if (mostrarNuevo) qs.set("nuevo", nuevo as string);
  const baseQs = qs.toString() ? `${qs.toString()}&` : "";

  // «Registrar fiado»/«Cerrar registro» mantiene el contexto (ficha + filtros)
  const enlaceNuevo = (conNuevo: boolean) => {
    const p = new URLSearchParams(qs);
    if (conNuevo) p.set("nuevo", "1");
    else p.delete("nuevo");
    return p.toString() ? `/admin/cuentas?${p.toString()}` : "/admin/cuentas";
  };
  const hrefToggle = enlaceNuevo(!mostrarNuevo);
  // Quitar el filtro de cliente regresa a la vista general (conserva el resto
  // de filtros y cierra el registro, que ya no tendría una ficha fija)
  const sinFicha = new URLSearchParams(qs);
  sinFicha.delete("clienteId");
  sinFicha.delete("nuevo");
  const hrefVistaGeneral = sinFicha.toString()
    ? `/admin/cuentas?${sinFicha.toString()}`
    : "/admin/cuentas";

  return (
    <>
      <EncabezadoPagina
        titulo="Cuentas por cobrar"
        subtitulo="Los fiados: quién debe, cuánto, y cada abono que entra"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href={hrefToggle}
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
            <strong className="font-display">{formatCOP(totalPendiente)}</strong>{" "}
            por cobrar en total
          </span>
        </span>
      </div>

      {/* Cliente fijo desde la ficha: indicador visible + limpiar filtro */}
      {fichaFija ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-amber-brand/10 p-3.5 ring-1 ring-amber-brand/40">
          <UserRound className="h-4 w-4 text-texto-muted/60" aria-hidden />
          <p className="text-sm font-bold text-texto-app">
            Viendo las cuentas de {fichaFija.nombre}
            <span className="ml-2 font-normal text-texto-muted/60">
              ficha #{fichaFija.id}
              {fichaFija.telefono ? ` · ${fichaFija.telefono}` : ""}
            </span>
          </p>
          <span className="grow" />
          <Link
            href={`/admin/clientes/${fichaFija.id}`}
            className="text-xs font-bold text-amber-brand transition hover:underline"
          >
            Ver ficha del cliente
          </Link>
          <Link
            href={hrefVistaGeneral}
            className="flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
          >
            <X className="h-3.5 w-3.5" />
            Quitar filtro de cliente
          </Link>
        </div>
      ) : null}

      {/* clienteId inválido o de ficha inexistente: nunca en silencio */}
      {avisoFicha ? (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-danger/10 p-4 ring-1 ring-danger/25"
        >
          <p className="text-sm font-bold text-danger-text">{avisoFicha}</p>
          <span className="flex flex-wrap gap-2">
            {destinoDeFichaFusionada > 0 ? (
              <Link
                href={`/admin/cuentas?clienteId=${destinoDeFichaFusionada}&nuevo=1`}
                className="rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
              >
                Ir a la ficha #{destinoDeFichaFusionada}
              </Link>
            ) : null}
            <Link
              href="/admin/cuentas"
              className="rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
            >
              Ver todas las cuentas
            </Link>
          </span>
        </div>
      ) : null}

      {mostrarNuevo ? (
        <div className="mb-6">
          <FormularioNuevaCuenta
            clienteFijo={
              fichaFija
                ? {
                    id: fichaFija.id,
                    etiqueta: fichaFija.telefono
                      ? `${fichaFija.nombre} · ${fichaFija.telefono}`
                      : fichaFija.nombre,
                  }
                : null
            }
          />
        </div>
      ) : null}

      {/* Filtros: cliente, teléfono, concepto, estado y fechas — cada uno
          dentro de la misma búsqueda pero validado independientemente */}
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app"
      >
        {fichaFija ? (
          <input type="hidden" name="clienteId" value={fichaFija.id} />
        ) : null}
        <label className="flex flex-1 min-w-52 items-center gap-2.5 rounded-xl bg-fondo-app px-3 py-2 ring-1 ring-borde-app focus-within:ring-amber-brand/60">
          <Search className="h-4 w-4 shrink-0 text-texto-muted/35" />
          <input
            type="search"
            name="q"
            defaultValue={filtro}
            placeholder="Cliente: nombre, teléfono… o #ficha"
            className="w-full bg-transparent text-sm text-texto-app outline-none placeholder:text-texto-muted/30"
          />
        </label>
        <label className="flex min-w-40 items-center gap-2 rounded-xl bg-fondo-app px-3 py-2 ring-1 ring-borde-app focus-within:ring-amber-brand/60">
          <span className="text-xs text-texto-muted/40">Teléf.</span>
          <input
            name="telefono"
            defaultValue={filtroTelefono}
            inputMode="numeric"
            placeholder="315…"
            className="w-full bg-transparent text-sm text-texto-app outline-none placeholder:text-texto-muted/30"
          />
        </label>
        <label className="flex min-w-48 items-center gap-2 rounded-xl bg-fondo-app px-3 py-2 ring-1 ring-borde-app focus-within:ring-amber-brand/60">
          <span className="text-xs text-texto-muted/40">Concepto</span>
          <input
            name="concepto"
            defaultValue={filtroConcepto}
            placeholder="almuerzos…"
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

      {/* Resumen global: agrega en BD sobre el filtro vigente. El «total por
          cobrar» nunca puede quedar negativo (saldo real). */}
      <section className="mb-8 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-widest text-texto-muted/50">
            Deudas vigentes
          </p>
          <p className="mt-1 font-display text-xl text-texto-app">
            {cuentasPendientes}{" "}
            <span className="text-sm text-texto-muted/50">
              de {totalCuentas} cuenta{totalCuentas === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-widest text-texto-muted/50">
            Clientes con deuda
          </p>
          <p className="mt-1 font-display text-xl text-texto-app">
            {clientesConDeuda}
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-widest text-texto-muted/50">
            Esas deudas originales
          </p>
          <p className="mt-1 font-display text-xl text-texto-app">
            {formatCOP(totalOriginalVivo)}
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-widest text-texto-muted/50">
            Abonado (dinero real)
          </p>
          <p className="mt-1 font-display text-xl text-success-text">
            {formatCOP(totalAbonadoVivo)}
          </p>
        </div>
      </section>

      {/* Total adeudado por cliente (de las deudas vigentes del filtro) */}
      {resumenClientes.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-xl text-texto-app">
            Adeudado por cliente
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {resumenClientes.map((f) => (
              <Link
                key={f.id}
                href={`/admin/clientes/${f.id}`}
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

      {/* Historial de cuentas (paginado en la BD, 20 por página) */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-texto-app">
          {estadoFiltro
            ? ESTADO_CUENTA_LABEL[estadoFiltro as EstadoCuenta]
            : "Cuentas"}{" "}
          ({totalCuentas})
        </h2>
        {paginasTotales > 1 ? (
          <span className="text-xs font-bold text-texto-muted/60">
            Página {paginaN} de {paginasTotales}
          </span>
        ) : null}
      </div>

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
              cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado,
            );
            return (
              <article
                key={cuenta.id}
                className={
                  "rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app " +
                  (cuenta.estado === ESTADO_CUENTA.ANULADA
                    ? "opacity-60"
                    : cuenta.estado === ESTADO_CUENTA.CONDONADA
                      ? "opacity-90"
                      : "")
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
                  {cuenta.saldoCondonado > 0 ? (
                    <span>
                      Condonado:{" "}
                      <strong className="text-warning">
                        {formatCOP(cuenta.saldoCondonado)}
                      </strong>
                    </span>
                  ) : null}
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

                {cuenta.items.length > 0 ? (
                  <details className="mt-2.5">
                    <summary className="cursor-pointer text-xs font-bold text-violeta-text/80 transition hover:text-violeta-text">
                      Se lleva {cuenta.items.length}{" "}
                      {cuenta.items.length === 1 ? "artículo" : "artículos"} (la
                      foto de lo que fió)
                    </summary>
                    <ul className="mt-2 space-y-1 rounded-xl bg-fondo-app px-3 py-2">
                      {cuenta.items.map((linea) => (
                        <li
                          key={linea.id}
                          className="flex flex-wrap items-baseline gap-x-2 text-xs text-texto-muted/80"
                        >
                          <span className="font-bold text-texto-app">
                            {linea.cantidad > 1 ? `${linea.cantidad}× ` : ""}
                            {linea.nombre}
                          </span>
                          {linea.conSopa === false ? (
                            <span className="rounded-md bg-panel-app px-1.5 py-0.5 text-[10px] font-bold uppercase text-texto-muted/50">
                              sin sopa
                            </span>
                          ) : null}
                          {linea.nota ? (
                            <span className="italic text-texto-muted/55">
                              «{linea.nota}»
                            </span>
                          ) : null}
                          <span className="ml-auto tabular-nums font-bold text-texto-app">
                            {formatCOP(linea.precio * linea.cantidad)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[10px] text-texto-muted/45">
                      Precios congelados al momento del fiado (no cambian con el
                      menú del día).
                    </p>
                  </details>
                ) : null}

                {cuenta.abonos.length > 0 ? (
                  <details className="mt-2.5">
                    <summary className="cursor-pointer text-xs font-bold text-texto-muted/60 transition hover:text-texto-app">
                      {cuenta.abonos.length}{" "}
                      {cuenta.abonos.length === 1 ? "abono" : "abonos"}{" "}
                      {cuenta.abonos.length === 1 ? "registrado" : "registrados"}
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
                          <span>{ETIQUETA_METODO[a.metodo] ?? a.metodo}</span>
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
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                      <FormularioCondonarCuenta
                        cuentaId={cuenta.id}
                        valorOriginal={cuenta.valorOriginal}
                        abonado={cuenta.pagado}
                        saldo={saldo}
                      />
                      <FormularioAnularCuenta cuentaId={cuenta.id} />
                    </div>
                  </div>
                ) : null}

                {cuenta.estado === ESTADO_CUENTA.CONDONADA ? (
                  <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning ring-1 ring-warning/20">
                    Saldo condonado el{" "}
                    {cuenta.condonadoAt ? `${claveDia(cuenta.condonadoAt)} ${formatHora(cuenta.condonadoAt)}` : "—"}
                    {cuenta.condonadoPor ? ` por ${cuenta.condonadoPor.nombre}` : ""}
                    {cuenta.condonadoMotivo ? ` · «${cuenta.condonadoMotivo}»` : ""}
                    {cuenta.pagado > 0
                      ? ` · los abonos recibidos (${formatCOP(cuenta.pagado)}) siguen siendo dinero de caja`
                      : " · no fue ingreso de caja"}
                  </p>
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

      {paginasTotales > 1 ? (
        <nav
          aria-label="Paginación de cuentas"
          className="mt-5 flex items-center justify-center gap-2"
        >
          {paginaN > 1 ? (
            <Link
              href={`/admin/cuentas?${baseQs}pagina=${paginaN - 1}`}
              className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
            >
              ← Anteriores
            </Link>
          ) : null}
          {paginaN < paginasTotales ? (
            <Link
              href={`/admin/cuentas?${baseQs}pagina=${paginaN + 1}`}
              className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
            >
              Siguientes →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
