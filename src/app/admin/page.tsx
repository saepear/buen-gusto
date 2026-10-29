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

      <div className="rounded-3xl bg-brown-800 p-8 text-cream-100 shadow-lg shadow-brown-800/20">
        <h2 className="font-display text-2xl text-amber-brand">
          Bienvenido al sistema de El Buen Gusto
        </h2>
        <p className="mt-2 max-w-2xl text-cream-200/85">
          El circuito ya está completo: login por roles, catálogo real, menú del
          día con porciones en vivo y comandas que viajan del mesero a la
          pantalla de la cocina. Así trabaja cada integrante:
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          <li className="rounded-2xl bg-brown-700/70 p-4">
            <UtensilsCrossed className="h-6 w-6 text-amber-brand" />
            <p className="mt-2 font-bold">Mesero</p>
            <p className="mt-1 text-sm text-cream-200/80">
              Toma el pedido desde su teléfono y lo envía a cocina al instante.
            </p>
          </li>
          <li className="rounded-2xl bg-brown-700/70 p-4">
            <ChefHat className="h-6 w-6 text-amber-brand" />
            <p className="mt-2 font-bold">Cocina</p>
            <p className="mt-1 text-sm text-cream-200/80">
              Recibe la comanda en su pantalla KDS y la imprime en el ticket.
            </p>
          </li>
          <li className="rounded-2xl bg-brown-700/70 p-4">
            <CalendarDays className="h-6 w-6 text-amber-brand" />
            <p className="mt-2 font-bold">Tú (admin)</p>
            <p className="mt-1 text-sm text-cream-200/80">
              Armas el menú del día, controlas el stock y cobras las mesas.
            </p>
          </li>
        </ul>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          {
            t: "Prueba el circuito completo",
            d: "Entra como mesero con el PIN 1111, toma un pedido en una mesa y mira cómo la comanda aparece al instante en la cocina (PIN 3333).",
          },
          {
            t: "PINs del equipo",
            d: "Admin 1234 · Meseros 1111/2222 · Cocina 3333. Los stock del menú del día se descuentan al volar la comanda.",
          },
        ].map((tip) => (
          <a key={tip.t} href="/admin/mesas" className="block">
            <div className="h-full rounded-2xl bg-white p-5 ring-1 ring-cream-300 transition hover:ring-amber-brand">
              <p className="font-bold text-brown-800">{tip.t}</p>
              <p className="mt-1 text-sm text-brown-600">{tip.d}</p>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
