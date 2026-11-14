import { nombreDeItem, precioUnitarioItem } from "./precios";

type ItemOrigen = Parameters<typeof nombreDeItem>[0] & Parameters<typeof precioUnitarioItem>[0] & {
  id: number; cantidad: number; tipo: string; conSopa: boolean | null; nota: string | null;
};
type PedidoOrigen = { id: number; consecutivoDia?: number | null; createdAt: Date; paraLlevar: boolean; observaciones: string | null; items: ItemOrigen[] };
export type PedidoRecibo = {
  id: number; numero: number; fecha: string; paraLlevar: boolean; observaciones: string | null;
  items: { id: number; nombre: string; cantidad: number; tipo: string; precio: number; conSopa: boolean | null; nota: string | null }[];
};

export function fotoPedidos(pedidos: PedidoOrigen[]): PedidoRecibo[] {
  return pedidos.map(pedido => ({
    id: pedido.id, numero: pedido.consecutivoDia ?? pedido.id, fecha: pedido.createdAt.toISOString(),
    paraLlevar: pedido.paraLlevar, observaciones: pedido.observaciones,
    items: pedido.items.map(item => ({ id: item.id, nombre: nombreDeItem(item), cantidad: item.cantidad,
      tipo: item.tipo, precio: precioUnitarioItem(item), conSopa: item.conSopa, nota: item.nota })),
  }));
}

export function leerFotoPedidos(foto: string | null): PedidoRecibo[] | null {
  if (!foto) return null;
  try {
    const pedidos = JSON.parse(foto) as PedidoRecibo[];
    return Array.isArray(pedidos) && pedidos.every(p => typeof p.numero === "number" && typeof p.fecha === "string" && Array.isArray(p.items) && p.items.every(i => typeof i.nombre === "string" && Number.isSafeInteger(i.cantidad) && Number.isSafeInteger(i.precio))) ? pedidos : null;
  } catch { return null; }
}
