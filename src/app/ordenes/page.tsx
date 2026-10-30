import { Clock, Printer, Search, ShoppingBag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatHora, claveDia } from "@/lib/format";
import { requerirRol } from "@/lib/session";
import { AutoRefresco } from "./refresco";
import { AccionesComanda } from "./botones-comanda";

export const metadata = { title: "Órdenes · El Buen Gusto" };

export default async function PaginaOrdenes(props: PageProps<"/ordenes">) {
  const sesion = await requerirRol("ADMIN");
  const { busqueda, fecha } = await props.searchParams;

  const dia = fecha ? String(fecha) : claveDia(new Date());

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
    where.OR = [{ mesa: { nombre: { contains: query } } }];
    if (/^\d+$/.test(query)) {
      where.OR.unshift({ id: Number.parseInt(query, 10) });
    }
  }

  const pedidos = await db.pedido.findMany({
    where,
    include: { items: { include: { producto: true } }, mesa: true, mesero: true },
    orderBy: { createdAt: "desc" },
  });

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
            <p className="mt-2 text-texto-muted/50">Control de flujo y despacho del restaurante</p>
          </div>

          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-texto-muted/35 transition-colors group-focus-within:text-amber-brand" />
              <input
                name="busqueda"
                defaultValue={busqueda}
                placeholder="Comanda o mesa..."
                className="h-12 w-64 rounded-2xl bg-panel-app pl-11 pr-4 text-sm text-texto-app outline-none ring-1 ring-borde-app transition focus:ring-amber-brand/50 placeholder:text-texto-muted/25"
              />
            </div>
            <input
              type="date"
              name="fecha"
              defaultValue={dia}
              className="h-12 rounded-2xl bg-panel-app px-4 text-sm text-texto-app outline-none ring-1 ring-borde-app transition focus:ring-amber-brand/50 [color-scheme:dark]"
            />
            <button
              type="submit"
              className="h-12 rounded-2xl bg-amber-brand px-8 font-display text-sm font-bold text-brown-950 transition hover:scale-[1.02] active:scale-95"
            >
              Actualizar
            </button>
          </form>
        </div>

        {pedidos.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center border-2 border-dashed border-borde-app rounded-[40px]">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-panel-app text-amber-brand/50">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="mt-6 font-display text-2xl text-texto-app">No hay registros</h3>
            <p className="mt-2 text-texto-muted/40">No se encontraron pedidos para los criterios seleccionados</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[32px] bg-panel-app p-1 ring-1 ring-borde-app shadow-2xl">
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
                        <span className="font-display text-xl text-amber-brand">#{pedido.id}</span>
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
                           pedido.estado === "COBRADO" ? "bg-panel-app text-texto-muted/40" :
                           pedido.estado === "CANCELADO" ? "bg-danger/10 text-danger-text ring-1 ring-danger/20" :
                           "bg-panel-app text-texto-muted/60")
                        }>
                          <span className={"h-1.5 w-1.5 rounded-full " + 
                            (pedido.estado === "ENVIADO" ? "bg-amber-brand" :
                             pedido.estado === "SERVIDO" ? "bg-success" :
                             pedido.estado === "CANCELADO" ? "bg-danger" : "bg-texto-muted/40")
                          }></span>
                          {pedido.estado === "COBRADO" ? "Atendido" : 
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
