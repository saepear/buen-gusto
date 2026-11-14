import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatCOP, formatFecha, formatHora } from "@/lib/format";
import { ordenDeItem } from "@/lib/roles";
import { fotoPedidos, leerFotoPedidos } from "@/lib/recibo";
import { requerirRol } from "@/lib/session";
import { BotonImprimir } from "@/app/ordenes/comanda/[pedidoId]/boton-imprimir";

export const metadata = { title: "Recibo · El Buen Gusto" };

const METODO_TXT: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

/** Recibo de venta del cliente, imprimible en la impresora térmica de 80 mm */
export default async function PaginaRecibo(
  props: PageProps<"/admin/caja/recibo/[pagoId]">,
) {
  await requerirRol("ADMIN");
  const { pagoId: crudo } = await props.params;
  const id = Number.parseInt(crudo, 10);
  if (!Number.isInteger(id)) notFound();

  const pago = await db.pago.findUnique({
    where: { id },
    include: { pedido: { include: { mesa: true, items: { include: { producto: true } } } } },
  });
  if (!pago) notFound();

  // Los tickets nuevos conservan el lote exacto. Para los registros anteriores
  // solo es fiable la comanda enlazada; no se adivinan otros pedidos por fecha.
  const foto = leerFotoPedidos(pago.pedidosSnapshot);
  const pedidos = foto ?? fotoPedidos([pago.pedido]);

  return (
    <div className="min-h-screen bg-fondo-app py-8">
      <div data-print-ticket="" className="mx-auto w-full max-w-[340px] bg-white px-5 py-5 font-mono text-[13px] leading-relaxed text-brown-950 shadow-xl print:shadow-none">
        <div className="text-center">
          <p className="font-display text-xl font-bold tracking-wide">
            EL BUEN GUSTO
          </p>
          <p className="mt-0.5 text-[11px] font-bold tracking-widest">
            RECIBO DE VENTA
          </p>
        </div>

        <div className="my-3 border-t-2 border-dashed border-brown-950/40" />

        <div className="flex items-baseline justify-between">
          <span className="text-base font-bold">
            {pago.pedido.mesa.nombre}
          </span>
          <span className="text-base font-bold">PAGO #{pago.id}</span>
        </div>
        <p className="mt-1 text-[11px]">
          {formatFecha(pago.createdAt)} · {formatHora(pago.createdAt)}
        </p>
        {pago.cobradoPorNombre && <p className="text-[11px]">Cobró: {pago.cobradoPorNombre}</p>}
        {!foto && <p className="text-[10px]">Registro histórico: detalle de la comanda vinculada al pago.</p>}

        <div className="my-3 border-t border-dashed border-brown-950/30" />

        {pedidos.length === 0 ? (
          <p className="text-sm">Sin comandas en este recibo.</p>
        ) : null}

        {pedidos.map((pedido, indice) => (
          <div key={pedido.id} className={indice > 0 ? "mt-3" : ""}>
            <p className="text-[11px] font-bold uppercase tracking-wide">
              Comanda #{pedido.numero} · {formatHora(new Date(pedido.fecha))}
            </p>
            {pedido.paraLlevar ? (
              <p className="mt-0.5 text-[11px] font-bold tracking-widest">
                *** PARA LLEVAR · ICOPOR ***
              </p>
            ) : null}
            <ul className="mt-1 space-y-1.5">
              {[...pedido.items]
                .sort(
                  (a, b) =>
                    ordenDeItem(a.tipo) - ordenDeItem(b.tipo) || a.id - b.id,
                )
                .map((item) => (
                  <li key={item.id} className="flex gap-2 text-sm">
                    <span className="font-bold">{item.cantidad}×</span>
                    <span className="flex-1 font-bold uppercase">
                      {item.nombre}
                      {item.tipo === "PROTEINA" && item.conSopa === false
                        ? " (sin sopa)"
                        : ""}
                      {item.nota ? ` (${item.nota})` : ""}
                    </span>
                    {item.precio > 0 ? (
                      <span className="font-bold">
                        {formatCOP(item.precio * item.cantidad)}
                      </span>
                    ) : null}
                  </li>
                ))}
            </ul>
            {pedido.observaciones ? (
              <p className="mt-1 text-[11px]">📝 {pedido.observaciones}</p>
            ) : null}
          </div>
        ))}

        <div className="my-3 border-t border-dashed border-brown-950/30" />

        <div className="space-y-1 text-sm">
          <p className="flex justify-between">
            <span>Subtotal (almuerzo y extras)</span>
            <span className="font-bold">{formatCOP(pago.total)}</span>
          </p>
          <p className="flex justify-between">
            <span>Propina</span>
            <span className="font-bold">{formatCOP(pago.propina)}</span>
          </p>
        </div>

        <div className="my-2 border-t-2 border-dashed border-brown-950/40" />

        <p className="flex items-baseline justify-between text-base">
          <span className="font-bold">TOTAL</span>
          <span className="font-display text-2xl font-bold">
            {formatCOP(pago.total + pago.propina)}
          </span>
        </p>
        <p className="mt-1.5 text-sm">
          Método:{" "}
          <span className="font-bold">
            {METODO_TXT[pago.metodo] ?? pago.metodo}
          </span>
        </p>

        {/* El dinero real: con cuánto pagó y qué se le devolvió (efectivo) */}
        {pago.montoPagado !== null ? (
          <div className="mt-1.5 space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Recibido</span>
              <span className="font-bold">{formatCOP(pago.montoPagado)}</span>
            </p>
            <p className="flex justify-between">
              <span>Vueltas</span>
              <span className="font-bold">{formatCOP(pago.vueltas ?? 0)}</span>
            </p>
          </div>
        ) : null}

        <div className="my-3 border-t-2 border-dashed border-brown-950/40" />
        <p className="text-center text-[11px]">
          ¡Gracias por su visita!
          <br />
          El Buen Gusto
        </p>
      </div>

      <BotonImprimir leyenda="Imprimir recibo" volverHref="/admin/caja" />
    </div>
  );
}
