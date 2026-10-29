// Soporte de pedidos y comandas: helpers compartidos entre mesero, cocina y admin
import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { ESTADO_PEDIDO, type EstadoPedido, type TipoProducto } from "@/lib/roles";

/** Pedidos que dejan la mesa ocupada (los demás son históricos) */
export const ESTADOS_ACTIVOS_PEDIDO: EstadoPedido[] = [
  ESTADO_PEDIDO.ENVIADO,
  ESTADO_PEDIDO.EN_PREPARACION,
  ESTADO_PEDIDO.PARCIAL_SERVIDO,
  ESTADO_PEDIDO.SERVIDO,
  ESTADO_PEDIDO.POR_PAGAR,
];

export type ItemMenuHoy = {
  /** id del MenuDiaItem: se usa para descontar/resetear porciones */
  itemId: number;
  productoId: number;
  nombre: string;
  tipo: TipoProducto;
  /** Porciones disponibles ahora mismo; null = ilimitado */
  disponibles: number | null;
  vendidos: number;
};

/** El menú vigente de HOY por tipo, listo para armar pedidos */
export async function menuDeHoy(): Promise<ItemMenuHoy[]> {
  const fecha = claveDia(new Date());
  const menu = await db.menuDia.findUnique({
    where: { fecha },
    include: { items: { include: { producto: true } } },
  });
  if (!menu) return [];
  return menu.items
    .filter((item) => item.producto.activo && item.visible)
    .map((item) => ({
      itemId: item.id,
      productoId: item.productoId,
      nombre: item.producto.nombre,
      tipo: item.producto.tipo as TipoProducto,
      vendidos: item.vendidos,
      disponibles:
        item.stockPorciones === null
          ? null
          : Math.max(0, item.stockPorciones - item.vendidos),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Hoy a las 00:00 local (para traer solo los pedidos del día) */
export function inicioDeHoy(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Colores de los chips de estado de comanda (zonas oscuras: cocina) */
export const CHIP_ESTADO_PEDIDO: Record<string, string> = {
  ENVIADO:
    "bg-amber-brand/15 text-amber-brand border border-amber-brand/40",
  EN_PREPARACION:
    "bg-[#4aa3ff]/15 text-[#8cc7ff] border border-[#4aa3ff]/40",
  PARCIAL_SERVIDO:
    "bg-[#b06fd0]/20 text-[#d8a6f0] border border-[#b06fd0]/40",
  SERVIDO:
    "bg-success/15 text-[#a7dd83] border border-success/40",
  POR_PAGAR:
    "bg-warning/15 text-amber-brand border border-warning/50",
  CANCELADO:
    "bg-danger/15 text-[#f09490] border border-danger/40",
  COBRADO:
    "bg-white/5 text-cream-200/60 border border-white/10",
};
