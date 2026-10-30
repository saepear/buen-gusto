import { Banknote, ClipboardList, DoorOpen, Plus, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { ESTADO_MESA, type EstadoMesa } from "@/lib/roles";
import { requerirRol } from "@/lib/session";
import { EncabezadoMesero } from "./encabezado";

export const metadata = { title: "Mesero · El Buen Gusto" };

export default async function PaginaMesero() {
  const sesion = await requerirRol("MESERO");
  const [mesas, comandas] = await Promise.all([
    db.mesa.findMany({
      where: { activa: true },
      orderBy: { nombre: "asc" },
    }),
    db.pedido.findMany({
      where: {
        estado: { in: ESTADOS_ACTIVOS_PEDIDO },
        createdAt: { gte: inicioDeHoy() },
      },
      select: { mesaId: true, estado: true },
    }),
  ]);

  const vivasPorMesa = new Map<number, number>();
  for (const c of comandas) {
    vivasPorMesa.set(c.mesaId, (vivasPorMesa.get(c.mesaId) ?? 0) + 1);
  }

  const libres = mesas.filter((m) => m.estado === ESTADO_MESA.LIBRE).length;
  const ocupadas = mesas.filter((m) => m.estado === ESTADO_MESA.OCUPADA).length;
  const porPagar = mesas.filter((m) => m.estado === ESTADO_MESA.POR_PAGAR).length;

  const estadisticas = [
    { txt: "Libres", valor: libres, Icono: DoorOpen },
    { txt: "Ocupadas", valor: ocupadas, Icono: UtensilsCrossed },
    { txt: "Por pagar", valor: porPagar, Icono: Banknote },
  ];

  return (
    <div className="min-h-screen bg-fondo-app">
      <EncabezadoMesero usuario={sesion.nombre} titulo="Mis mesas" />

      <main className="mx-auto max-w-lg sm:max-w-2xl p-4 sm:p-6 pb-16">
        {/* Saludo + foto del comedor */}
        <section className="rounded-[2rem] bg-glass-app p-5 ring-1 ring-borde-app shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-brand/20 text-amber-brand ring-1 ring-amber-brand/30">
              <UtensilsCrossed className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl text-cream-50">
                ¡Hola, {sesion.nombre}!
              </h1>
              <p className="text-xs text-texto-muted/70">
                Toca una mesa para ver sus comandas o tomar un pedido nuevo.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {estadisticas.map(({ txt, valor, Icono }) => (
              <div
                key={txt}
                className="rounded-2xl bg-panel-app p-2.5 text-center ring-1 ring-borde-app"
              >
                <p className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                  <Icono className="h-3 w-3" /> {txt}
                </p>
                <p className="mt-0.5 font-display text-lg text-amber-brand">{valor}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tarjetas por mesa */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {mesas.map((mesa) => {
            const estado = mesa.estado as EstadoMesa;
            const libre = estado === ESTADO_MESA.LIBRE;
            const vivas = vivasPorMesa.get(mesa.id) ?? 0;
            const porPagarMesa = !libre && estado === ESTADO_MESA.POR_PAGAR;
            return (
              <Link
                key={mesa.id}
                href={`/mesero/mesa/${mesa.id}`}
                className={
                  "group flex flex-col items-center rounded-3xl p-3.5 pt-4 text-center transition active:scale-95 " +
                  (libre
                    ? "bg-panel-app ring-1 ring-borde-app hover:ring-amber-brand/50"
                    : porPagarMesa
                      ? "bg-warning/10 ring-1 ring-warning/40"
                      : "bg-orange-brand/10 ring-1 ring-orange-brand/40")
                }
              >
                <span className="w-full truncate font-display text-base leading-tight text-texto-app">
                  {mesa.nombre}
                </span>
                <span
                  className={
                    "mt-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide " +
                    (libre
                      ? "bg-success/10 text-success-text ring-1 ring-success/20"
                      : porPagarMesa
                        ? "bg-warning/10 text-warning-text ring-1 ring-warning/20"
                        : "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20")
                  }
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (libre
                        ? "bg-success"
                        : porPagarMesa
                          ? "bg-amber-600"
                          : "bg-orange-brand")
                    }
                  />
                  {libre ? "Libre" : porPagarMesa ? "Por pagar" : "Ocupada"}
                </span>

                {libre ? (
                  <span className="mt-3 flex items-center gap-1 rounded-full bg-orange-brand/10 px-2.5 py-1 text-[11px] font-bold text-orange-brand group-hover:bg-orange-brand group-hover:text-texto-app">
                    <Plus className="h-3 w-3" /> Tomar pedido
                  </span>
                ) : (
                  <span className="mt-3 flex items-center gap-1 rounded-full bg-panel-app px-2.5 py-1 text-[11px] font-bold text-texto-muted/70 ring-1 ring-borde-app">
                    <ClipboardList className="h-3 w-3" />
                    {vivas} {vivas === 1 ? "comanda" : "comandas"}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-texto-muted/45">
          <UtensilsCrossed className="h-3.5 w-3.5" />
          Las porciones disponibles se descuentan en cuanto envías la comanda.
        </p>
      </main>
    </div>
  );
}

