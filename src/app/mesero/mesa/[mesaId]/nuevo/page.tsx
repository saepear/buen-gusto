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
      <div className="min-h-screen bg-fondo-kds">
        <EncabezadoMesero
          usuario={sesion.nombre}
          titulo={`Mesa #${mesa.numero}`}
          volver={{ href: "/mesero", texto: "Mesas" }}
        />
        <main className="mx-auto max-w-lg sm:max-w-2xl p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col items-center gap-2.5 rounded-[2rem] border-2 border-dashed border-white/10 bg-white/[0.02] p-10 text-center ring-1 ring-white/10 shadow-2xl">
            <UtensilsCrossed className="h-8 w-8 text-cream-200/35" />
            <p className="font-display text-xl text-white">
              Todavía no hay menú para hoy
            </p>
            <p className="text-sm text-cream-200/70">
              Avísale al administrador para que arme el menú del día antes de
              tomar pedidos.
            </p>
            <Link
              href={volver}
              className="mt-4 flex items-center gap-2 rounded-2xl bg-white/5 px-5 py-3 font-display text-md text-cream-100 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a la mesa
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fondo-kds">
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
