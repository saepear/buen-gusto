import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { menuDeHoy } from "@/lib/pedido";
import { requerirRol } from "@/lib/session";
import { EncabezadoMesero } from "../../../encabezado";
import { FormularioPedido } from "./formulario-pedido";

export const metadata = { title: "Nuevo almuerzo · El Buen Gusto" };

export default async function PaginaNuevoPedido(
  props: PageProps<"/mesero/mesa/[mesaId]/nuevo">,
) {
  const sesion = await requerirRol("MESERO");
  const { mesaId: crudo } = await props.params;
  const mesaId = Number.parseInt(crudo, 10);
  if (!Number.isInteger(mesaId)) notFound();

  const mesa = await db.mesa.findFirst({ where: { id: mesaId, activa: true } });
  if (!mesa) notFound();

  const [menu, extras] = await Promise.all([
    menuDeHoy(),
    db.producto.findMany({
      where: { activo: true, tipo: { in: ["BEBIDA", "ADICIONAL"] } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const volver = `/mesero/mesa/${mesa.id}`;

  if (menu.length === 0) {
    return (
      <div className="min-h-screen bg-cream-100">
        <EncabezadoMesero
          usuario={sesion.nombre}
          titulo={`Mesa #${mesa.numero}`}
          volver={{ href: "/mesero", texto: "Mesas" }}
        />
        <main className="mx-auto max-w-lg sm:max-w-2xl p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col items-center gap-2.5 rounded-3xl border-2 border-dashed border-brown-600/20 bg-white p-10 text-center shadow-suave">
            <UtensilsCrossed className="h-8 w-8 text-brown-300" />
            <p className="font-display text-xl text-brown-800">
              Todavía no hay menú para hoy
            </p>
            <p className="text-sm text-brown-600">
              Avísale al administrador para que arme el menú del día antes de
              tomar pedidos.
            </p>
            <Link
              href={volver}
              className="mt-4 flex items-center gap-2 rounded-2xl bg-brown-800 px-5 py-3 font-display text-md text-cream-100 shadow-suave transition hover:bg-amber-brand hover:text-brown-950 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a la mesa
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <EncabezadoMesero
        usuario={sesion.nombre}
        titulo={`Mesa #${mesa.numero} · Nuevo almuerzo`}
        volver={{ href: volver, texto: "Mesa" }}
      />

      <FormularioPedido
        mesa={{ id: mesa.id, numero: mesa.numero }}
        menu={menu}
        extras={extras.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          precio: p.precio,
        }))}
      />
    </div>
  );
}
