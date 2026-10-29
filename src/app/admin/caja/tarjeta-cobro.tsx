"use client";

import {
  Banknote,
  CreditCard,
  Landmark,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { useActionState, useState } from "react";
import { formatCOP } from "@/lib/format";
import { cobrarMesa, type EstadoAccionCaja } from "./acciones";

const SIN_ERROR: EstadoAccionCaja = { error: null };

const METODOS = [
  { valor: "EFECTIVO", txt: "Efectivo", Icono: Banknote },
  { valor: "TARJETA", txt: "Tarjeta", Icono: CreditCard },
  { valor: "TRANSFERENCIA", txt: "Transferencia", Icono: Landmark },
] as const;

const PRESET_PROPINA = [
  { valor: "", txt: "Sin propina" },
  { valor: "1000", txt: "$1.000" },
  { valor: "2000", txt: "$2.000" },
];

const CHIP_COMANDA: Record<string, string> = {
  ENVIADO: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  EN_PREPARACION: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  PARCIAL_SERVIDO: "bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20",
  SERVIDO: "bg-success/10 text-[#a7dd83] ring-1 ring-success/20",
  POR_PAGAR: "bg-warning/10 text-[#f0cf6d] ring-1 ring-warning/20",
};

const CHIP_COMANDA_TXT: Record<string, string> = {
  ENVIADO: "En cocina",
  EN_PREPARACION: "En preparación",
  PARCIAL_SERVIDO: "Parcial",
  SERVIDO: "Servida",
  POR_PAGAR: "Por pagar",
};

const ESTILO_MESA: Record<string, string> = {
  OCUPADA: "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
  POR_PAGAR: "bg-warning/10 text-[#f0cf6d] ring-1 ring-warning/20",
};

export type ItemCuenta = {
  nombre: string;
  cantidad: number;
  sinSopa: boolean;
  precio: number;
};

export type ComandaCuenta = {
  id: number;
  hora: string;
  estado: string;
  paraLlevar: boolean;
  observaciones: string | null;
  items: ItemCuenta[];
};

export type MesaParaCobrar = {
  id: number;
  numero: number;
  estado: string;
  total: number;
  pedidos: ComandaCuenta[];
};

export function TarjetaCobro({ mesa }: { mesa: MesaParaCobrar }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionCaja, FormData>(
    cobrarMesa,
    SIN_ERROR,
  );
  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [propinaTxt, setPropinaTxt] = useState("");

  const propinaNum =
    Number.parseInt(propinaTxt.replace(/[^0-9]/g, ""), 10) || 0;
  const total = mesa.total + propinaNum;
  const enCocina = mesa.pedidos.filter(
    (p) => p.estado === "ENVIADO" || p.estado === "EN_PREPARACION" || p.estado === "PARCIAL_SERVIDO",
  ).length;

  return (
    <article className="rounded-[2rem] bg-white/[0.02] p-5 ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-white">
            Mesa #{mesa.numero}
          </p>
          <span
            className={
              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
              (ESTILO_MESA[mesa.estado] ?? "bg-white/5 text-cream-200/60 ring-1 ring-white/10")
            }
          >
            {mesa.estado === "POR_PAGAR" ? "Por pagar" : "Ocupada"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
            Total a cobrar
          </p>
          <p className="font-display text-3xl text-white">
            {formatCOP(mesa.total)}
          </p>
        </div>
      </div>

      {mesa.pedidos.length === 0 ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-white/10 p-4 text-center text-sm text-cream-200/45">
          La mesa está ocupada pero no tiene comandas activas hoy.
          Revisa con el mesero antes de cobrar.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {mesa.pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="rounded-xl bg-white/5 px-3.5 py-3 ring-1 ring-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-cream-100">
                    Comanda #{pedido.id} · {pedido.hora}
                  </p>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (CHIP_COMANDA[pedido.estado] ??
                        "bg-white/5 text-cream-200/60 ring-1 ring-white/10")
                    }
                  >
                    {CHIP_COMANDA_TXT[pedido.estado] ?? pedido.estado}
                  </span>
                  {pedido.paraLlevar ? (
                    <span className="flex items-center gap-1 rounded-full bg-orange-brand/10 px-2 py-0.5 text-[10px] font-bold text-orange-brand ring-1 ring-orange-brand/20">
                      <ShoppingBag className="h-3 w-3" /> Para llevar
                    </span>
                  ) : null}
                </div>

                <ul className="mt-2 space-y-1">
                  {pedido.items.map((item, i) => (
                    <li
                      key={`${pedido.id}-${i}`}
                      className="flex items-baseline gap-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 font-bold text-white">
                        {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                        {item.nombre}
                        {item.sinSopa ? (
                          <span className="ml-1.5 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cream-200/45">
                            sin sopa
                          </span>
                        ) : null}
                      </span>
                      {item.precio > 0 ? (
                        <span className="font-bold text-cream-100">
                          {formatCOP(item.precio * item.cantidad)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-cream-200/35">
                          incluido
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {pedido.observaciones ? (
                  <p className="mt-2 text-xs text-cream-200/45">
                    📝 {pedido.observaciones}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {enCocina > 0 ? (
            <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs font-bold text-[#f0cf6d] ring-1 ring-warning/20">
              ⏳ {enCocina}{" "}
              {enCocina === 1 ? "comanda sigue" : "comandas siguen"} en
              cocina: al cobrar se marcan como pagadas y salen de la lista.
            </p>
          ) : null}

          <form action={accion} className="mt-4 space-y-3.5">
            <input type="hidden" name="mesaId" value={mesa.id} />
            <input type="hidden" name="metodo" value={metodo} />

            {estado.error ? (
              <p className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-[#f0a6a3]">
                {estado.error}
              </p>
            ) : null}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
                Método de pago
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {METODOS.map(({ valor, txt, Icono }) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setMetodo(valor)}
                    className={
                      "flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-bold transition " +
                      (metodo === valor
                        ? "bg-amber-brand text-brown-950"
                        : "bg-white/5 text-cream-200/60 ring-1 ring-white/10")
                    }
                  >
                    <Icono className="h-4 w-4" /> {txt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
                Propina (opcional)
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  name="propina"
                  value={propinaTxt}
                  onChange={(e) => setPropinaTxt(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-28 rounded-xl border-0 bg-white/5 px-3 py-2.5 text-sm font-bold text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-brand/60 placeholder:text-cream-200/25"
                />
                {PRESET_PROPINA.map((p) => (
                  <button
                    key={p.valor}
                    type="button"
                    aria-label={
                      p.valor === ""
                        ? "Sin propina"
                        : `Propina de $${p.valor}`
                    }
                    onClick={() => setPropinaTxt(p.valor)}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-bold transition " +
                      (propinaTxt === p.valor
                        ? "bg-amber-brand text-brown-950"
                        : "bg-white/5 text-cream-200/60 ring-1 ring-white/10")
                    }
                  >
                    {p.txt}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={pendiente}
              className={
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg transition " +
                (pendiente
                  ? "bg-white/5 text-cream-200/60"
                  : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-white")
              }
            >
              <Wallet className="h-5 w-5" />
              {pendiente
                ? "Cobrando…"
                : `Cobrar ${formatCOP(total)}`}
            </button>
          </form>
        </>
      )}
    </article>
  );
}
