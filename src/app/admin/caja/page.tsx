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
  EFECTIVO: "bg-success/15 text-success-dark",
  TARJETA: "bg-[#4aa3ff]/15 text-[#2b7dc0]",
  TRANSFERENCIA: "bg-[#b06fd0]/15 text-[#8d4bab]",
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
      orderBy: { numero: "asc" },
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
      numero: mesa.numero,
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
      <div className="mb-6 rounded-3xl bg-brown-800 p-6 text-cream-100 shadow-lg shadow-brown-800/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display text-3xl text-amber-brand">
              {formatCOP(totalHoy)}
            </p>
            <p className="mt-1 text-sm text-cream-200/80">
              {cantidadPagos === 0
                ? "Aún no hay pagos registrados hoy"
                : `Cobrado en caja hoy · ${cantidadPagos} ${
                    cantidadPagos === 1 ? "pago" : "pagos"
                  }`}
            </p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brown-700/70 text-amber-brand">
            <Receipt className="h-7 w-7" />
          </span>
        </div>
      </div>

      {/* Mesas por cobrar */}
      <h2 className="mb-3 font-display text-xl text-brown-800">
        Mesas por cobrar
      </h2>
      {paraCobrar.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brown-600/25 bg-cream-100 p-10 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brown-800/10 text-brown-700">
            <Coffee className="h-10 w-10" />
          </span>
          <p className="mt-5 font-display text-2xl text-brown-800">
            Caja en calma
          </p>
          <p className="mt-2 max-w-md text-brown-600">
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
          <h2 className="mb-3 mt-8 font-display text-xl text-brown-800">
            Recibos de hoy
          </h2>
          <div className="space-y-2">
            {pagosHoy.map((pago) => (
              <Link
                key={pago.id}
                href={`/admin/caja/recibo/${pago.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white px-4 py-3 ring-1 ring-cream-300 transition hover:ring-amber-brand"
              >
                <Receipt className="h-4 w-4 text-brown-600" />
                <span className="text-sm font-bold text-brown-800">
                  Pago #{pago.id}
                </span>
                <span className="text-sm text-brown-600">
                  Mesa #{pago.pedido.mesa.numero}
                </span>
                <span className="text-xs text-brown-500">
                  {formatHora(pago.createdAt)}
                </span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                    (CHIP_METODO[pago.metodo] ?? "bg-cream-200 text-brown-600")
                  }
                >
                  {METODO_TXT[pago.metodo] ?? pago.metodo}
                </span>
                <span className="ml-auto text-sm font-bold text-brown-800">
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
