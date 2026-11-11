import { CheckCircle2, Clock, Printer, Search, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatHora, claveDia } from "@/lib/format";
import { numeroVisible } from "@/lib/consecutivos";
import { requerirRol } from "@/lib/session";
import { AutoRefresco } from "./refresco";
import { AccionesComanda } from "./botones-comanda";
import { TableroOrdenes } from "./tablero";
import "./ordenes.css";

export const metadata = { title: "Órdenes · El Buen Gusto" };

export default async function PaginaOrdenes(props: PageProps<"/ordenes">) {
  const sesion = await requerirRol("ADMIN");
  const { busqueda } = await props.searchParams;

  // Siempre el día de hoy: las órdenes se borran al cerrar caja
  const dia = claveDia(new Date());

  const cierre = await db.cierreCaja.findUnique({ where: { fecha: dia } });

  const where: Prisma.PedidoWhereInput = {
    createdAt: {
      gte: new Date(dia + "T00:00:00"),
      lte: new Date(dia + "T23:59:59"),
    },
  };

  if (cierre) {
    // Si hay cierre, solo mostramos las comandas activas (si quedaran)
    where.estado = { in: ["ENVIADO", "EN_PREPARACION", "PARCIAL_SERVIDO", "SERVIDO", "POR_PAGAR"] };
  }

  if (busqueda) {
    const query = String(busqueda).trim();
    where.OR = [
      { mesa: { nombre: { contains: query } } },
      { domicilio: { is: { cliente: { contains: query } } } },
    ];
    if (/^\d+$/.test(query)) {
      const id = Number.parseInt(query, 10);
      where.OR.unshift({ consecutivoDia: id }, { domicilio: { is: { consecutivoDia: id } } }, { id });
    }
  }

  const pedidos = await db.pedido.findMany({
    where,
    include: {
      items: { include: { producto: true } },
      mesa: true,
      mesero: true,
      domicilio: { include: { clienteRegistrado: true } },
      apartado: { include: { cliente: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Una comanda no tiene relación inversa a la deuda porque puede llevar más
  // de un fiado parcial. Se arma aquí su lectura financiera para que Órdenes
  // diga si esa deuda ya se pagó y conserve el cliente y el origen exacto.
  const cuentas = pedidos.length
    ? await db.cuentaPorCobrar.findMany({
        where: { pedidoId: { in: pedidos.map((pedido) => pedido.id) } },
        include: { cliente: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const cuentasPorPedido = new Map<number, typeof cuentas>();
  for (const cuenta of cuentas) {
    if (cuenta.pedidoId === null) continue;
    const lista = cuentasPorPedido.get(cuenta.pedidoId) ?? [];
    lista.push(cuenta);
    cuentasPorPedido.set(cuenta.pedidoId, lista);
  }

  return (
    <div className="flex min-h-screen flex-col bg-fondo-app text-texto-app font-sans selection:bg-amber-brand/30">
      {/* Navbar Minimalista */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-borde-app/50 bg-fondo-app/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-amber-brand/20 blur-sm"></div>
            <Image src="/logo.png" alt="Logo" width={42} height={42} className="relative rounded-full" unoptimized />
          </div>
          <div>
            <h1 className="font-display text-lg tracking-tight text-texto-app">
              Gestión de Comandas
            </h1>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"></span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-texto-muted/40">
                Sistema Operativo en Vivo
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <AutoRefresco segundos={30} />
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-xl bg-panel-app px-4 py-2 text-xs font-bold text-texto-app transition hover:bg-amber-brand hover:text-brown-950"
          >
            Panel Admin
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-6 lg:p-10">
        {/* Header de Sección y Filtros */}
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-4xl text-texto-app">Órdenes</h2>
            <p className="mt-2 text-texto-muted/50">Registro de comandas, consumos y cobros del restaurante</p>
          </div>

          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-muted/35 transition-colors group-focus-within:text-amber-brand" />
              <input
                name="busqueda"
                defaultValue={busqueda}
                placeholder="Comanda, domicilio, cliente o mesa..."
                className="h-12 w-64 rounded-2xl bg-panel-app pl-11 pr-4 text-sm text-texto-app outline-none ring-1 ring-borde-app transition focus:ring-amber-brand/50 placeholder:text-texto-muted/25"
              />
            </div>
            <button
              type="submit"
              className="h-12 rounded-2xl bg-amber-brand px-8 font-display text-sm font-bold text-brown-950 transition hover:scale-[1.02] active:scale-95"
            >
              Actualizar
            </button>
          </form>
        </div>

        {pedidos.length === 0 ? (
          <div className="ordenes-empty-layout">
            <div className="ordenes-empty-hero">
              <div className="ordenes-empty-icon"><ShoppingBag size={28} /></div>
              <div><span className="orden-eyebrow">REGISTRO DEL TURNO</span><h3>Todo despejado por ahora</h3><p>Las comandas aparecerán aquí en cuanto el equipo registre un pedido desde una mesa o domicilio.</p></div>
            </div>
            <div className="ordenes-empty-stats">
              <div><ShoppingBag size={18} /><span><small>Comandas del día</small><b>0 registros</b></span></div>
              <div><Clock size={18} /><span><small>Por cobrar</small><b>0 registros</b></span></div>
              <div><CheckCircle2 size={18} /><span><small>Finalizadas</small><b>0 registros</b></span></div>
            </div>
            <div className="ordenes-empty-tip"><ShoppingBag size={17} /><span><b>Tip rápido:</b> usa el buscador para encontrar una comanda por número o mesa.</span></div>
          </div>
        ) : (
          <>
          <TableroOrdenes
            pedidos={pedidos.map((pedido) => ({
              ...(() => {
                const cuentasDelPedido = cuentasPorPedido.get(pedido.id) ?? [];
                const saldo = cuentasDelPedido.reduce(
                  (total, cuenta) => total + Math.max(0, cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado),
                  0,
                );
                const estadoCuenta: "PENDIENTE" | "PAGADA" | "CONDONADA" | "ANULADA" =
                  saldo > 0
                    ? "PENDIENTE"
                    : cuentasDelPedido.every((item) => item.estado === "PAGADA")
                      ? "PAGADA"
                      : cuentasDelPedido.some((item) => item.estado === "CONDONADA")
                        ? "CONDONADA"
                        : "ANULADA";
                const cuenta = cuentasDelPedido.length
                  ? {
                      estado: estadoCuenta,
                      saldo,
                      total: cuentasDelPedido.reduce((total, item) => total + item.valorOriginal, 0),
                    }
                  : null;
                const cliente = pedido.domicilio?.clienteRegistrado?.nombre
                  ?? cuentasDelPedido[0]?.cliente.nombre
                  ?? pedido.domicilio?.cliente
                  ?? pedido.apartado?.cliente.nombre
                  ?? null;
                const origen = pedido.domicilio
                  ? `Domicilio #${numeroVisible(pedido.domicilio)}`
                  : pedido.apartado
                    ? `Apartado #${pedido.apartado.id}`
                    : pedido.paraLlevar
                      ? "Para llevar"
                      : `Mesa ${pedido.mesa.nombre}`;
                return { cliente, origen, cuenta };
              })(),
              id: pedido.id,
              numero: numeroVisible(pedido),
              mesa: pedido.mesa.nombre,
              mesero: pedido.mesero?.nombre ?? "Sistema",
              estado: pedido.estado,
              paraLlevar: pedido.paraLlevar,
              createdAt: pedido.createdAt.toISOString(),
              items: pedido.items.map((item) => ({
                id: item.id,
                nombre: item.productoNombre ?? item.producto?.nombre ?? "Producto",
                cantidad: item.cantidad,
                precio: item.precio ?? item.producto?.precio ?? 0,
                nota: item.nota,
                conSopa: item.conSopa,
              })),
            }))}
          />
          <div className="hidden relative overflow-hidden rounded-[32px] bg-panel-app p-1 ring-1 ring-borde-app shadow-2xl" aria-hidden="true">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-borde-app text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/30">
                    <th className="px-8 py-6">ID</th>
                    <th className="px-8 py-6">Origen</th>
                    <th className="px-8 py-6">Registro</th>
                    <th className="px-8 py-6">Responsable</th>
                    <th className="px-8 py-6">Estado Actual</th>
                    <th className="px-8 py-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde-app">
                  {pedidos.map((pedido) => (
                    <tr key={pedido.id} className="group transition-colors hover:bg-panel-app">
                      <td className="px-8 py-6">
                        <span className="font-display text-xl text-amber-brand">#{numeroVisible(pedido)}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panel-app font-display text-texto-app">
                            {pedido.mesa.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-texto-app text-base">{pedido.mesa.nombre}</p>
                            {pedido.paraLlevar && (
                              <span className="text-[9px] font-black uppercase tracking-tighter text-orange-brand">LLEVAR</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-texto-muted/60">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatHora(pedido.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-texto-muted/80">{pedido.mesero?.nombre ?? "Sistema"}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider " +
                          (pedido.estado === "ENVIADO" ? "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20" :
                           pedido.estado === "SERVIDO" ? "bg-success/10 text-success-text ring-1 ring-success/20" :
                           pedido.estado === "FIADO" ? "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/25" :
                           pedido.estado === "COBRADO" ? "bg-panel-app text-texto-muted/40" :
                           pedido.estado === "CANCELADO" ? "bg-danger/10 text-danger-text ring-1 ring-danger/20" :
                           "bg-panel-app text-texto-muted/60")
                        }>
                          <span className={"h-1.5 w-1.5 rounded-full " +
                            (pedido.estado === "ENVIADO" ? "bg-amber-brand" :
                             pedido.estado === "SERVIDO" ? "bg-success" :
                             pedido.estado === "FIADO" ? "bg-violeta-text" :
                             pedido.estado === "CANCELADO" ? "bg-danger" : "bg-texto-muted/40")
                          }></span>
                          {pedido.estado === "COBRADO" ? "Atendido" :
                           pedido.estado === "FIADO" ? "Fiada (deuda)" :
                           pedido.estado === "CANCELADO" ? "Cancelado" :
                           pedido.estado.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AccionesComanda
                            pedidoId={pedido.id}
                            estado={pedido.estado}
                          />
                          <Link
                            href={`/ordenes/comanda/${pedido.id}`}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-panel-app text-texto-app transition hover:bg-amber-brand hover:text-brown-950 hover:scale-110 active:scale-95 shadow-lg"
                            title="Gestionar Comanda"
                          >
                            <Printer className="h-5 w-5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-borde-app/50 px-8 py-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-texto-muted/20">
          {sesion.nombre} · El Buen Gusto
        </p>
      </footer>
    </div>
  );
}
