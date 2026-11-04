import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { precioUnitarioItem, nombreDeItem } from "@/lib/precios";
import { FacturaDomicilio } from "@/components/factura-domicilio";
import { BotonImprimir } from "@/app/ordenes/comanda/[pedidoId]/boton-imprimir";

export const metadata = { title: "Factura del domicilio · El Buen Gusto" };

/**
 * Destino instantáneo del modal de cobro: la factura del domicilio con los
 * datos del pago REAL (propina, método, recibido y vueltas) lista para
 * imprimir en la térmica de 80 mm. La comanda de cocina ya salió al crear
 * el domicilio; esta es la del dinero.
 */
export default async function PaginaFacturaDomicilio(
  props: PageProps<"/admin/domicilios/factura/[pagoId]">,
) {
  await requerirRol("ADMIN");
  const { pagoId: crudo } = await props.params;
  const id = Number.parseInt(crudo, 10);
  if (!Number.isInteger(id)) notFound();

  const pago = await db.pago.findUnique({
    where: { id },
    include: {
      pedido: {
        include: {
          items: { include: { producto: true } },
          mesa: true,
          domicilio: true,
        },
      },
    },
  });
  if (!pago) notFound();

  // Los pagos de salón y para llevar se imprimen como recibo desde la caja;
  // el ticket de factura solo aplica a los domicilios.
  if (!pago.pedido.domicilio) {
    redirect(`/admin/caja/recibo/${id}`);
  }
  const domicilio = pago.pedido.domicilio;

  return (
    <div className="min-h-screen bg-fondo-app py-8">
      <div className="mx-auto w-full max-w-md px-4 print:px-0">
        <FacturaDomicilio
          carga={{
            numeroDomicilio: domicilio.id,
            pedidoId: pago.pedidoId,
            cliente: domicilio.cliente,
            telefono: domicilio.telefono,
            direccion: domicilio.direccion,
            barrio: domicilio.barrio,
            referencia: domicilio.referencia,
            horaEntrega: domicilio.horaEntrega,
            observaciones: pago.pedido.observaciones,
            items: pago.pedido.items.map((item) => ({
              id: item.id,
              cantidad: item.cantidad,
              tipo: item.tipo,
              conSopa: item.conSopa,
              precio: item.precio,
              nota: item.nota,
              producto: {
                nombre: nombreDeItem(item),
                precio: precioUnitarioItem(item),
              },
            })),
          }}
          pago={{
            fecha: pago.createdAt,
            metodo: pago.metodo,
            total: pago.total,
            propina: pago.propina,
            recibido: pago.montoPagado,
            vueltas: pago.vueltas,
          }}
        />
        <BotonImprimir leyenda="Imprimir factura" volverHref="/admin/domicilios" />
      </div>
    </div>
  );
}
