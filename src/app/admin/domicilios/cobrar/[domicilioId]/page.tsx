import { ArrowLeft, Bike } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  ESTADO_DOMICILIO,
  ESTADO_DOMICILIO_LABEL,
} from "@/lib/roles";
import { precioUnitarioItem } from "@/lib/precios";
import { requerirRol } from "@/lib/session";
import { EncabezadoPagina } from "@/components/encabezado";
import { FacturaDomicilio } from "@/components/factura-domicilio";
import { PanelCobroDomicilio } from "../../panel-cobro-domicilio";

export const metadata = { title: "Cobrar domicilio · El Buen Gusto" };

/**
 * La factura del domicilio: el admin la vuelve a revisar al llegar la
 * plata y desde allí mismo cobra (método, monto pagado y vueltas). Al
 * confirmar el recibo imprimible aparece en la caja.
 */
export default async function PaginaCobrarDomicilio(
  props: PageProps<"/admin/domicilios/cobrar/[domicilioId]">,
) {
  await requerirRol("ADMIN");
  const { domicilioId: crudo } = await props.params;
  const id = Number.parseInt(crudo, 10);
  if (!Number.isInteger(id)) notFound();

  const domicilio = await db.domicilio.findUnique({
    where: { id },
    include: {
      pedido: { include: { items: { include: { producto: true } } } },
    },
  });
  if (!domicilio) notFound();

  // Ya quedó cobrado (por el admin o por la app del domiciliario): el
  // tablero es la vista correcta para revisarlo
  if (domicilio.cobradoMonto !== null) redirect("/admin/domicilios");

  if (domicilio.estado !== ESTADO_DOMICILIO.ENTREGADO) {
    return (
      <>
        <Link
          href="/admin/domicilios"
          className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-1.5 text-sm font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
        >
          <ArrowLeft className="h-4 w-4" /> Domicilios
        </Link>
        <EncabezadoPagina
          titulo={`Domicilio #${domicilio.id}`}
          subtitulo="Todavía no se puede cobrar"
        />
        <div className="mx-auto flex max-w-xl flex-col items-center rounded-[2rem] bg-panel-app p-10 text-center ring-1 ring-borde-app">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning-text ring-1 ring-warning/25">
            <Bike className="h-6 w-6" />
          </span>
          <p className="mt-4 font-display text-xl text-texto-app">
            {ESTADO_DOMICILIO_LABEL[domicilio.estado as keyof typeof ESTADO_DOMICILIO_LABEL] ?? domicilio.estado}
          </p>
          <p className="mt-1 max-w-sm text-sm text-texto-muted/70">
            Márcalo «Entregado» cuando el domiciliario vuelva con la plata: aquí
            aparecerá la factura lista para cobrar.
          </p>
          <Link
            href="/admin/domicilios"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95"
          >
            Volver al tablero
          </Link>
        </div>
      </>
    );
  }

  const items = domicilio.pedido.items.filter((it) => it.cantidad > 0);
  const total = items.reduce(
    (suma, it) => suma + precioUnitarioItem(it) * it.cantidad,
    0,
  );

  return (
    <>
      <Link
        href="/admin/domicilios"
        className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-1.5 text-sm font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
      >
        <ArrowLeft className="h-4 w-4" /> Domicilios
      </Link>

      <EncabezadoPagina
        titulo={`Cobrar domicilio #${domicilio.id}`}
        subtitulo="Revisa la factura, toma el dinero y confirma: queda en caja con su recibo"
      />

      <div className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {/* Factura a revisar, con botón de imprimir la comanda */}
        <FacturaDomicilio
          carga={{
            numeroDomicilio: domicilio.id,
            pedidoId: domicilio.pedidoId,
            cliente: domicilio.cliente,
            telefono: domicilio.telefono,
            direccion: domicilio.direccion,
            barrio: domicilio.barrio,
            referencia: domicilio.referencia,
            horaEntrega: domicilio.horaEntrega,
            observaciones: domicilio.pedido.observaciones,
            items: domicilio.pedido.items.map((item) => ({
              id: item.id,
              cantidad: item.cantidad,
              tipo: item.tipo,
              conSopa: item.conSopa,
              precio: item.precio,
              nota: item.nota,
              producto: { nombre: item.producto.nombre, precio: item.producto.precio },
            })),
          }}
          volverParaImprimir={`/admin/domicilios/cobrar/${domicilio.id}`}
        />

        <PanelCobroDomicilio domicilioId={domicilio.id} total={total} />
      </div>
    </>
  );
}
