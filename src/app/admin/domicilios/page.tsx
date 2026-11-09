import { Banknote, Bike, CheckCircle2, Plus, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatCOP, formatHora } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import { precioUnitarioItem, nombreDeItem } from "@/lib/precios";
import {
  ESTADO_DOMICILIO,
  ESTADO_PEDIDO,
  type EstadoDomicilio,
} from "@/lib/roles";
import { TableroDomicilios, type DomicilioVista } from "./tablero";
import "./domicilios.css";

export const metadata = { title: "Domicilios · El Buen Gusto" };

/**
 * El panel de domicilios ACTIVOS: son exactamente los domicilios a los que
 * les falta su cobro (de hoy y de días anteriores: la plata no se olvida por
 * haber pasado la noche). El botón de cobro lleva a Caja, que es el único
 * lugar donde se registra el pago, recibo y movimiento financiero.
 */
export default async function PaginaDomicilios() {
  const [pendientes, cobrosDeHoy] = await Promise.all([
    db.domicilio.findMany({
      where: {
        // Sin pago registrado, sin estar cancelado ni fiado (los fiados van
        // con abonos en «Cuentas por cobrar»), y con comanda viva: en
        // cobradoMonto se guarda el total congelado del cobro.
        cobradoMonto: null,
        estado: { notIn: [ESTADO_DOMICILIO.CANCELADO, ESTADO_DOMICILIO.FIADO] },
        pedido: {
          estado: { notIn: [ESTADO_PEDIDO.CANCELADO, ESTADO_PEDIDO.FIADO] },
        },
      },
      include: {
        pedido: { include: { items: { include: { producto: true } } } },
      },
    }),
    // El recaudo del día sale de los pagos ya registrados (la factura de
    // cada domicilio es exactamente uno de esos pagos de la mesa virtual).
    db.pago.findMany({
      where: {
        createdAt: { gte: inicioDeHoy() },
        pedido: { mesa: { esDomicilio: true } },
      },
      select: { total: true, propina: true },
    }),
  ]);

  const vistas: DomicilioVista[] = pendientes.map((d) => {
    const items = d.pedido.items.filter((i) => i.cantidad > 0);
    const resumen =
      items
        .map((i) =>
          i.cantidad > 1 ? `${i.cantidad}× ${nombreDeItem(i)}` : nombreDeItem(i),
        )
        .join(" · ") || "Sin ítems";
    return {
      id: d.id,
      pedidoId: d.pedidoId,
      estado: d.estado as EstadoDomicilio,
      /** Estado de la comanda: para saber si la cocina ya la tiene lista */
      pedidoEstado: d.pedido.estado,
      cliente: d.cliente,
      /** Ficha del historial (Clientes): destino de la deuda si se fió */
      clienteId: d.clienteId,
      telefono: d.telefono,
      direccion: d.direccion,
      barrio: d.barrio,
      referencia: d.referencia,
      horaEntrega: d.horaEntrega,
      /** La misma hora en minutos (para ordenar la fila por hora de entrega) */
      horaMin: d.horaEntregaMinutos,
      observaciones: d.pedido.observaciones,
      creadoEn: formatHora(d.createdAt),
      /** epoch de creación, para ordenar la cola por llegada (FIFO) */
      ordenTs: d.createdAt.getTime(),
      total: items.reduce(
        (suma, i) => suma + precioUnitarioItem(i) * i.cantidad,
        0,
      ),
      resumen,
      items: items.map((i) => ({
        id: i.id,
        cantidad: i.cantidad,
        grupo: i.grupo,
        tipo: i.tipo,
        nombre: nombreDeItem(i),
        conSopa: i.conSopa,
        nota: i.nota,
        /** Precio unitario fijado al ordenar (el de la comanda) */
        precio: precioUnitarioItem(i),
      })),
    };
  });

  // Cola única: los que dijeron «para las X» van primero por su hora (la
  // 12:00 antes que la 1 y media) y el resto por llegada; lo más viejo al
  // frente porque es lo que primero toca empaque y cobrar.
  const porLlegada = (
    a: { ordenTs: number },
    b: { ordenTs: number },
  ) => a.ordenTs - b.ordenTs;
  const porHora = (
    a: { ordenTs: number; horaMin: number | null },
    b: { ordenTs: number; horaMin: number | null },
  ) => {
    if (a.horaMin !== null && b.horaMin !== null)
      return a.horaMin - b.horaMin || a.ordenTs - b.ordenTs;
    if (a.horaMin !== null) return -1;
    if (b.horaMin !== null) return 1;
    return porLlegada(a, b);
  };
  const cola = [...vistas].sort(porHora);

  return (
    <div className="domicilios-dashboard">
      <header className="domicilios-hero">
        <div className="domicilios-nuevo-title"><span className="domicilios-title-icon"><Bike aria-hidden /></span><div>
          <p className="domicilios-eyebrow">GESTIÓN DE ENTREGAS</p><h1>Domicilios</h1>
          <p>Revisa los pedidos pendientes y envía cada cobro al módulo de Caja.</p>
        </div></div>
        <Link href="/admin/domicilios/nuevo" className="domicilios-primary"><Plus aria-hidden /> Nuevo domicilio <ArrowUpRight aria-hidden /></Link>
      </header>

      <div className="mb-8 flex flex-wrap gap-3">
        <span className="flex items-center gap-2 rounded-xl bg-panel-app px-3.5 py-1.5 text-sm ring-1 ring-borde-app">
          <Bike className="h-4 w-4 text-orange-brand" />
          <span className="text-texto-muted/60">Pendientes de cobro</span>
          <strong className="font-display text-lg text-texto-app">
            {cola.length}
          </strong>
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-panel-app px-3.5 py-1.5 text-sm ring-1 ring-borde-app">
          <CheckCircle2 className="h-4 w-4 text-success-text" />
          <span className="text-texto-muted/60">Cobrados hoy</span>
          <strong className="font-display text-lg text-texto-app">
            {cobrosDeHoy.length}
          </strong>
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-panel-app px-3.5 py-1.5 text-sm ring-1 ring-borde-app">
          <Banknote className="h-4 w-4 text-amber-brand" />
          <span className="text-texto-muted/60">Recaudado hoy</span>
          <strong className="font-display text-lg text-texto-app">
            {formatCOP(
              cobrosDeHoy.reduce((suma, p) => suma + p.total + p.propina, 0),
            )}
          </strong>
        </span>
      </div>

      <TableroDomicilios pendientes={cola} />
    </div>
  );
}
