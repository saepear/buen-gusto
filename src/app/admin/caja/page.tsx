import { ArrowLeft, Banknote, CheckCircle2, Coffee, Gift, HandCoins, NotebookPen, Receipt, WalletCards } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { precioUnitarioItem, nombreDeItem } from "@/lib/precios";
import { formatCOP, formatHora } from "@/lib/format";
import { numeroVisible } from "@/lib/consecutivos";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { ESTADO_CUENTA, ESTADO_MESA, ESTADO_DOMICILIO } from "@/lib/roles";
import { ordenMesasPorNombre } from "@/lib/mesas";
import { TarjetaCobro, type AnticipoDisponible, type MesaParaCobrar } from "./tarjeta-cobro";
import { PanelCobroDomicilio } from "@/app/admin/domicilios/panel-cobro-domicilio";
import { FacturaDomicilio } from "@/components/factura-domicilio";
import "./caja.css";

export const metadata = { title: "Caja y recibos" };

const CHIP_METODO: Record<string, string> = {
  EFECTIVO: "bg-success/10 text-success-text ring-1 ring-success/20",
  TARJETA: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  TRANSFERENCIA: "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
};

const METODO_TXT: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

export default async function PaginaCaja(
  props: PageProps<"/admin/caja">,
) {
  const { domicilio: domicilioCrudo } = await props.searchParams;
  const idParseado =
    typeof domicilioCrudo === "string"
      ? Number.parseInt(domicilioCrudo, 10)
      : Number.NaN;
  const buscarDomicilio = Number.isInteger(idParseado) ? idParseado : null;

  const fecha = inicioDeHoy();

  const [mesasBrutas, pagosHoy, resumenHoy, domicilioCobro, resumenAnticipos, anticiposVigentes] = await Promise.all([
    db.mesa.findMany({
      where: {
        estado: { in: [ESTADO_MESA.OCUPADA, ESTADO_MESA.POR_PAGAR] },
        activa: true,
        // Domicilios y apartados no se cobran como mesas de salón
        esDomicilio: false,
        esApartado: false,
      },
    }),
    db.pago.findMany({
      where: { createdAt: { gte: fecha } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { pedido: { include: { mesa: true } } },
    }),
    db.pago.aggregate({
      where: { createdAt: { gte: fecha } },
      _sum: { total: true, propina: true },
      _count: true,
    }),
    // El domicilio que el tablero mandó a la caja con «Cobrar en caja»
    buscarDomicilio
      ? db.domicilio.findUnique({
          where: { id: buscarDomicilio },
          include: {
            pedido: { include: { items: { include: { producto: true } } } },
          },
        })
      : Promise.resolve(null),
    db.anticipoCliente.aggregate({
      where: { createdAt: { gte: fecha }, estado: { not: "ANULADO" } },
      _sum: { valorOriginal: true },
      _count: true,
    }),
    db.anticipoCliente.findMany({
      where: { estado: "VIGENTE" },
      select: {
        id: true,
        valorOriginal: true,
        usado: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const anticiposDisponibles: AnticipoDisponible[] = anticiposVigentes
    .map((anticipo) => ({
      id: anticipo.id,
      cliente: anticipo.cliente.nombre,
      disponible: anticipo.valorOriginal - anticipo.usado,
    }))
    .filter((anticipo) => anticipo.disponible > 0);

  // Orden natural: "Mesa 2" antes que "Mesa 10" (la BD ordena como texto)
  const mesas = ordenMesasPorNombre(mesasBrutas);

  const idsMesas = mesas.map((m) => m.id);
  const pedidos =
    idsMesas.length === 0
      ? []
      : await db.pedido.findMany({
          where: {
            mesaId: { in: idsMesas },
            estado: { in: ESTADOS_ACTIVOS_PEDIDO },
          },
          include: { items: { include: { producto: true } } },
          orderBy: { createdAt: "asc" },
        });

  const paraCobrar: MesaParaCobrar[] = mesas.map((mesa) => {
    const propios = pedidos.filter((p) => p.mesaId === mesa.id);
    return {
      id: mesa.id,
      nombre: mesa.nombre,
      estado: mesa.estado,
      total: propios.reduce(
        (suma, pedido) =>
          suma +
          pedido.items.reduce(
            (x, item) => x + precioUnitarioItem(item) * item.cantidad,
            0,
          ),
        0,
      ),
      pedidos: propios.map((pedido) => ({
        id: pedido.id,
        numero: numeroVisible(pedido),
        hora: formatHora(pedido.createdAt),
        estado: pedido.estado,
        paraLlevar: pedido.paraLlevar,
        observaciones: pedido.observaciones,
        items: pedido.items.map((item) => ({
          nombre: nombreDeItem(item),
          cantidad: item.cantidad,
          sinSopa: item.tipo === "PROTEINA" && item.conSopa === false,
          precio: precioUnitarioItem(item),
        })),
      })),
    };
  });

  const totalHoy = (resumenHoy._sum.total ?? 0) + (resumenHoy._sum.propina ?? 0);
  const cantidadPagos = resumenHoy._count;
  const anticiposHoyTotal = resumenAnticipos._sum.valorOriginal ?? 0;
  const cantidadAnticipos = resumenAnticipos._count;

  // ── Fiados: deudas del día (no son dinero) + abonos recibidos hoy (sí son
  // dinero de caja, el día en que se reciben; igual que en Reportes) ──
  const [fiadosDelDia, abonosHoy, resumenAbonos] = await Promise.all([
    db.cuentaPorCobrar.findMany({
      where: { estado: ESTADO_CUENTA.PENDIENTE, createdAt: { gte: fecha } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        cliente: { select: { nombre: true, telefono: true } },
        items: { orderBy: { id: "asc" } },
      },
    }),
    db.abonoCuenta.findMany({
      where: { createdAt: { gte: fecha } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        cuenta: {
          select: {
            concepto: true,
            cliente: { select: { nombre: true } },
          },
        },
      },
    }),
    db.abonoCuenta.aggregate({
      where: { createdAt: { gte: fecha } },
      _sum: { monto: true },
      _count: true,
    }),
  ]);
  const abonosHoyTotal = resumenAbonos._sum.monto ?? 0;
  const cantidadAbonos = resumenAbonos._count;
  const saldoFiadosDelDia = fiadosDelDia.reduce(
    (s, c) => s + Math.max(0, c.valorOriginal - c.pagado - c.saldoCondonado),
    0,
  );
  // Dinero real de la caja de hoy: pagos (recibos) + abonos de deudas.
  // Las deudas NO suman: son promesa, no efectivo.
  const totalCajaHoy = totalHoy + abonosHoyTotal + anticiposHoyTotal;
  const pendienteMesas = paraCobrar.reduce((suma, mesa) => suma + mesa.total, 0);

  // ============ La comanda del domicilio, lista para cobrar en la caja ============
  let seccionDomicilio: ReactNode = null;
  let avisoDomicilio: string | null = null;

  if (buscarDomicilio !== null && domicilioCobro === null) {
    avisoDomicilio = "Ese domicilio ya no existe en el sistema.";
  } else if (domicilioCobro) {
    const carga = {
      numeroDomicilio: numeroVisible(domicilioCobro),
      numeroPedido: numeroVisible(domicilioCobro.pedido),
      pedidoId: domicilioCobro.pedidoId,
      cliente: domicilioCobro.cliente,
      telefono: domicilioCobro.telefono,
      direccion: domicilioCobro.direccion,
      barrio: domicilioCobro.barrio,
      referencia: domicilioCobro.referencia,
      horaEntrega: domicilioCobro.horaEntrega,
      observaciones: domicilioCobro.pedido.observaciones,
      items: domicilioCobro.pedido.items.map((item) => ({
        id: item.id,
        cantidad: item.cantidad,
        tipo: item.tipo,
        conSopa: item.conSopa,
        precio: item.precio,
        nota: item.nota,
        producto: { nombre: nombreDeItem(item), precio: precioUnitarioItem(item) },
      })),
    };
    const totalDomicilio = domicilioCobro.pedido.items.reduce(
      (suma, item) => suma + precioUnitarioItem(item) * item.cantidad,
      0,
    );

    if (domicilioCobro.cobradoMonto !== null) {
      // Ya tiene pago: se recuerda dónde queda el recibo
      const pagoDomi = await db.pago.findFirst({
        where: { pedidoId: domicilioCobro.pedidoId },
        orderBy: { createdAt: "desc" },
      });
      seccionDomicilio = (
        <section className="mb-6 rounded-[2rem] bg-glass-app p-5 ring-2 ring-success/40 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-xl text-success-text">
                El domicilio #{numeroVisible(domicilioCobro)} ya está cobrado
              </p>
              <p className="mt-0.5 text-sm text-texto-muted/70">
                {domicilioCobro.cliente} ·{" "}
                {METODO_TXT[domicilioCobro.cobradoMetodo ?? ""] ??
                  domicilioCobro.cobradoMetodo}{" "}
                · {formatCOP(domicilioCobro.cobradoMonto)}
              </p>
            </div>
            {pagoDomi ? (
              <Link
                href={`/admin/domicilios/factura/${pagoDomi.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app"
              >
                <Receipt className="h-4 w-4" /> Ver factura
              </Link>
            ) : null}
          </div>
        </section>
      );
    } else if (domicilioCobro.estado === ESTADO_DOMICILIO.CANCELADO) {
      seccionDomicilio = (
        <section className="mb-6 rounded-[2rem] bg-glass-app p-5 ring-2 ring-danger/40 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-danger-text">
                Domicilio #{numeroVisible(domicilioCobro)} cancelado
              </p>
              <p className="mt-0.5 text-sm text-texto-muted/70">
                {domicilioCobro.cliente} · el envío fue cancelado: no se cobra
              </p>
            </div>
            <Link
              href="/admin/domicilios"
              className="inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Tablero
            </Link>
          </div>
        </section>
      );
    } else {
      seccionDomicilio = (
        <section className="mb-6 rounded-[2rem] bg-glass-app p-5 ring-2 ring-amber-brand/70 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-amber-brand">
                Cobrando domicilio #{numeroVisible(domicilioCobro)}
              </p>
              <p className="mt-0.5 text-sm text-texto-muted/70">
                {domicilioCobro.cliente} · revisa la factura y confirma el pago
                en el panel para cerrar la venta
              </p>
            </div>
            <Link
              href="/admin/domicilios"
              className="inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Tablero
            </Link>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <FacturaDomicilio
              carga={carga}
              volverParaImprimir={`/admin/caja?domicilio=${domicilioCobro.id}`}
            />
            <PanelCobroDomicilio
              domicilioId={domicilioCobro.id}
              total={totalDomicilio}
              fichaCliente={
                domicilioCobro.clienteId
                  ? { id: domicilioCobro.clienteId, nombre: domicilioCobro.cliente }
                  : null
              }
            />
          </div>
        </section>
      );
    }
  }

  return (
    <div className="caja-module">
      <EncabezadoPagina
        titulo="Caja y cobros"
        subtitulo="Un solo lugar para cobrar, entregar recibos y controlar el dinero real del día"
      />

      <section className="caja-command-bar" aria-label="Estado de la caja">
        <div className="caja-command-copy"><span className="caja-eyebrow">CENTRO DE COBRO</span><h2>Turno de hoy</h2><p>Revisa primero lo pendiente y luego registra cada pago con su método.</p></div>
        <div className="caja-command-status"><span className="caja-live-dot" /> Caja abierta <small>Actualizada en tiempo real</small></div>
      </section>

      {avisoDomicilio ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-bold text-warning-text ring-1 ring-warning/25">
          <Receipt className="h-4 w-4" /> {avisoDomicilio}
          <Link
            href="/admin/caja"
            className="ml-auto rounded-lg bg-panel-app px-2.5 py-1 text-xs ring-1 ring-warning/25 transition hover:bg-warning/20"
          >
            Quitar
          </Link>
        </div>
      ) : null}

      {seccionDomicilio}

      {/* Resumen del día */}
      <section className="caja-overview">
        <div className="caja-overview-main"><span className="caja-eyebrow">DINERO RECIBIDO HOY</span><strong>{formatCOP(totalCajaHoy)}</strong><p>{cantidadPagos + cantidadAbonos + cantidadAnticipos === 0 ? "Aún no hay movimientos en caja" : `${cantidadPagos + cantidadAbonos + cantidadAnticipos} movimientos registrados`}</p><div className="caja-overview-breakdown"><span><Banknote size={15} /> {formatCOP(totalHoy)} en ventas</span><span><HandCoins size={15} /> {formatCOP(abonosHoyTotal)} en abonos</span><span><Gift size={15} /> {formatCOP(anticiposHoyTotal)} en anticipos</span></div></div>
        <div className="caja-kpis"><div><WalletCards size={18} /><span><small>Por cobrar</small><b>{formatCOP(pendienteMesas)}</b></span></div><div><Receipt size={18} /><span><small>Pagos emitidos</small><b>{cantidadPagos}</b></span></div><div><HandCoins size={18} /><span><small>Abonos de fiados</small><b>{formatCOP(abonosHoyTotal)}</b></span></div></div>
      </section>

      {/* Mesas por cobrar */}
      <div className="caja-section-heading"><div><span className="caja-eyebrow">COBROS PENDIENTES</span><h2>Mesas por cobrar</h2></div><span className="caja-section-count">{paraCobrar.length} {paraCobrar.length === 1 ? "mesa" : "mesas"}</span></div>
      {paraCobrar.length === 0 ? (
        <div className="caja-empty-state">
          <div className="caja-empty-icon"><Coffee size={28} /></div>
          <div><h3>No hay cobros pendientes</h3><p>Cuando una mesa pase a “Por pagar”, aparecerá aquí con el total, los productos y los métodos de pago.</p></div>
          <div className="caja-empty-check"><CheckCircle2 size={17} /> Caja al día</div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {paraCobrar.map((mesa) => (
            <TarjetaCobro key={mesa.id} mesa={mesa} anticipos={anticiposDisponibles} />
          ))}
        </div>
      )}

      {/* Recibos emitidos hoy */}
      {pagosHoy.length > 0 ? (
        <>
          <div className="caja-section-heading caja-section-heading-spaced"><div><span className="caja-eyebrow">HISTORIAL DE INGRESOS</span><h2>Recibos de hoy</h2></div><span className="caja-section-count">{pagosHoy.length} recientes</span></div>
          <div className="space-y-2">
            {pagosHoy.map((pago) => (
              <Link
                key={pago.id}
                href={`/admin/caja/recibo/${pago.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-panel-app px-4 py-3 ring-1 ring-borde-app transition hover:ring-amber-brand"
              >
                <Receipt className="h-4 w-4 text-texto-muted/70" />
                <span className="text-sm font-bold text-texto-app">
                  Pago #{pago.id}
                </span>
                <span className="text-sm text-texto-muted/70">
                  {pago.pedido.mesa.esDomicilio
                    ? "Domicilio"
                    : pago.pedido.mesa.esApartado
                      ? "Apartado (recogido)"
                      : pago.pedido.mesa.nombre}
                </span>
                <span className="text-xs text-texto-muted/45">
                  {formatHora(pago.createdAt)}
                </span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                    (CHIP_METODO[pago.metodo] ?? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
                  }
                >
                  {METODO_TXT[pago.metodo] ?? pago.metodo}
                </span>
                <span className="ml-auto text-sm font-bold text-texto-app">
                  {formatCOP(pago.total + pago.propina)}
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {/* Fiados del día: deudas que nacieron hoy y siguen por recaudar.
          NO suman a la caja (no son dinero): aquí solo se informan. */}
      <div className="caja-section-heading caja-section-heading-spaced"><div><span className="caja-eyebrow caja-eyebrow-violeta">SEGUIMIENTO DE DEUDAS</span><h2><NotebookPen className="mr-2 inline h-5 w-5 text-violeta-text" />Fiados del día por recaudar</h2></div><span className="caja-section-count caja-section-count-violeta">{fiadosDelDia.length} pendientes</span></div>
      {fiadosDelDia.length === 0 ? (
        <p className="rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-6 text-center text-sm text-texto-muted/60">
          Hoy nadie fió: los fiados de mesa, domicilios y apartados aparecen aquí
          hasta que paguen.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {fiadosDelDia.map((cuenta) => {
              const saldo = Math.max(
                0,
                cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado,
              );
              return (
                <Link
                  key={cuenta.id}
                  href={`/admin/cuentas?cuentaId=${cuenta.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-panel-app px-4 py-3 ring-1 ring-borde-app transition hover:ring-violeta-text"
                >
                  <NotebookPen className="h-4 w-4 text-violeta-text" />
                  <span className="text-sm font-bold text-texto-app">
                    {cuenta.cliente.nombre}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-texto-muted/60">
                    {cuenta.concepto}
                    <span className="ml-2 text-[11px] text-texto-muted/40">
                      {formatHora(cuenta.createdAt)}
                    </span>
                  </span>
                  {cuenta.items.length > 0 ? (
                    <span className="w-full truncate pl-7 text-[11px] text-texto-muted/50">
                      {cuenta.items
                        .map((i) => `${i.cantidad}× ${i.nombre}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (saldo === 0
                        ? "bg-success/10 text-success-text ring-1 ring-success/20"
                        : "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/25")
                    }
                  >
                    {saldo === 0 ? "Saldada" : `Falta ${formatCOP(saldo)}`}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-violeta-text">
                    {formatCOP(saldo)}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-right text-xs font-bold text-texto-muted/60">
            Deuda del día pendiente:{" "}
            <span className="text-violeta-text">
              {formatCOP(saldoFiadosDelDia)}
            </span>{" "}
            (no cuenta como dinero de caja)
          </p>
        </>
      )}

      {/* Dinero recibido HOY por deudas (detalle): sí es dinero de caja */}
      {abonosHoy.length > 0 ? (
        <>
          <h3 className="mb-2 mt-6 font-display text-lg text-texto-app">
            Abonos de deudas recibidos hoy
          </h3>
          <div className="space-y-1.5">
            {abonosHoy.map((ab) => (
              <div
                key={ab.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-panel-app px-4 py-2.5 ring-1 ring-borde-app"
              >
                <HandCoins className="h-4 w-4 text-violeta-text" />
                <span className="text-sm font-bold text-texto-app">
                  {ab.cuenta.cliente.nombre}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-texto-muted/60">
                  {ab.cuenta.concepto}
                </span>
                <span className="text-xs text-texto-muted/45">
                  {formatHora(ab.createdAt)}
                </span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                    (CHIP_METODO[ab.metodo] ??
                      "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
                  }
                >
                  {METODO_TXT[ab.metodo] ?? ab.metodo}
                </span>
                <span className="text-sm font-bold tabular-nums text-violeta-text">
                  {formatCOP(ab.monto)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
