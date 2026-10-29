import { Clock, Eye, Flame, Printer, Search, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { precioUnitarioItem } from "@/lib/precios";
import { inicioDeHoy } from "@/lib/pedido";
import { formatCOP, formatHora, claveDia } from "@/lib/format";
import { ESTADO_PEDIDO } from "@/lib/roles";
import { requerirRolDe } from "@/lib/session";
import { cerrarSesion } from "@/app/login/actions";
import { empezarComanda, terminarComanda, cancelarComanda } from "./acciones";
import { AutoRefresco } from "./refresco";

export const metadata = { title: "Gestión de Comandas · El Buen Gusto" };

export default async function PaginaCocina(
  props: PageProps<"/cocina">,
) {
  const sesion = await requerirRolDe(["COCINA", "ADMIN"]);
  const { busqueda, fecha } = await props.searchParams;
  const esAdmin = sesion.rol === "ADMIN";

  const dia = fecha ? String(fecha) : claveDia(new Date());

  const cierre = await db.cierreCaja.findUnique({ where: { fecha: dia } });

  const where: any = {
    createdAt: {
      gte: new Date(dia + "T00:00:00"),
      lte: new Date(dia + "T23:59:59"),
    },
  };

  if (cierre) {
    // Si hay cierre, solo mostramos las comandas activas (si quedaran)
    // O mejor aún, no mostramos nada histórico si el día ya cerró operativamente
    where.estado = { in: ["ENVIADO", "EN_PREPARACION", "PARCIAL_SERVIDO", "SERVIDO", "POR_PAGAR"] };
  }

  if (busqueda) {
    const query = String(busqueda).trim();
    const esNumero = /^\d+$/.test(query);
    if (esNumero) {
      where.OR = [
        { id: Number.parseInt(query, 10) },
        { mesa: { numero: Number.parseInt(query, 10) } },
      ];
    }
  }

  const pedidos = await db.pedido.findMany({
    where,
    include: { items: { include: { producto: true } }, mesa: true, mesero: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-screen flex-col bg-[#0f0a07] text-cream-100 font-sans selection:bg-amber-brand/30">
      {/* Navbar Minimalista */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/5 bg-[#0f0a07]/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-1 rounded-full bg-amber-brand/20 blur-sm"></div>
            <Image src="/logo.png" alt="Logo" width={42} height={42} className="relative rounded-full" unoptimized />
          </div>
          <div>
            <h1 className="font-display text-lg tracking-tight text-white">
              Gestión de Comandas
            </h1>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"></span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-cream-200/40">
                Sistema Operativo en Vivo
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <AutoRefresco segundos={30} />
          </div>
          {esAdmin ? (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-cream-100 transition hover:bg-amber-brand hover:text-brown-950"
            >
              Panel Admin
            </Link>
          ) : (
            <form action={cerrarSesion}>
              <button className="rounded-xl bg-white/5 px-4 py-2 text-xs font-bold text-cream-100 transition hover:bg-danger/20 hover:text-danger">
                Cerrar Sesión
              </button>
            </form>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-6 lg:p-10">
        {/* Header de Sección y Filtros */}
        <div className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-4xl text-white">Órdenes</h2>
            <p className="mt-2 text-cream-200/50">Control de flujo y despacho del restaurante</p>
          </div>
          
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-500 transition-colors group-focus-within:text-amber-brand" />
              <input
                name="busqueda"
                defaultValue={busqueda}
                placeholder="Comanda o mesa..."
                className="h-12 w-64 rounded-2xl bg-white/5 pl-11 pr-4 text-sm text-white outline-none ring-1 ring-white/10 transition focus:ring-amber-brand/50 placeholder:text-brown-600"
              />
            </div>
            <input
              type="date"
              name="fecha"
              defaultValue={dia}
              className="h-12 rounded-2xl bg-white/5 px-4 text-sm text-white outline-none ring-1 ring-white/10 transition focus:ring-amber-brand/50 [color-scheme:dark]"
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
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center border-2 border-dashed border-white/5 rounded-[40px]">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-amber-brand/50">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <h3 className="mt-6 font-display text-2xl text-white">No hay registros</h3>
            <p className="mt-2 text-cream-200/40">No se encontraron pedidos para los criterios seleccionados</p>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[32px] bg-white/[0.02] p-1 ring-1 ring-white/10 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/30">
                    <th className="px-8 py-6">ID</th>
                    <th className="px-8 py-6">Origen</th>
                    <th className="px-8 py-6">Registro</th>
                    <th className="px-8 py-6">Responsable</th>
                    <th className="px-8 py-6">Estado Actual</th>
                    <th className="px-8 py-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pedidos.map((pedido) => (
                    <tr key={pedido.id} className="group transition-colors hover:bg-white/[0.03]">
                      <td className="px-8 py-6">
                        <span className="font-display text-xl text-amber-brand">#{pedido.id}</span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 font-display text-white">
                            {pedido.mesa.numero}
                          </div>
                          <div>
                            <p className="font-bold text-white text-base">Mesa {pedido.mesa.numero}</p>
                            {pedido.paraLlevar && (
                              <span className="text-[9px] font-black uppercase tracking-tighter text-orange-brand">Empaque Icopor</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-cream-200/60">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{formatHora(pedido.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-cream-200/80">{pedido.mesero?.nombre ?? "Sistema"}</p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={
                          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider " +
                          (pedido.estado === "ENVIADO" ? "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20" :
                           pedido.estado === "SERVIDO" ? "bg-success/10 text-[#a7dd83] ring-1 ring-success/20" :
                           pedido.estado === "COBRADO" ? "bg-white/5 text-cream-200/40" :
                           pedido.estado === "CANCELADO" ? "bg-danger/10 text-danger ring-1 ring-danger/20" :
                           "bg-white/5 text-cream-200/60")
                        }>
                          <span className={"h-1.5 w-1.5 rounded-full " + 
                            (pedido.estado === "ENVIADO" ? "bg-amber-brand" :
                             pedido.estado === "SERVIDO" ? "bg-success" :
                             pedido.estado === "CANCELADO" ? "bg-danger" : "bg-cream-200/40")
                          }></span>
                          {pedido.estado === "COBRADO" ? "Atendido" : 
                           pedido.estado === "CANCELADO" ? "Cancelado" :
                           pedido.estado.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <Link
                          href={`/cocina/comanda/${pedido.id}`}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white transition hover:bg-amber-brand hover:text-brown-950 hover:scale-110 active:scale-95 shadow-lg"
                          title="Gestionar Comanda"
                        >
                          <Printer className="h-5 w-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-white/5 px-8 py-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cream-200/20">
          El Buen Gusto · 2024 · Premium Restaurant Management
        </p>
      </footer>
    </div>
  );
}
