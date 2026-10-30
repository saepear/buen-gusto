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
      <div className="min-h-screen bg-fondo-app">
        <EncabezadoMesero
          usuario={sesion.nombre}
          titulo={mesa.nombre}
          volver={{ href: "/mesero", texto: "Mesas" }}
        />
        <main className="mx-auto max-w-lg sm:max-w-2xl p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col items-center gap-2.5 rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center ring-1 ring-borde-app shadow-2xl">
            <UtensilsCrossed className="h-8 w-8 text-texto-muted/35" />
            <p className="font-display text-xl text-texto-app">
              Todavía no hay menú para hoy
            </p>
            <p className="text-sm text-texto-muted/70">
              Avísale al administrador para que arme el menú del día antes de
              tomar pedidos.
            </p>
            <Link
              href={volver}
              className="mt-4 flex items-center gap-2 rounded-2xl bg-panel-app px-5 py-3 font-display text-md text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover hover:text-texto-app active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" /> Volver a la mesa
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-fondo-app">
      <EncabezadoMesero
        usuario={sesion.nombre}
        titulo={`${mesa.nombre} · Nuevo almuerzo`}
        volver={{ href: volver, texto: "Mesa" }}
      />

      <FormularioPedido
        mesa={{ id: mesa.id, nombre: mesa.nombre }}
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
