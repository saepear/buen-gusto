import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { menuDeHoy } from "@/lib/pedido";
import { FormularioPedido } from "@/app/mesero/mesa/[mesaId]/nuevo/formulario-pedido";
import { crearDomicilio } from "../actions";

export const metadata = { title: "Nuevo domicilio · El Buen Gusto" };

const VOLVER = "/admin/domicilios";

export default async function PaginaNuevoDomicilio() {
  const [menu, extras] = await Promise.all([
    menuDeHoy(),
    db.producto.findMany({
      where: { activo: true, tipo: { in: ["BEBIDA", "ADICIONAL"] } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (menu.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-2.5 rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center ring-1 ring-borde-app">
        <UtensilsCrossed className="h-8 w-8 text-texto-muted/35" />
        <p className="font-display text-xl text-texto-app">
          Todavía no hay menú para hoy
        </p>
        <p className="text-sm text-texto-muted/70">
          Arma el menú del día antes de crear domicilios.
        </p>
        <Link
          href="/admin/menu-dia"
          className="mt-4 flex items-center gap-2 rounded-2xl bg-panel-app px-5 py-3 font-display text-md text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
        >
          <UtensilsCrossed className="h-4 w-4" /> Ir al menú del día
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href={VOLVER}
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-texto-muted/60 transition hover:text-texto-app"
      >
        <ArrowLeft className="h-4 w-4" /> Domicilios
      </Link>

      <FormularioPedido
        mesa={{ id: 0, nombre: "Domicilio" }}
        menu={menu}
        extras={extras.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          precio: p.precio,
        }))}
        modo="domicilio"
        accion={crearDomicilio}
      />
    </>
  );
}
