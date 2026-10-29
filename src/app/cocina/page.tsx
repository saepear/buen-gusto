import { Clock, Eye, Flame, Printer, ShoppingBag, UtensilsCrossed, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { precioUnitarioItem } from "@/lib/precios";
import { inicioDeHoy } from "@/lib/pedido";
import { formatCOP, formatHora } from "@/lib/format";
import { ESTADO_PEDIDO } from "@/lib/roles";
import { requerirRolDe } from "@/lib/session";
import { cerrarSesion } from "@/app/login/actions";
import { empezarComanda, terminarComanda, cancelarComanda } from "./acciones";
import { AutoRefresco } from "./refresco";

export const metadata = { title: "Cocina · El Buen Gusto" };

const TIPO_COLOR: Record<string, string> = {
  PROTEINA: "bg-amber-brand/20 text-amber-brand",
  PRINCIPIO: "bg-success/20 text-[#a7dd83]",
  ENSALADA: "bg-[#4ec27e]/25 text-[#8ce8ae]",
  SOPA: "bg-[#b06fd0]/25 text-[#d8a6f0]",
  BEBIDA: "bg-[#4aa3ff]/20 text-[#8cc7ff]",
  ADICIONAL: "bg-[#d08050]/25 text-[#f0b58c]",
};

const COLUMNA: Record<
  string,
  { titulo: string; sub: string; borde: string }
> = {
  ENVIADO: {
    titulo: "Por cocinar",
    sub: "Comandas recién enviadas",
    borde: "border-amber-brand/40",
  },
  EN_PREPARACION: {
    titulo: "En la olla",
    sub: "Pedidos en preparación",
    borde: "border-[#4aa3ff]/40",
  },
  SERVIDO: {
    titulo: "Listas para servir",
    sub: "Listas para llevar a la mesa",
    borde: "border-success/40",
  },
};

export default async function PaginaCocina() {
  const sesion = await requerirRolDe(["COCINA", "ADMIN"]);
  const esAdmin = sesion.rol === "ADMIN";

  const pedidos = await db.pedido.findMany({
    where: {
      estado: {
        in: [
          ESTADO_PEDIDO.ENVIADO,
          ESTADO_PEDIDO.EN_PREPARACION,
          ESTADO_PEDIDO.SERVIDO,
        ],
      },
      createdAt: { gte: inicioDeHoy() },
    },
    include: { items: { include: { producto: true } }, mesa: true, mesero: true },
    orderBy: { createdAt: "asc" },
  });

  const hace = (fecha: Date) => {
    const min = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
    return min === 0 ? "recién" : `hace ${min} min`;
  };

  const Tarjeta = ({ pedido }: { pedido: (typeof pedidos)[number] }) => (
    <article
      className={
        "rounded-2xl border-2 bg-brown-900/60 p-4 " +
        (COLUMNA[pedido.estado]?.borde ?? "border-brown-700/50")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl leading-none text-cream-100">
            Mesa #{pedido.mesa.numero}
          </p>
          <p className="mt-1.5 text-xs text-cream-200/70">
            #{pedido.id} · {formatHora(pedido.createdAt)} · {hace(pedido.createdAt)}
          </p>
          {pedido.paraLlevar ? (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-brand px-2.5 py-0.5 text-[10px] font-bold text-brown-950">
              <ShoppingBag className="h-3 w-3" /> PARA LLEVAR · icopor
            </span>
          ) : null}
        </div>
        <Link
          href={`/cocina/comanda/${pedido.id}`}
          className="rounded-xl bg-brown-800 px-2.5 py-2 text-cream-100 transition hover:bg-amber-brand hover:text-brown-950"
          aria-label={`Imprimir comanda ${pedido.id}`}
          title="Imprimir comanda"
        >
          <Printer className="h-4.5 w-4.5" />
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5">
        {pedido.items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span
              className={
                "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase " +
                (TIPO_COLOR[item.tipo] ?? "bg-brown-700/60 text-cream-200")
              }
            >
              {item.tipo === "PROTEINA"
                ? "Prot"
                : item.tipo === "PRINCIPIO"
                  ? "Prin"
                  : item.tipo === "ENSALADA"
                    ? "Ens"
                    : item.tipo === "SOPA"
                      ? "Sopa"
                      : item.tipo === "BEBIDA"
                        ? "Beb"
                        : "Adic"}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold text-cream-100">
              {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
              {item.producto.nombre}
            </span>
            {item.conSopa === false ? (
              <span className="rounded-md bg-brown-700/50 px-1.5 py-0.5 text-[10px] font-bold text-cream-200/80">
                sin sopa
              </span>
            ) : null}
            {precioUnitarioItem(item) > 0 ? (
              <span className="text-xs text-cream-200/75">
                {formatCOP(precioUnitarioItem(item) * item.cantidad)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {pedido.observaciones ? (
        <p className="mt-3 rounded-xl bg-amber-brand/10 px-3 py-2 text-xs font-bold text-amber-brand">
          📝 {pedido.observaciones}
        </p>
      ) : null}

      <div className="mt-4">
        {esAdmin ? (
          <p
            className={
              "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold " +
              (pedido.estado === ESTADO_PEDIDO.ENVIADO
                ? "bg-amber-brand/10 text-amber-brand"
                : pedido.estado === ESTADO_PEDIDO.EN_PREPARACION
                  ? "bg-[#4aa3ff]/15 text-[#8cc7ff]"
                  : "bg-success/15 text-[#a7dd83]")
            }
          >
            <Eye className="h-4 w-4" />
            {pedido.estado === ESTADO_PEDIDO.ENVIADO
              ? "En cola: cocina no la ha empezado"
              : pedido.estado === ESTADO_PEDIDO.EN_PREPARACION
                ? "En preparación en este momento"
                : "Listo: en camino a la mesa"}
          </p>
        ) : pedido.estado === ESTADO_PEDIDO.ENVIADO ? (
          <>
            <form action={empezarComanda} className="flex-1">
              <input type="hidden" name="pedidoId" value={pedido.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-brand py-2.5 font-bold text-brown-950 transition hover:bg-orange-brand hover:text-white"
              >
                <Flame className="h-4 w-4" /> Empezar
              </button>
            </form>
            <form action={cancelarComanda}>
              <input type="hidden" name="pedidoId" value={pedido.id} />
              <button
                type="submit"
                aria-label={`Cancelar comanda ${pedido.id}`}
                title="Cancelar (devuelve las porciones)"
                className="rounded-xl border border-danger/40 px-3 py-2.5 text-danger transition hover:bg-danger/20"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </form>
          </>
        ) : pedido.estado === ESTADO_PEDIDO.EN_PREPARACION ? (
          <>
            <form action={terminarComanda} className="flex-1">
              <input type="hidden" name="pedidoId" value={pedido.id} />
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-success py-2.5 font-bold text-brown-950 transition hover:bg-[#8fca57]"
              >
                Listo ✓
              </button>
            </form>
            <form action={cancelarComanda}>
              <input type="hidden" name="pedidoId" value={pedido.id} />
              <button
                type="submit"
                aria-label={`Cancelar comanda ${pedido.id}`}
                title="Cancelar (devuelve las porciones)"
                className="rounded-xl border border-danger/40 px-3 py-2.5 text-danger transition hover:bg-danger/20"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </form>
          </>
        ) : pedido.estado === ESTADO_PEDIDO.SERVIDO ? (
          <p className="flex w-full items-center justify-center gap-2 rounded-xl bg-success/15 py-2 text-sm font-bold text-[#a7dd83]">
            <UtensilsCrossed className="h-4 w-4" /> Llevar a la mesa
          </p>
        ) : null}
      </div>
    </article>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#150d08] text-cream-100">
      <header className="flex items-center justify-between border-b border-brown-700/60 px-5 py-3.5 cabeza-seguro">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={44} height={44} unoptimized />
          <div>
            <p className="font-display leading-none text-amber-brand">
              Comandas · Cocina
            </p>
            <p className="mt-1 text-xs text-cream-200/70">
              {esAdmin ? (
                <>
                  Seguimiento en vivo · vista de solo lectura para{" "}
                  {sesion.nombre}
                </>
              ) : (
                `${sesion.nombre} conectado`
              )}
            </p>
          </div>
          {esAdmin ? (
            <span className="flex items-center gap-1 rounded-full bg-amber-brand/15 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-brand ring-1 ring-amber-brand/40">
              <Eye className="h-3 w-3" /> Solo mirar
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <AutoRefresco segundos={20} />
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
        {pedidos.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-brown-800 text-amber-brand">
              <Clock className="h-12 w-12" />
            </span>
            <h1 className="mt-6 font-display text-3xl">
              Sin comandas por ahora
            </h1>
            <p className="mt-3 max-w-md text-cream-200/80">
              Cuando un mesero presione «Ordenar», su comanda aparece aquí al
              instante con la mesa, los platos y la nota si la lleva.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              ESTADO_PEDIDO.ENVIADO,
              ESTADO_PEDIDO.EN_PREPARACION,
              ESTADO_PEDIDO.SERVIDO,
            ].map((estado) => {
              const lista = pedidos.filter((p) => p.estado === estado);
              const col = COLUMNA[estado];
              return (
                <section key={estado} aria-label={col.titulo}>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="font-display text-xl text-cream-100">
                      {col.titulo}
                    </h2>
                    <span className="rounded-full bg-brown-800 px-3 py-0.5 text-sm font-bold text-amber-brand">
                      {lista.length}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-cream-200/60">{col.sub}</p>
                  <div className="space-y-4">
                    {lista.map((pedido) => (
                      <Tarjeta key={pedido.id} pedido={pedido} />
                    ))}
                    {lista.length === 0 ? (
                      <p className="rounded-2xl border-2 border-dashed border-brown-700/40 p-6 text-center text-sm text-cream-200/40">
                        Nada aquí
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
