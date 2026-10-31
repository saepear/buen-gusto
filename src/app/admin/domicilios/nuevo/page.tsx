import { ArrowLeft, MessageCircle, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { EncabezadoPagina } from "@/components/encabezado";
import { menuDeHoy } from "@/lib/pedido";
import { precioUnitarioItem } from "@/lib/precios";
import { ESTADO_DOMICILIO, ESTADO_PEDIDO } from "@/lib/roles";
import { FormularioPedido } from "@/app/mesero/mesa/[mesaId]/nuevo/formulario-pedido";
import { crearDomicilio } from "../actions";
import { ClientesFijos, type ClienteFijo } from "./clientes-fijos";

export const metadata = { title: "Nuevo domicilio · El Buen Gusto" };

const VOLVER = "/admin/domicilios";

/** El domicilio junto con su comanda y sus líneas (para el resumen del chip) */
type DomicilioConPedido = Prisma.DomicilioGetPayload<{
  include: { pedido: { include: { items: { include: { producto: true } } } } };
}>;

/** Agrupa los domicilios recientes por teléfono: el cliente fijo pide lo mismo */
function clientesFijosDe(ultimosDomicilios: DomicilioConPedido[]): ClienteFijo[] {
  const porTelefono = new Map<
    string,
    { ultima: DomicilioConPedido; pedidos: number }
  >();
  for (const dom of ultimosDomicilios) {
    // Sin teléfono no hay agrupación: varios clientes distintos van sin
    // número ("solo el nombre") y no se deben cruzar entre sí en el atajo
    if (dom.telefono.trim() === "") continue;
    const visto = porTelefono.get(dom.telefono);
    if (visto) {
      visto.pedidos += 1;
    } else {
      // Vienen en orden descendente: el primero visto de cada teléfono
      // es su pedido más reciente
      porTelefono.set(dom.telefono, { ultima: dom, pedidos: 1 });
    }
  }

  return [...porTelefono.values()]
    .sort(
      (a, b) =>
        b.pedidos - a.pedidos || b.ultima.createdAt.getTime() - a.ultima.createdAt.getTime(),
    )
    .slice(0, 8)
    .map(({ ultima, pedidos }) => {
      const items = ultima.pedido.items;
      const proteina = items.find((it) => it.tipo === "PROTEINA" && it.conSopa !== null);
      const extrasNombres = items
        .filter((it) => it.tipo === "BEBIDA" || it.tipo === "ADICIONAL")
        .map((it) =>
          it.cantidad > 1 ? `${it.cantidad}× ${it.producto.nombre}` : it.producto.nombre,
        )
        .join(" · ");
      const resumen = proteina
        ? `${proteina.producto.nombre} (${proteina.conSopa ? "con sopa" : "bandeja"})${
            extrasNombres ? ` · ${extrasNombres}` : ""
          }`
        : items
            .map((it) =>
              it.cantidad > 1 ? `${it.cantidad}× ${it.producto.nombre}` : it.producto.nombre,
            )
            .join(" · ");
      const total = items.reduce(
        (suma, it) => suma + precioUnitarioItem(it) * it.cantidad,
        0,
      );
      return {
        domicilioId: ultima.id,
        cliente: ultima.cliente,
        telefono: ultima.telefono,
        pedidos,
        resumen,
        total,
      };
    });
}

export default async function PaginaNuevoDomicilio() {
  const [menu, extras, ultimosDomicilios] = await Promise.all([
    menuDeHoy(),
    db.producto.findMany({
      where: { activo: true, tipo: { in: ["BEBIDA", "ADICIONAL"] } },
      orderBy: { nombre: "asc" },
    }),
    // Clientes fijos: historial reciente, ignorando lo cancelado
    db.domicilio.findMany({
      where: {
        estado: { not: ESTADO_DOMICILIO.CANCELADO },
        pedido: { estado: { not: ESTADO_PEDIDO.CANCELADO } },
      },
      orderBy: { createdAt: "desc" },
      include: { pedido: { include: { items: { include: { producto: true } } } } },
      take: 120,
    }),
  ]);

  if (menu.length === 0) {
    return (
      <>
        <Link
          href={VOLVER}
          className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-1.5 text-sm font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Domicilios
        </Link>

        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[2rem] bg-panel-app p-10 text-center ring-1 ring-borde-app">
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-campo-app text-texto-muted/35 ring-1 ring-borde-app"
          >
            <UtensilsCrossed className="h-6 w-6" />
          </span>
          <p className="mt-4 font-display text-xl text-texto-app">
            Todavía no hay menú para hoy
          </p>
          <p className="mt-1 max-w-sm text-sm text-texto-muted/70">
            Arma el menú del día antes de crear domicilios.
          </p>
          <Link
            href="/admin/menu-dia"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95"
          >
            <UtensilsCrossed aria-hidden className="h-4 w-4" /> Ir al menú del día
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        href={VOLVER}
        className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-1.5 text-sm font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Domicilios
      </Link>

      <EncabezadoPagina
        titulo="Nuevo domicilio"
        subtitulo="Arma el almuerzo paso a paso o repítelo con un toque para los clientes de siempre"
        acciones={
          <Link
            href="/admin/domicilios/whatsapp"
            className="flex items-center gap-2 rounded-xl bg-panel-app px-4 py-2.5 font-display text-md text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover active:scale-95"
          >
            <MessageCircle aria-hidden className="h-5 w-5" /> Pegar y armar
          </Link>
        }
      />

      {/* Clientes fijos alineados con el ancho del formulario */}
      <div className="mx-auto w-full max-w-xl px-4 sm:max-w-2xl">
        <ClientesFijos clientes={clientesFijosDe(ultimosDomicilios)} />
      </div>

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
