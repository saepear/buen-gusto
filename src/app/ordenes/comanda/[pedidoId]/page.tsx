import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatHora } from "@/lib/format";
import { numeroVisible } from "@/lib/consecutivos";
import { nombreDeItem } from "@/lib/precios";
import { ordenDeItem } from "@/lib/roles";
import { requerirRolDe } from "@/lib/session";
import { BotonImprimir } from "./boton-imprimir";

export const metadata = { title: "Comanda · El Buen Gusto" };

/** Ticket de comanda para la impresora térmica de 80 mm */
export default async function PaginaComanda(
  props: PageProps<"/ordenes/comanda/[pedidoId]">,
) {
  // El ticket lo abre el ADMIN (tablero Órdenes) o el MESERO tras enviar
  // una comanda (autoPrint). El tablero /ordenes sigue siendo solo ADMIN.
  const sesion = await requerirRolDe(["ADMIN", "MESERO"]);
  const { pedidoId: crudo } = await props.params;
  const { volver } = await props.searchParams;
  const id = Number.parseInt(crudo, 10);
  if (!Number.isInteger(id)) notFound();

  const pedido = await db.pedido.findUnique({
    where: { id },
    include: {
      items: { include: { producto: true } },
      mesa: true,
      mesero: true,
      domicilio: true,
    },
  });
  if (!pedido) notFound();

  // La comanda se imprime agrupada por "platos" (grupo 1, 2...) y luego los extras (grupo 0).
  const itemsPorGrupo = pedido.items.reduce(
    (acc, item) => {
      const g = item.grupo;
      if (!acc[g]) acc[g] = [];
      acc[g].push(item);
      return acc;
    },
    {} as Record<number, (typeof pedido.items)[0][]>,
  );

  // Ordenar los grupos (1, 2, 3... y al final el 0 para extras)
  const gruposOrdenados = Object.keys(itemsPorGrupo)
    .map(Number)
    .sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    });

  const nombreMesa = pedido.domicilio
    ? "DOMICILIO"
    : pedido.paraLlevar
      ? "LLEVAR"
      : pedido.mesa.nombre;

  return (
    <div className="min-h-screen bg-fondo-app py-8">
      <div data-print-ticket="" className="mx-auto w-full max-w-[340px] bg-white px-8 py-10 font-mono text-[14px] leading-relaxed text-brown-950 shadow-xl print:shadow-none">
        <div className="text-center">
          <p className="text-3xl font-black uppercase tracking-tighter">
            {nombreMesa}
          </p>
          <div className="mt-2 flex flex-col items-center text-[12px] font-bold">
            <p>HORA: {formatHora(pedido.createdAt)}</p>
            <p className="mt-1">PEDIDO: #{numeroVisible(pedido)}</p>
          </div>
        </div>

        <div className="my-4 border-t-2 border-dashed border-brown-950/60" />

        {gruposOrdenados.map((grupoId, idx) => {
          const items = itemsPorGrupo[grupoId].sort(
            (a, b) => ordenDeItem(a.tipo) - ordenDeItem(b.tipo) || a.id - b.id,
          );

          return (
            <div key={grupoId} className={idx > 0 ? "mt-6" : ""}>
              {grupoId > 0 && gruposOrdenados.filter((g) => g > 0).length > 1 && (
                <p className="mb-2 text-center text-[11px] font-black tracking-widest">
                  --- PEDIDO {grupoId} ---
                </p>
              )}
              {grupoId === 0 && (
                <p className="mb-2 text-center text-[11px] font-black tracking-widest uppercase">
                  ---{" "}
                  {items.some((i) => i.tipo === "BEBIDA") && items.some((i) => i.tipo !== "BEBIDA")
                    ? "Extras / Bebidas"
                    : items.some((i) => i.tipo === "BEBIDA")
                      ? "Bebidas"
                      : "Extras"}{" "}
                  ---
                </p>
              )}
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.id} className="flex flex-col">
                    <span className="font-black uppercase">
                      {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                      {nombreDeItem(item)}
                    </span>
                    {item.nota && (
                      <span className="text-[11px] font-bold italic text-brown-800/80 ml-4">
                        ↳ {item.nota}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="my-4 border-t-2 border-dashed border-brown-950/60" />

        {pedido.observaciones ? (
          <div className="text-right">
            <p className="text-[12px] font-bold">
              Nota: <span className="font-normal">{pedido.observaciones}</span>
            </p>
          </div>
        ) : null}

        {pedido.domicilio && (
          <div className="mt-4 border-l-4 border-brown-900/20 pl-3 text-[12px]">
            <p className="font-black uppercase text-[10px] tracking-widest opacity-60">
              Datos de entrega
            </p>
            <p className="font-bold">Cliente: {pedido.domicilio.cliente}</p>
            <p>Dir: {pedido.domicilio.direccion}</p>
            {pedido.domicilio.barrio && <p>Barrio: {pedido.domicilio.barrio}</p>}
            {pedido.domicilio.telefono && <p>Tel: {pedido.domicilio.telefono}</p>}
          </div>
        )}

        <p className="mt-10 text-center text-[10px] font-bold uppercase tracking-widest opacity-40">
          ¡Buen provecho! · El Buen Gusto
        </p>
      </div>

      <BotonImprimir
        volverHref={
          typeof volver === "string" && volver.startsWith("/") && !volver.startsWith("//")
            ? volver
            : sesion.rol === "ADMIN"
              ? "/ordenes"
              : "/mesero"
        }
      />
    </div>
  );
}
