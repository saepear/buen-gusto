import { Coffee, Receipt } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { precioUnitarioItem } from "@/lib/precios";
import { formatCOP, formatHora } from "@/lib/format";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { ESTADO_MESA } from "@/lib/roles";
import { TarjetaCobro, type MesaParaCobrar } from "./tarjeta-cobro";

export const metadata = { title: "Caja y recibos" };

const CHIP_METODO: Record<string, string> = {
  EFECTIVO: "bg-success/10 text-success-text ring-1 ring-success/20",
  TARJETA: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  TRANSFERENCIA: "bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20",
};

const METODO_TXT: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

export default async function PaginaCaja() {
  const fecha = inicioDeHoy();

  const [mesas, pagosHoy, resumenHoy] = await Promise.all([
    db.mesa.findMany({
      where: {
        estado: { in: [ESTADO_MESA.OCUPADA, ESTADO_MESA.POR_PAGAR] },
        activa: true,
      },
      orderBy: { nombre: "asc" },
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
  ]);

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

  return (
    <>
      <EncabezadoPagina
        titulo="Caja"
        subtitulo="Cobra las mesas, genera el recibo y libéralas en un paso"
      />

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
                  {pago.pedido.mesa.nombre}
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

