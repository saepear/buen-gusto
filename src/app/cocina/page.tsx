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

  const where: any = {
    createdAt: {
      gte: new Date(dia + "T00:00:00"),
      lte: new Date(dia + "T23:59:59"),
    },
  };

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
    <div className="flex min-h-screen flex-col bg-[#150d08] text-cream-100">
      <header className="flex items-center justify-between border-b border-brown-700/60 px-5 py-3.5 cabeza-seguro">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={44} height={44} unoptimized />
          <div>
            <p className="font-display leading-none text-amber-brand">
              Gestión de Comandas
            </p>
            <p className="mt-1 text-xs text-cream-200/70">
              Consulta, control e impresión de pedidos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <AutoRefresco segundos={30} />
          {esAdmin ? (
            <Link
              href="/admin"
              className="rounded-lg bg-brown-800 px-3 py-2 text-xs font-bold text-cream-100 transition hover:bg-amber-brand hover:text-brown-950"
            >
              Volver al panel
            </Link>
          ) : (
            <form action={cerrarSesion}>
              <button className="rounded-lg bg-brown-800 px-3 py-2 text-xs font-bold text-cream-100 transition hover:bg-danger">
                Salir
              </button>
            </form>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 p-5 pie-seguro">
        {/* Barra de búsqueda y filtros */}
        <section className="mb-6 rounded-3xl bg-brown-900/40 p-5 ring-1 ring-brown-700/50">
          <form method="GET" className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[240px]">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-cream-200/50">
                Buscar comanda o mesa
              </label>
              <div className="flex items-center gap-2.5 rounded-2xl bg-brown-800/50 px-4 py-3 ring-1 ring-brown-700 focus-within:ring-amber-brand">
                <Search className="h-4 w-4 text-brown-400" />
                <input
                  name="busqueda"
                  defaultValue={busqueda}
                  placeholder="Ej: 105 o Mesa 4..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-brown-500"
                />
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-cream-200/50">
                Fecha
              </label>
              <input
                type="date"
                name="fecha"
                defaultValue={dia}
                className="w-full rounded-2xl bg-brown-800/50 px-4 py-3 text-sm ring-1 ring-brown-700 focus:ring-amber-brand outline-none [color-scheme:dark]"
              />
            </div>
            <button
              type="submit"
              className="rounded-2xl bg-amber-brand px-6 py-3 font-display text-brown-950 transition hover:bg-orange-brand hover:text-white active:scale-95"
            >
              Filtrar
            </button>
            { (busqueda || fecha !== claveDia(new Date())) && (
              <Link
                href="/cocina"
                className="rounded-2xl border border-brown-700 px-6 py-3 text-sm font-bold text-cream-200/70 transition hover:bg-brown-800"
              >
                Limpiar
              </Link>
            )}
          </form>
        </section>

        {pedidos.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brown-800 text-amber-brand">
              <Clock className="h-10 w-10" />
            </span>
            <h1 className="mt-6 font-display text-2xl text-cream-100">
              No se encontraron comandas
            </h1>
            <p className="mt-2 text-sm text-cream-200/60">
              Prueba ajustando la búsqueda o la fecha elegida.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-brown-900/40 shadow-xl ring-1 ring-brown-700/50">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-brown-800/60 text-[10px] font-bold uppercase tracking-widest text-cream-200/50">
                <tr>
                  <th className="px-6 py-4">Comanda</th>
                  <th className="px-6 py-4">Mesa</th>
                  <th className="px-6 py-4">Hora</th>
                  <th className="px-6 py-4">Mesero</th>
                  <th className="px-6 py-4">Estado</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brown-700/50">
                {pedidos.map((pedido) => (
                  <tr key={pedido.id} className="transition hover:bg-brown-800/30">
                    <td className="px-6 py-4">
                      <span className="font-display text-lg text-amber-brand">#{pedido.id}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-cream-100">
                      Mesa #{pedido.mesa.numero}
                      {pedido.paraLlevar && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-orange-brand/20 px-1.5 py-0.5 text-[9px] font-bold text-orange-brand">
                          LLEVAR
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-cream-200/70">
                      {formatHora(pedido.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-cream-200/70">
                      {pedido.mesero?.nombre ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={
                        "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                        (pedido.estado === "ENVIADO" ? "bg-amber-brand/20 text-amber-brand" :
                         pedido.estado === "SERVIDO" ? "bg-success/20 text-[#a7dd83]" :
                         pedido.estado === "COBRADO" ? "bg-brown-700 text-cream-200/60" :
                         "bg-brown-800 text-cream-200/80")
                      }>
                        {pedido.estado.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/cocina/comanda/${pedido.id}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-brown-800 text-cream-100 transition hover:bg-amber-brand hover:text-brown-950"
                          title="Ver detalle"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/cocina/comanda/${pedido.id}?autoPrint=1&reprint=1`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl bg-brown-800 text-cream-100 transition hover:bg-orange-brand"
                          title="Reimprimir (Copia)"
                        >
                          <Printer className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
