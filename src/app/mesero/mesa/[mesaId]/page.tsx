import {
  Banknote,
  CheckCircle2,
  Clock,
  CupSoda,
  Drumstick,
  MessageSquareText,
  Plus,
  Salad,
  ShoppingBag,
  Soup,
  Star,
  User,
  UtensilsCrossed,
  Wallet,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { precioUnitarioItem } from "@/lib/precios";
import { formatCOP, formatHora } from "@/lib/format";
import { ESTADO_MESA } from "@/lib/roles";
import { requerirRol } from "@/lib/session";
import { EncabezadoMesero } from "../../encabezado";

export const metadata = { title: "Mesa · El Buen Gusto" };

const CHIP_ESTADO: Record<string, string> = {
  ENVIADO: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  EN_PREPARACION: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  PARCIAL_SERVIDO: "bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20",
  SERVIDO: "bg-success/10 text-[#a7dd83] ring-1 ring-success/20",
  POR_PAGAR: "bg-warning/10 text-[#f0cf6d] ring-1 ring-warning/20",
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
  PRINCIPIO: "bg-success/10 text-[#a7dd83] ring-1 ring-success/20",
  ENSALADA: "bg-[#4ec27e]/10 text-[#8fdcae] ring-1 ring-[#4ec27e]/20",
  SOPA: "bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20",
  BEBIDA: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
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

  const mesa = await db.mesa.findFirst({ where: { id: mesaId, activa: true } });
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
    <div className="min-h-screen bg-fondo-kds">
      <EncabezadoMesero
        usuario={sesion.nombre}
        titulo={`Mesa #${mesa.numero}`}
        volver={{ href: "/mesero", texto: "Mesas" }}
      />

      <main className="mx-auto max-w-lg sm:max-w-2xl space-y-3.5 p-4 sm:p-6 pb-24">
        {nuevo ? (
          <div className="flex items-center gap-2.5 rounded-2xl bg-success/10 px-4 py-3 text-sm font-bold text-[#a7dd83] ring-1 ring-success/40">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Comanda #{nuevo} enviada a la cocina. Mira su avance aquí mismo.
          </div>
        ) : null}

        {/* Resumen de la mesa */}
        <section className="flex items-center justify-between gap-3 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 " +
                (libre
                  ? "bg-success/10 text-[#a7dd83] ring-success/30"
                  : porPagar
                    ? "bg-warning/10 text-[#f0cf6d] ring-warning/40"
                    : "bg-orange-brand/10 text-orange-brand ring-orange-brand/30")
              }
            >
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl leading-none text-white">
                Mesa #{mesa.numero}
              </p>
              <span
                className={
                  "mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                  (libre
                    ? "bg-success/10 text-[#a7dd83] ring-1 ring-success/20"
                    : porPagar
                      ? "bg-warning/10 text-[#f0cf6d] ring-1 ring-warning/20"
                      : "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20")
                }
              >
                {libre ? "Libre" : porPagar ? "Por pagar" : "Ocupada"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            {granTotal > 0 ? (
              <p className="text-right text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
                Consumo de hoy
              </p>
            ) : null}
            <Link
              href={`/mesero/mesa/${mesa.id}/nuevo`}
              className={
                "flex items-center gap-1.5 rounded-2xl bg-amber-brand px-4 py-2.5 font-display font-bold text-brown-950 shadow-lg shadow-amber-brand/20 transition hover:bg-orange-brand hover:text-white active:scale-95 " +
                (granTotal > 0 ? "order-first text-md" : "")
              }
            >
              <Plus className="h-4.5 w-4.5" /> Nuevo
            </Link>
            {granTotal > 0 ? (
              <p className="text-right font-display text-lg text-white">
                {formatCOP(granTotal)}
              </p>
            ) : null}
          </div>
        </section>

        {porPagar ? (
          <p className="flex items-center gap-2.5 rounded-2xl bg-warning/10 px-4 py-3 text-xs font-bold text-[#f0cf6d] ring-1 ring-warning/40">
            <Banknote className="h-5 w-5 shrink-0" />
            Esta mesa está por pagar: quien despacha cobra en la caja del
            administrador.
          </p>
        ) : null}

        {comandas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[2rem] border-2 border-dashed border-white/10 p-8 text-center text-cream-200/45">
            <UtensilsCrossed className="h-7 w-7 text-cream-200/35" />
            <p className="text-sm font-bold text-cream-200/70">
              Aún no hay comandas en esta mesa hoy.
            </p>
            <p className="text-xs">Toca «Nuevo» para tomar el primer almuerzo.</p>
          </div>
        ) : (
          comandas.map((pedido) => {
            const totalComanda = pedido.items.reduce(
              (x, item) => x + precioUnitarioItem(item) * item.cantidad,
              0,
            );
            return (
              <article
                key={pedido.id}
                className="rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="font-display text-lg text-white">
                      Comanda #{pedido.id}
                    </span>
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                        (CHIP_ESTADO[pedido.estado] ?? "bg-white/5 text-cream-200/60 ring-1 ring-white/10")
                      }
                    >
                      {TXT_ESTADO[pedido.estado] ?? pedido.estado}
                    </span>
                    {pedido.paraLlevar ? (
                      <span className="flex items-center gap-1 rounded-full bg-orange-brand/10 px-2.5 py-0.5 text-[10px] font-bold text-orange-brand ring-1 ring-orange-brand/20">
                        <ShoppingBag className="h-3 w-3" /> Para llevar
                      </span>
                    ) : null}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-cream-200/45">
                    <Clock className="h-3 w-3" /> {formatHora(pedido.createdAt)}
                  </span>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {pedido.items.map((item) => {
                    const Icono = ICONO_TIPO[item.tipo] ?? UtensilsCrossed;
                    return (
                      <li
                        key={item.id}
                        className="flex items-center gap-2.5 text-sm"
                      >
                        <span
                          className={
                            "flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg " +
                            (CLASE_TIPO[item.tipo] ?? "bg-white/5 text-cream-200/60")
                          }
                        >
                          <Icono className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-bold text-white">
                          {item.producto.nombre}
                          {item.cantidad > 1 ? ` ×${item.cantidad}` : ""}
                        </span>
                        {item.tipo === "PROTEINA" && item.conSopa === false ? (
                          <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-cream-200/60 ring-1 ring-white/10">
                            sin sopa
                          </span>
                        ) : null}
                        {precioUnitarioItem(item) > 0 ? (
                          <span className="shrink-0 text-xs font-bold text-cream-200/70">
                            {formatCOP(precioUnitarioItem(item) * item.cantidad)}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {pedido.observaciones ? (
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-cream-200/70">
                    <MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cream-200/35" />
                    {pedido.observaciones}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between border-t border-dashed border-white/10 pt-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] text-cream-200/45">
                    <User className="h-3 w-3" />
                    {pedido.mesero?.nombre ?? "—"}
                  </p>
                  {totalComanda > 0 ? (
                    <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <Wallet className="h-3.5 w-3.5 text-cream-200/35" />
                      {formatCOP(totalComanda)}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}
