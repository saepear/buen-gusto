import { Bike, MessageCircle, Plus } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatHora } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import { precioUnitarioItem } from "@/lib/precios";
import {
  ESTADO_DOMICILIO,
  ESTADOS_ACTIVOS_DOMICILIO,
  type EstadoDomicilio,
} from "@/lib/roles";
import { TableroDomicilios, type DomicilioVista } from "./tablero";

export const metadata = { title: "Domicilios · El Buen Gusto" };

export default async function PaginaDomicilios() {
  const [domicilios, repartidores] = await Promise.all([
    db.domicilio.findMany({
      where: {
        OR: [
          { estado: { in: ESTADOS_ACTIVOS_DOMICILIO } },
          { createdAt: { gte: inicioDeHoy() } },
        ],
      },
      include: {
        pedido: { include: { items: { include: { producto: true } } } },
        domiciliario: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.usuario.findMany({
      where: { rol: "DOMICILIARIO", activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);

  const vistas: DomicilioVista[] = domicilios.map((d) => {
    const items = d.pedido.items.filter((i) => i.cantidad > 0);
    const total = items.reduce(
      (suma, i) => suma + precioUnitarioItem(i) * i.cantidad,
      0,
    );
    const resumen =
      items
        .map((i) => (i.cantidad > 1 ? `${i.cantidad}× ${i.producto.nombre}` : i.producto.nombre))
        .join(" · ") || "Sin ítems";
    return {
      id: d.id,
      pedidoId: d.pedidoId,
      estado: d.estado,
      cliente: d.cliente,
      telefono: d.telefono,
      direccion: d.direccion,
      barrio: d.barrio,
      referencia: d.referencia,
      observaciones: d.pedido.observaciones,
      notaEntrega: d.notaEntrega,
      domiciliarioId: d.domiciliarioId,
      cobradoMonto: d.cobradoMonto,
      cobradoMetodo: d.cobradoMetodo,
      creadoEn: formatHora(d.createdAt),
      total,
      resumen,
    };
  });

  const porAsignar = vistas.filter(
    (d) => d.estado === ESTADO_DOMICILIO.PENDIENTE,
  );
  const enReparto = vistas.filter(
    (d) =>
      d.estado === ESTADO_DOMICILIO.ASIGNADO ||
      d.estado === ESTADO_DOMICILIO.EN_CAMINO,
  );
  const cerrados = vistas.filter(
    (d) =>
      d.estado === ESTADO_DOMICILIO.ENTREGADO ||
      d.estado === ESTADO_DOMICILIO.NO_ENTREGADO ||
      d.estado === ESTADO_DOMICILIO.CANCELADO,
  );

  const estadosActivos = new Set<EstadoDomicilio>(ESTADOS_ACTIVOS_DOMICILIO);
  const activos = vistas.filter((d) =>
    estadosActivos.has(d.estado as EstadoDomicilio),
  ).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <EncabezadoPagina
          titulo="Domicilios"
          subtitulo="Almuerzos para llevar a la casa del cliente · se cobran contra entrega"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/domicilios/whatsapp"
            className="flex items-center gap-2 rounded-2xl bg-panel-app px-5 py-3 font-display text-md text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover active:scale-95"
          >
            <MessageCircle className="h-5 w-5" /> Pegar y armar
          </Link>
          <Link
            href="/admin/domicilios/nuevo"
            className="flex items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95"
          >
            <Plus className="h-5 w-5" /> Nuevo domicilio
          </Link>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-3">
        <span className="flex items-center gap-2 rounded-xl bg-panel-app px-3.5 py-1.5 text-sm ring-1 ring-borde-app">
          <Bike className="h-4 w-4 text-orange-brand" />
          <span className="text-texto-muted/60">En curso</span>
          <strong className="font-display text-lg text-texto-app">{activos}</strong>
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-panel-app px-3.5 py-1.5 text-sm ring-1 ring-borde-app">
          <span className="text-texto-muted/60">Cerrados hoy</span>
          <strong className="font-display text-lg text-texto-app">
            {cerrados.length}
          </strong>
        </span>
      </div>

      <TableroDomicilios
        porAsignar={porAsignar}
        enReparto={enReparto}
        cerrados={cerrados}
        repartidores={repartidores}
      />
    </>
  );
}
