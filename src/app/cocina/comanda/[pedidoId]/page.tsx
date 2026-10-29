import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCOP, formatFecha, formatHora } from "@/lib/format";
import { precioUnitarioItem } from "@/lib/precios";
import { requerirRolDe } from "@/lib/session";
import { BotonImprimir } from "./boton-imprimir";

export const metadata = { title: "Comanda · El Buen Gusto" };

/** Ticket de comanda para la impresora térmica de 80 mm */
export default async function PaginaComanda(
  props: PageProps<"/cocina/comanda/[pedidoId]">,
) {
  await requerirRolDe(["COCINA", "ADMIN"]);
  const { pedidoId: crudo } = await props.params;
  const { reprint } = await props.searchParams;
  const id = Number.parseInt(crudo, 10);
  if (!Number.isInteger(id)) notFound();

  const esCopia = reprint === "1";

  const pedido = await db.pedido.findUnique({
    where: { id },
    include: {
      items: { include: { producto: true } },
      mesa: true,
      mesero: true,
    },
  });
  if (!pedido) notFound();

  const totalComanda = pedido.items.reduce(
    (suma, i) => suma + precioUnitarioItem(i) * i.cantidad,
    0,
  );

  return (
    <div className="min-h-screen bg-[#150d08] py-8">
      <div className="mx-auto w-full max-w-[340px] bg-white px-5 py-5 font-mono text-[13px] leading-relaxed text-brown-950 shadow-xl print:shadow-none">
        <div className="text-center">
          <p className="font-display text-xl font-bold tracking-wide">
            EL BUEN GUSTO
          </p>
          <p className="mt-0.5 text-[11px] font-bold tracking-widest">
            COMANDA DE COCINA
            {esCopia ? " · COPIA" : ""}
          </p>
        </div>

        <div className="my-3 border-t-2 border-dashed border-brown-950/40" />

        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold">
            MESA #{pedido.mesa.numero}
          </span>
          <span className="text-base font-bold">#{pedido.id}</span>
        </div>
        {pedido.paraLlevar ? (
          <p className="mt-1 text-center text-[11px] font-bold tracking-widest">
            *** PARA LLEVAR · ICOPOR ***
          </p>
        ) : null}
        <p className="mt-1 text-[11px]">
          {formatFecha(pedido.createdAt)} · {formatHora(pedido.createdAt)}
        </p>
        <p className="text-[11px]">Mesero: {pedido.mesero?.nombre ?? "—"}</p>

        <div className="my-3 border-t border-dashed border-brown-950/30" />

        <ul className="space-y-1.5">
          {pedido.items.map((item) => (
            <li key={item.id} className="flex gap-2 text-sm">
              <span className="font-bold">{item.cantidad}×</span>
              <span className="flex-1 font-bold uppercase">
                {item.producto.nombre}
                {item.tipo === "PROTEINA" && item.conSopa === false
                  ? " (sin sopa)"
                  : ""}
              </span>
              {precioUnitarioItem(item) > 0 ? (
                <span className="font-bold">
                  {formatCOP(precioUnitarioItem(item) * item.cantidad)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="my-3 border-t border-dashed border-brown-950/30" />

        {pedido.observaciones ? (
          <p className="text-sm font-bold">📝 Nota: {pedido.observaciones}</p>
        ) : null}

        <div className="my-3 border-t border-dashed border-brown-950/30" />

        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold">TOTAL COMANDA</span>
          <span className="font-bold">{formatCOP(totalComanda)}</span>
        </div>
        {pedido.paraLlevar ? (
          <p className="mt-0.5 text-[11px] font-bold">
            Icopor incluido · para llevar
          </p>
        ) : null}

        <div className="my-3 border-t-2 border-dashed border-brown-950/40" />
        <p className="text-center text-[11px]">
          ¡Buen provecho! · El Buen Gusto
        </p>
      </div>

      <BotonImprimir />
    </div>
  );
}
