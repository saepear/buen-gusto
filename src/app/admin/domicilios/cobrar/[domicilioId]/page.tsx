import { ArrowLeft, Bike, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import {
  ESTADO_DOMICILIO,
  ESTADO_DOMICILIO_LABEL,
  ordenDeItem,
} from "@/lib/roles";
import { precioUnitarioItem } from "@/lib/precios";
import { requerirRol } from "@/lib/session";
import { EncabezadoPagina } from "@/components/encabezado";
import { PanelCobroDomicilio } from "./panel-cobro";

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

  const items = domicilio.pedido.items
    .filter((it) => it.cantidad > 0)
    .sort((a, b) => ordenDeItem(a.tipo) - ordenDeItem(b.tipo) || a.id - b.id);
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
        {/* Factura a revisar */}
        <section className="mx-auto w-full max-w-md bg-white px-5 py-5 font-mono text-[13px] leading-relaxed text-brown-950 shadow-xl lg:mx-0 lg:max-w-none">
          <div className="text-center">
            <p className="font-display text-xl font-bold tracking-wide">
              EL BUEN GUSTO
            </p>
            <p className="mt-0.5 text-[11px] font-bold tracking-widest">
              DOMICILIO · FACTURA DE COBRO
            </p>
          </div>

          <div className="my-3 border-t-2 border-dashed border-brown-950/40" />

          <div className="space-y-0.5 text-[12px]">
            <p className="flex items-baseline justify-between">
              <span className="text-base font-bold">#{domicilio.id} · {domicilio.cliente}</span>
              <span className="text-base font-bold">{formatCOP(total)}</span>
            </p>
            {domicilio.telefono ? (
              <p className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> {domicilio.telefono}
              </p>
            ) : null}
            {domicilio.direccion || domicilio.barrio ? (
              <p className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                {domicilio.direccion || "—"}
                {domicilio.barrio ? ` · ${domicilio.barrio}` : ""}
              </p>
            ) : null}
            {domicilio.referencia ? (
              <p className="text-[11px] text-brown-950/60">({domicilio.referencia})</p>
            ) : null}
            {domicilio.horaEntrega ? (
              <p className="text-[11px] text-brown-950/60">
                Cliente pidió su pedido para: {domicilio.horaEntrega}
              </p>
            ) : null}
          </div>

          <div className="my-3 border-t border-dashed border-brown-950/30" />

          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex gap-2 text-sm">
                <span className="font-bold">{item.cantidad}×</span>
                <span className="flex-1 font-bold uppercase">
                  {item.producto.nombre}
                  {item.tipo === "PROTEINA" && item.conSopa === false
                    ? " (sin sopa)"
                    : ""}
                </span>
                {precioUnitarioItem(item) > 0 ? (
                  <span className="font-bold">
                    {formatCOP(precioUnitarioItem(item) * item.cantidad)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          {domicilio.pedido.observaciones ? (
            <p className="mt-2 text-[11px]">📝 {domicilio.pedido.observaciones}</p>
          ) : null}

          <div className="my-3 border-t-2 border-dashed border-brown-950/40" />

          <p className="flex items-baseline justify-between text-base">
            <span className="font-bold">TOTAL</span>
            <span className="font-display text-2xl font-bold">
              {formatCOP(total)}
            </span>
          </p>
          <p className="mt-1.5 text-center text-[11px] text-brown-950/60">
            La propina y las vueltas se ajustan en el panel de pago
          </p>
        </section>

        <PanelCobroDomicilio domicilioId={domicilio.id} total={total} />
      </div>
    </>
  );
}
