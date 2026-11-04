import { ArrowLeft, User, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { EncabezadoPagina } from "@/components/encabezado";
import { getCategoriasPersonalizadas } from "@/lib/config";
import { menuDeHoy } from "@/lib/pedido";
import { precioUnitarioItem, nombreDeItem } from "@/lib/precios";
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
          it.cantidad > 1 ? `${it.cantidad}× ${nombreDeItem(it)}` : nombreDeItem(it),
        )
        .join(" · ");
      const resumen = proteina
        ? `${nombreDeItem(proteina)} (${proteina.conSopa ? "con sopa" : "bandeja"})${
            extrasNombres ? ` · ${extrasNombres}` : ""
          }`
        : items
            .map((it) =>
              it.cantidad > 1 ? `${it.cantidad}× ${nombreDeItem(it)}` : nombreDeItem(it),
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
        direccion: ultima.direccion,
        barrio: ultima.barrio,
        referencia: ultima.referencia,
        horaEntrega: ultima.horaEntrega,
      };
    });
}

/** Cliente al que se le hará el pedido (precargado con «Realizar pedido») */
type ClientePreseteado = {
  domicilioId: number;
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  horaEntrega: string | null;
};

export default async function PaginaNuevoDomicilio(
  props: PageProps<"/admin/domicilios/nuevo">,
) {
  const { para } = await props.searchParams;
  const [menu, extras, categorias, ultimosDomicilios] = await Promise.all([
    menuDeHoy(),
    db.producto.findMany({
      // Solo bebidas y adicionales (las categorías propias van en el plato)
      where: { activo: true, tipo: { in: ["BEBIDA", "ADICIONAL"] } },
      orderBy: { nombre: "asc" },
    }),
    // Las categorías propias del cliente vienen al constructor del plato
    getCategoriasPersonalizadas(),
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

  // «Realizar pedido» de un cliente del historial: eso precarga su nombre,
  // teléfono y dirección (su última entrega) en el formulario de abajo
  const paraId = Number.parseInt(String(para ?? ""), 10);
  const clienteOrigen = Number.isInteger(paraId)
    ? await db.domicilio.findUnique({
        where: { id: paraId },
        select: {
          id: true,
          cliente: true,
          telefono: true,
          direccion: true,
          barrio: true,
          referencia: true,
          horaEntrega: true,
          estado: true,
          pedido: { select: { estado: true } },
        },
      })
    : null;
  const clientePreseteado: ClientePreseteado | null =
    clienteOrigen &&
    clienteOrigen.estado !== ESTADO_DOMICILIO.CANCELADO &&
    clienteOrigen.pedido.estado !== ESTADO_PEDIDO.CANCELADO
      ? {
          domicilioId: clienteOrigen.id,
          cliente: clienteOrigen.cliente,
          telefono: clienteOrigen.telefono,
          direccion: clienteOrigen.direccion,
          barrio: clienteOrigen.barrio,
          referencia: clienteOrigen.referencia,
          horaEntrega: clienteOrigen.horaEntrega,
        }
      : null;

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
      />

      {/* Clientes fijos alineados con el ancho del formulario */}
      <div className="mx-auto w-full max-w-xl px-4 sm:max-w-2xl">
        <ClientesFijos clientes={clientesFijosDe(ultimosDomicilios)} />

        {/* El «Realizar pedido» del historial llega aquí: los datos del
            cliente ya están cargados, solo falta armar los platos */}
        {clientePreseteado ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl bg-success/10 px-4 py-3 text-sm ring-1 ring-success/25">
            <User aria-hidden className="h-4 w-4 shrink-0 text-success-text" />
            <span className="font-bold text-success-text">
              Usando los datos de {clientePreseteado.cliente}
            </span>
            <span className="w-full text-xs text-texto-muted/70 sm:w-auto">
              Ya están en los campos del cliente (en la comanda): revisa la
              dirección y arma los platos.
            </span>
            <Link
              href="/admin/domicilios/nuevo"
              className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-panel-app px-3 py-1.5 text-xs font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
            >
              Empezar en blanco
            </Link>
          </div>
        ) : null}
      </div>

      <FormularioPedido
        key={clientePreseteado ? `domicilio-${clientePreseteado.domicilioId}` : "limpio"}
        clientePreseteado={clientePreseteado}
        mesa={{ id: 0, nombre: "Domicilio" }}
        menu={menu}
        extras={extras.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          precio: p.precio,
        }))}
        categorias={categorias}
        modo="domicilio"
        accion={crearDomicilio}
      />
    </>
  );
}
