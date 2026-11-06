// Motor de fiados: TODA deuda que nace de una comanda pasa por aquí.
// Reglas duras del negocio:
// · La deuda NO es ingreso de caja: no se crea ningún Pago a nombre de la
//   deuda; el dinero entra el día que abonan (AbonoCuenta) o el pago parcial
//   que el admin reciba al fiar (Pago real, como cualquier venta).
// · El desglose de artículos (CuentaPorCobrarItem) es una FOTO: precios
//   congelados al fiar (precioUnitarioItem, nunca recalculados); las líneas
//   con precio 0 (principios y ensaladas incluidos en el plato) NO se
//   duplican porque su valor ya vive dentro del precio del plato.
import { Prisma } from "@prisma/client";
import { nombreDeItem, precioUnitarioItem } from "@/lib/precios";

export type ItemDePedidoParaFoto = {
  id: number;
  pedidoId: number;
  productoId: number | null;
  producto: { nombre: string; precio: number } | null;
  productoNombre: string | null;
  tipo: string;
  cantidad: number;
  precio: number | null;
  conSopa: boolean | null;
  nota: string | null;
  grupo: number;
};

type PrismaTx = Prisma.TransactionClient;

/** Foto de las líneas CON dinero de un pedido: una fila por cada artículo
 *  (plato de la comanda, bebidas, adicionales). Las líneas «incluido»
 *  (precioUnitarioItem 0) no van: son componentes del plato, no cobros. */
export function lineasDeFiadoDeItems(
  items: ItemDePedidoParaFoto[],
): {
  pedidoItemId: number;
  productoId: number | null;
  grupo: number;
  tipo: string;
  nombre: string;
  cantidad: number;
  precio: number;
  conSopa: boolean | null;
  nota: string | null;
}[] {
  return items.flatMap((item) => {
    const precio = precioUnitarioItem(item);
    if (precio <= 0) return [];
    return [
      {
        pedidoItemId: item.id,
        productoId: item.productoId,
        grupo: item.grupo,
        tipo: item.tipo,
        nombre: nombreDeItem(item),
        cantidad: item.cantidad,
        precio,
        conSopa: item.conSopa,
        nota: item.nota,
      },
    ];
  });
}

/**
 * Única vía para nacer una deuda ligada a comanda: crea la cuenta y sus
 * fotos de artículos en la MISMA transacción. Nunca toca caja (sin Pago).
 * Devuelve el id de la cuenta creada.
 */
export async function crearCuentaFiadaTx(
  tx: PrismaTx,
  datos: {
    clienteId: number;
    concepto: string;
    valorOriginal: number;
    pedidoId: number | null;
    createdById: number;
    items: ItemDePedidoParaFoto[];
  },
): Promise<number> {
  const cuenta = await tx.cuentaPorCobrar.create({
    data: {
      clienteId: datos.clienteId,
      concepto: datos.concepto,
      valorOriginal: datos.valorOriginal,
      pedidoId: datos.pedidoId,
      createdById: datos.createdById,
    },
    select: { id: true },
  });
  const lineas = lineasDeFiadoDeItems(datos.items);
  if (lineas.length > 0) {
    await tx.cuentaPorCobrarItem.createMany({
      data: lineas.map((linea) => ({ ...linea, cuentaId: cuenta.id })),
    });
  }
  return cuenta.id;
}
