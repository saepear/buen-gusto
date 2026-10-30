import { CalendarDays, ChefHat, UtensilsCrossed } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { requerirRol } from "@/lib/session";
import { formatFecha } from "@/lib/format";

export default async function AdminInicio() {
  const sesion = await requerirRol("ADMIN");
  const ahora = new Date();

  return (
    <>
      <EncabezadoPagina
        titulo={`¡Hola, ${sesion.nombre}!`}
        subtitulo={formatFecha(ahora)}
      />

      <div className="rounded-[2rem] bg-glass-app p-8 text-texto-app ring-1 ring-borde-app">
        <h2 className="font-display text-2xl text-amber-brand">
          Bienvenido al sistema de El Buen Gusto
        </h2>
        <p className="mt-2 max-w-2xl text-texto-muted/85">
          El circuito ya está completo: login por roles, catálogo real, menú del
          día con porciones en vivo y comandas que viajan del mesero al tablero
          de órdenes. Así trabaja cada integrante:
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          <li className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
            <UtensilsCrossed className="h-6 w-6 text-amber-brand" />
            <p className="mt-2 font-bold">Mesero</p>
            <p className="mt-1 text-sm text-texto-muted/80">
              Toma el pedido desde su teléfono y lo envía al instante.
            </p>
          </li>
          <li className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
            <ChefHat className="h-6 w-6 text-amber-brand" />
            <p className="mt-2 font-bold">Órdenes</p>
            <p className="mt-1 text-sm text-texto-muted/80">
              El administrador ve cada comanda en su tablero en vivo y la
              imprime en el ticket.
            </p>
          </li>
          <li className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
            <CalendarDays className="h-6 w-6 text-amber-brand" />
            <p className="mt-2 font-bold">Tú (admin)</p>
            <p className="mt-1 text-sm text-texto-muted/80">
              Armas el menú del día, controlas el stock y cobras las mesas.
            </p>
          </li>
        </ul>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          {
            t: "Prueba el circuito completo",
            d: "Entra como mesero con el PIN 1111, toma un pedido en una mesa y mira cómo la comanda aparece al instante en el tablero de órdenes.",
          },
          {
            t: "PINs del equipo",
            d: "Admin 1234 · Meseros 1111/2222 · Domiciliario 4444. Los stock del menú del día se descuentan al enviar la comanda.",
          },
        ].map((tip) => (
          <a key={tip.t} href="/admin/mesas" className="block">
            <div className="h-full rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app transition hover:ring-amber-brand/50">
              <p className="font-bold text-texto-app">{tip.t}</p>
              <p className="mt-1 text-sm text-texto-muted/70">{tip.d}</p>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}

