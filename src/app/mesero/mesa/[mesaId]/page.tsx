import {
  Banknote,
  CheckCircle2,
  Clock,
  CupSoda,
  Drumstick,
  MessageSquareText,
  Plus,
  Printer,
  Salad,
  ShoppingBag,
  Soup,
  Star,
  User,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { precioUnitarioItem, nombreDeItem } from "@/lib/precios";
import { ordenDeItem } from "@/lib/roles";
import { formatCOP, formatHora } from "@/lib/format";
import { ESTADO_MESA } from "@/lib/roles";
import { requerirRol } from "@/lib/session";
import { EncabezadoMesero } from "../../encabezado";

export const metadata = { title: "Mesa · El Buen Gusto" };

const CHIP_ESTADO: Record<string, string> = {
  ENVIADO: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  EN_PREPARACION: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  PARCIAL_SERVIDO: "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
  SERVIDO: "bg-success/10 text-success-text ring-1 ring-success/20",
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
};

const TXT_ESTADO: Record<string, string> = {
  ENVIADO: "En cocina",
  EN_PREPARACION: "En preparación",
  PARCIAL_SERVIDO: "Parcial",
  SERVIDO: "Lista para servir",
  POR_PAGAR: "Por pagar",
};

const ICONO_TIPO: Record<string, LucideIcon> = {
  PROTEINA: Drumstick,
  PRINCIPIO: Wheat,
  ENSALADA: Salad,
  SOPA: Soup,
  BEBIDA: CupSoda,
  ADICIONAL: Star,
};

const CLASE_TIPO: Record<string, string> = {
  PROTEINA: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  PRINCIPIO: "bg-success/10 text-success-text ring-1 ring-success/20",
  ENSALADA: "bg-menta-text/10 text-menta-text ring-1 ring-menta-text/20",
  SOPA: "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
  BEBIDA: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  ADICIONAL: "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
};

export default async function PaginaMesa(
  props: PageProps<"/mesero/mesa/[mesaId]">,
) {
  const sesion = await requerirRol("MESERO");
  const { mesaId: crudo } = await props.params;
  const { nuevo } = await props.searchParams;
  const mesaId = Number.parseInt(crudo, 10);
  if (!Number.isInteger(mesaId)) notFound();

  const mesa = await db.mesa.findFirst({
    where: { id: mesaId, activa: true, esDomicilio: false, esApartado: false },
  });
  if (!mesa) notFound();

  const comandas = await db.pedido.findMany({
    where: {
      mesaId,
      estado: { in: ESTADOS_ACTIVOS_PEDIDO },
      createdAt: { gte: inicioDeHoy() },
    },
    include: { items: { include: { producto: true } }, mesero: true },
    orderBy: { createdAt: "desc" },
  });

  const estadoMesa = mesa.estado as string;
  const libre = estadoMesa === ESTADO_MESA.LIBRE;
  const porPagar = estadoMesa === ESTADO_MESA.POR_PAGAR;

  const granTotal = comandas.reduce(
    (todo, pedido) =>
      todo +
      pedido.items.reduce(
        (x, item) => x + precioUnitarioItem(item) * item.cantidad,
        0,
      ),
    0,
  );

  return (
    <div className="min-h-screen bg-fondo-app">
      <EncabezadoMesero
        usuario={sesion.nombre}
        titulo={mesa.nombre}
        volver={{ href: "/mesero", texto: "Mesas" }}
      />

      <main className="mx-auto max-w-lg sm:max-w-2xl space-y-3.5 p-4 sm:p-6 pb-24">
        {nuevo ? (
          <div className="flex items-center gap-2.5 rounded-2xl bg-success/10 px-4 py-3 text-sm font-bold text-success-text ring-1 ring-success/40">
            <CheckCircle2 aria-hidden className="h-5 w-5 shrink-0" />
            Comanda #{nuevo} enviada a la cocina. Mira su avance aquí mismo.
          </div>
        ) : null}

        {/* Resumen de la mesa */}
        <section className="flex items-center justify-between gap-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:rounded-[2rem] sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 " +
                (libre
                  ? "bg-success/10 text-success-text ring-success/30"
                  : porPagar
                    ? "bg-warning/10 text-warning-text ring-warning/40"
                    : "bg-orange-brand/10 text-orange-brand ring-orange-brand/30")
              }
            >
              <UtensilsCrossed aria-hidden className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl leading-none text-texto-app">
                {mesa.nombre}
              </p>
              <span
                className={
                  "mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                  (libre
                    ? "bg-success/10 text-success-text ring-1 ring-success/20"
                    : porPagar
                      ? "bg-warning/10 text-warning-text ring-1 ring-warning/20"
                      : "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20")
                }
              >
                {libre ? "Libre" : porPagar ? "Por pagar" : "Ocupada"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {granTotal > 0 ? (
              <p className="text-right text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                Consumo de hoy
              </p>
            ) : null}
            <Link
              href={`/mesero/mesa/${mesa.id}/nuevo`}
              className={
                "flex items-center gap-1.5 rounded-2xl bg-amber-brand px-4 py-2.5 font-display font-bold text-brown-950 shadow-lg shadow-amber-brand/20 transition hover:bg-orange-brand hover:text-texto-app active:scale-95 " +
                (granTotal > 0 ? "order-first text-md" : "")
              }
            >
              <Plus aria-hidden className="h-4.5 w-4.5" /> Nuevo
            </Link>
            {granTotal > 0 ? (
              <p className="text-right font-display text-lg text-texto-app">
                {formatCOP(granTotal)}
              </p>
            ) : null}
          </div>
        </section>

        {porPagar ? (
          <p className="flex items-center gap-2.5 rounded-2xl bg-warning/10 px-4 py-3 text-xs font-bold text-warning-text ring-1 ring-warning/40">
            <Banknote aria-hidden className="h-5 w-5 shrink-0" />
            Esta mesa está por pagar: quien despacha cobra en la caja del
            administrador.
          </p>
        ) : null}

        {comandas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[2rem] border-2 border-dashed border-borde-app p-8 text-center text-texto-muted/45">
            <UtensilsCrossed aria-hidden className="h-7 w-7 text-texto-muted/35" />
            <p className="text-sm font-bold text-texto-muted/70">
              Aún no hay comandas en esta mesa hoy.
            </p>
            <p className="text-xs">Toca «Nuevo» para tomar el primer almuerzo.</p>
          </div>
        ) : (
          comandas.map((pedido) => {
            // La comanda se lee en su orden: principio, proteína, ensalada
            // (si la hay) y sopa (si la hay); después adicionales y bebidas
            const items = [...pedido.items].sort(
              (a, b) => ordenDeItem(a.tipo) - ordenDeItem(b.tipo) || a.id - b.id,
            );
            return (
              <article
                key={pedido.id}
                className="rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:rounded-[2rem] sm:p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="font-display text-lg text-texto-app">
                      Comanda #{pedido.id}
                    </span>
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                        (CHIP_ESTADO[pedido.estado] ?? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
                      }
                    >
                      {TXT_ESTADO[pedido.estado] ?? pedido.estado}
                    </span>
                    {pedido.paraLlevar ? (
                      <span className="flex items-center gap-1 rounded-full bg-orange-brand/10 px-2.5 py-0.5 text-[10px] font-bold text-orange-brand ring-1 ring-orange-brand/20">
                        <ShoppingBag aria-hidden className="h-3 w-3" /> Para llevar
                      </span>
                    ) : null}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-texto-muted/45">
                    <Clock aria-hidden className="h-3 w-3" /> {formatHora(pedido.createdAt)}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {items.map((item) => {
                    const Icono = ICONO_TIPO[item.tipo] ?? UtensilsCrossed;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <span
                          className={
                            "flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg " +
                            (CLASE_TIPO[item.tipo] ?? "bg-panel-app text-texto-muted/60")
                          }
                        >
                          <Icono aria-hidden className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-bold text-texto-app">
                          {nombreDeItem(item)}
                          {item.cantidad > 1 ? ` ×${item.cantidad}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                {pedido.observaciones ? (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-panel-app px-3 py-2 text-xs text-texto-muted/70">
                    <MessageSquareText aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-texto-muted/35" />
                    {pedido.observaciones}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between border-t border-dashed border-borde-app pt-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] text-texto-muted/45">
                    <User aria-hidden className="h-3 w-3" />
                    {pedido.mesero?.nombre ?? "—"}
                  </p>
                  <Link
                    href={`/ordenes/comanda/${pedido.id}?reprint=1&volver=/mesero/mesa/${mesa.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-panel-app px-2.5 py-1.5 text-[11px] font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950"
                    title="Volver a imprimir la comanda si el papel se perdió o salió por accidente"
                  >
                    <Printer aria-hidden className="h-3.5 w-3.5" />
                    Reimprimir
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}
