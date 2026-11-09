import { MapPin, Phone } from "lucide-react";
import { formatCOP, formatFecha, formatHora } from "@/lib/format";
import { precioUnitarioItem } from "@/lib/precios";
import { ordenDeItem } from "@/lib/roles";
import { BotonImprimir } from "@/app/ordenes/comanda/[pedidoId]/boton-imprimir";

export type ItemFacturaDomicilio = {
  id: number;
  cantidad: number;
  tipo: string;
  conSopa?: boolean | null;
  /** Precio fijado al ordenar (el de la comanda, no el de hoy) */
  precio: number | null;
  nota?: string | null;
  producto: { nombre: string; precio: number };
};

export type CargaFacturaDomicilio = {
  numeroDomicilio: number;
  pedidoId: number;
  cliente: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
  horaEntrega: string | null;
  observaciones: string | null;
  items: ItemFacturaDomicilio[];
};

/** El pago REAL que registró el modal de cobro (vía el Pago de la caja) */
export type PagoFacturaDomicilio = {
  fecha: Date;
  metodo: string;
  total: number;
  propina: number;
  /** Billete con el que pagó el cliente (solo efectivo; null = pago exacto) */
  recibido: number | null;
  vueltas: number | null;
};

const METODO_TXT: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

/**
 * La factura del domicilio en estilo ticket (80 mm). Sin `pago` es la
 * factura de venta pendiente que revisa el admin desde Caja; con `pago` es la
 * factura del cobro ya registrado: lleva
 * método, propina, recibido y vueltas tal como entraron en la caja.
 */
export function FacturaDomicilio({
  carga,
  pago,
  volverParaImprimir,
}: {
  carga: CargaFacturaDomicilio;
  /** El pago registrado: cuando existe, la factura se imprime con esos datos */
  pago?: PagoFacturaDomicilio;
  /** Ruta a la que regresa la comanda imprimible después de imprimir */
  volverParaImprimir?: string;
}) {
  const items = carga.items
    .filter((item) => item.cantidad > 0)
    .sort((a, b) => ordenDeItem(a.tipo) - ordenDeItem(b.tipo) || a.id - b.id);
  const total =
    pago?.total ??
    items.reduce(
      (suma, item) => suma + precioUnitarioItem(item) * item.cantidad,
      0,
    );
  const totalPagado = pago ? pago.total + pago.propina : null;

  return (
    <section data-print-ticket="" className="mx-auto w-full max-w-md bg-white px-5 py-5 font-mono text-[13px] leading-relaxed text-brown-950 shadow-xl lg:mx-0 lg:max-w-none">
      <div className="text-center">
        <p className="font-display text-xl font-bold tracking-wide">
          EL BUEN GUSTO
        </p>
        <p className="mt-0.5 text-[11px] font-bold tracking-widest">
          DOMICILIO · FACTURA DE VENTA
        </p>
      </div>

      <div className="my-3 border-t-2 border-dashed border-brown-950/40" />

      <div className="space-y-0.5 text-[12px]">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-base font-bold">
            #{carga.numeroDomicilio} · {carga.cliente}
          </span>
          <span className="text-base font-bold">{formatCOP(total)}</span>
        </p>
        {carga.telefono ? (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> {carga.telefono}
          </p>
        ) : null}
        {carga.direccion || carga.barrio ? (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            {carga.direccion || "—"}
            {carga.barrio ? ` · ${carga.barrio}` : ""}
          </p>
        ) : null}
        {carga.referencia ? (
          <p className="text-[11px] text-brown-950/60">({carga.referencia})</p>
        ) : null}
        {carga.horaEntrega ? (
          <p className="text-[11px] text-brown-950/60">
            Cliente pidió su pedido para: {carga.horaEntrega}
          </p>
        ) : null}
      </div>

      <div className="my-3 border-t border-dashed border-brown-950/30" />

      {items.length === 0 ? (
        <p className="text-center text-sm text-brown-950/60">
          Sin ítems en la comanda.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2 text-sm">
              <span className="font-bold">{item.cantidad}×</span>
              <span className="min-w-0 flex-1 font-bold uppercase">
                {item.producto.nombre}
                {item.tipo === "PROTEINA" && item.conSopa === false
                  ? " (sin sopa)"
                  : ""}
                {item.nota ? (
                  <span className="block whitespace-pre-wrap text-[11px] font-normal normal-case text-brown-950/70">
                    ↳ {item.nota}
                  </span>
                ) : null}
              </span>
              {precioUnitarioItem(item) > 0 ? (
                <span className="font-bold">
                  {formatCOP(precioUnitarioItem(item) * item.cantidad)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {carga.observaciones ? (
        <p className="mt-2 text-[11px]">📝 {carga.observaciones}</p>
      ) : null}

      <div className="my-3 border-t-2 border-dashed border-brown-950/40" />

      <p className="flex items-baseline justify-between text-base">
        <span className="font-bold">TOTAL</span>
        <span className="font-display text-2xl font-bold">
          {formatCOP(total)}
        </span>
      </p>

      {pago && totalPagado !== null ? (
        <>
          {/* El dinero como entró en caja: propina, método y el efectivo */}
          <div className="mt-1.5 space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Propina</span>
              <span className="font-bold">{formatCOP(pago.propina)}</span>
            </p>
            <p className="flex justify-between">
              <span>Método</span>
              <span className="font-bold">
                {METODO_TXT[pago.metodo] ?? pago.metodo}
              </span>
            </p>
            {pago.metodo === "EFECTIVO" && pago.recibido !== null ? (
              <>
                <p className="flex justify-between">
                  <span>Recibido</span>
                  <span className="font-bold">{formatCOP(pago.recibido)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Vueltas</span>
                  <span className="font-bold">{formatCOP(pago.vueltas ?? 0)}</span>
                </p>
              </>
            ) : null}
          </div>

          <div className="my-3 border-t-2 border-dashed border-brown-950/40" />
          <p className="flex items-baseline justify-between text-base">
            <span className="font-bold">TOTAL PAGADO</span>
            <span className="font-display text-2xl font-bold">
              {formatCOP(totalPagado)}
            </span>
          </p>
          <p className="mt-1.5 text-center text-[11px] text-brown-950/60">
            Pago registrado el {formatFecha(pago.fecha)} a las{" "}
            {formatHora(pago.fecha)}
          </p>
          <p className="mt-2 text-center text-[11px] font-bold uppercase tracking-widest text-brown-950/50">
            ¡Gracias por su compra! · El Buen Gusto
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-center text-[11px] text-brown-950/60">
          La propina y las vueltas se ajustan en el panel de cobro
        </p>
      )}

      {/* Antes del cobro se imprime la factura de venta con los productos
          vendidos. La comanda de cocina ya salió al crear el domicilio. */}
      {volverParaImprimir && !pago ? (
        <BotonImprimir leyenda="Imprimir factura" volverHref={volverParaImprimir} />
      ) : null}
    </section>
  );
}
