import { ArrowLeft, Bike, Coffee, Receipt } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { precioUnitarioItem } from "@/lib/precios";
import { formatCOP, formatHora } from "@/lib/format";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { ESTADO_MESA, ESTADO_DOMICILIO, ESTADO_DOMICILIO_LABEL } from "@/lib/roles";
import { ordenMesasPorNombre } from "@/lib/mesas";
import { TarjetaCobro, type MesaParaCobrar } from "./tarjeta-cobro";
import { PanelCobroDomicilio } from "@/app/admin/domicilios/panel-cobro-domicilio";
import { FacturaDomicilio } from "@/components/factura-domicilio";

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

  const [mesasBrutas, pagosHoy, resumenHoy, domicilioCobro] = await Promise.all([
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
            domiciliario: true,
          },
        })
      : Promise.resolve(null),
  ]);

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
            createdAt: { gte: fecha },
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
        hora: formatHora(pedido.createdAt),
        estado: pedido.estado,
        paraLlevar: pedido.paraLlevar,
        observaciones: pedido.observaciones,
        items: pedido.items.map((item) => ({
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
          sinSopa: item.tipo === "PROTEINA" && item.conSopa === false,
          precio: precioUnitarioItem(item),
        })),
      })),
    };
  });

  const totalHoy = (resumenHoy._sum.total ?? 0) + (resumenHoy._sum.propina ?? 0);
  const cantidadPagos = resumenHoy._count;

  // ============ La comanda del domicilio, lista para cobrar en la caja ============
  let seccionDomicilio: ReactNode = null;
  let avisoDomicilio: string | null = null;

  if (buscarDomicilio !== null && domicilioCobro === null) {
    avisoDomicilio = "Ese domicilio ya no existe en el sistema.";
  } else if (domicilioCobro) {
    const carga = {
      numeroDomicilio: domicilioCobro.id,
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
        producto: { nombre: item.producto.nombre, precio: item.producto.precio },
      })),
    };
    const totalDomicilio = domicilioCobro.pedido.items.reduce(
      (suma, item) => suma + precioUnitarioItem(item) * item.cantidad,
      0,
    );
    const etiquetaDomi = domicilioCobro.domiciliario
      ? ` · reparte ${domicilioCobro.domiciliario.nombre}`
      : "";

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
                El domicilio #{domicilioCobro.id} ya está cobrado
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
                href={`/admin/caja/recibo/${pagoDomi.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app"
              >
                <Receipt className="h-4 w-4" /> Ver recibo
              </Link>
            ) : null}
          </div>
        </section>
      );
    } else if (domicilioCobro.estado !== ESTADO_DOMICILIO.ENTREGADO) {
      seccionDomicilio = (
        <section className="mb-6 rounded-[2rem] bg-glass-app p-5 ring-2 ring-amber-brand/70 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-amber-brand">
                Domicilio #{domicilioCobro.id} de {domicilioCobro.cliente}
              </p>
              <p className="mt-0.5 text-sm text-texto-muted/70">
                {ESTADO_DOMICILIO_LABEL[
                  domicilioCobro.estado as keyof typeof ESTADO_DOMICILIO_LABEL
                ] ?? domicilioCobro.estado}
                {etiquetaDomi} · tocado a la caja desde el tablero
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
            <div className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
              <p className="font-display text-2xl text-texto-app">
                Todavía no se puede cobrar
              </p>
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2.5 text-xs font-bold text-warning-text ring-1 ring-warning/25">
                <Bike className="mt-0.5 h-4 w-4 shrink-0" />
                Está «
                {ESTADO_DOMICILIO_LABEL[
                  domicilioCobro.estado as keyof typeof ESTADO_DOMICILIO_LABEL
                ] ?? domicilioCobro.estado}
                ». Márcalo «Entregado» en el tablero cuando el domiciliario
                llegue con la plata y aquí aparecerá el panel de cobro.
              </p>
            </div>
          </div>
        </section>
      );
    } else {
      seccionDomicilio = (
        <section className="mb-6 rounded-[2rem] bg-glass-app p-5 ring-2 ring-amber-brand/70 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-2xl text-amber-brand">
                Cobrando domicilio #{domicilioCobro.id}
              </p>
              <p className="mt-0.5 text-sm text-texto-muted/70">
                {domicilioCobro.cliente}
                {etiquetaDomi} · toca «Cobrar» del panel y va directo al recibo
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
            />
          </div>
        </section>
      );
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Caja"
        subtitulo="Cobra las mesas y los domicilios, genera el recibo y libéralas en un paso"
      />

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
      <div className="mb-6 rounded-[2rem] bg-glass-app p-6 text-texto-app ring-1 ring-borde-app shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-3xl text-amber-brand">
              {formatCOP(totalHoy)}
            </p>
            <p className="mt-1 text-sm text-texto-muted/80">
              {cantidadPagos === 0
                ? "Aún no hay pagos registrados hoy"
                : `Cobrado en caja hoy · ${cantidadPagos} ${
                    cantidadPagos === 1 ? "pago" : "pagos"
                  }`}
            </p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-app text-amber-brand ring-1 ring-borde-app">
            <Receipt className="h-7 w-7" />
          </span>
        </div>
      </div>

      {/* Mesas por cobrar */}
      <h2 className="mb-3 font-display text-xl text-texto-app">
        Mesas por cobrar
      </h2>
      {paraCobrar.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-panel-app text-texto-muted/45">
            <Coffee className="h-10 w-10" />
          </span>
          <p className="mt-5 font-display text-2xl text-texto-app">
            Caja en calma
          </p>
          <p className="mt-2 max-w-md text-texto-muted/70">
            Todas las mesas están libres. Cuando el mesero tome un pedido,
            la mesa aparecerá aquí con su cuenta lista para cobrar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {paraCobrar.map((mesa) => (
            <TarjetaCobro key={mesa.id} mesa={mesa} />
          ))}
        </div>
      )}

      {/* Recibos emitidos hoy */}
      {pagosHoy.length > 0 ? (
        <>
          <h2 className="mb-3 mt-8 font-display text-xl text-texto-app">
            Recibos de hoy
          </h2>
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
    </>
  );
}
