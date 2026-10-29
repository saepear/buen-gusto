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
  ENVIADO: "bg-amber-brand/20 text-amber-800",
  EN_PREPARACION: "bg-[#4aa3ff]/20 text-[#205a8a]",
  PARCIAL_SERVIDO: "bg-[#b06fd0]/20 text-[#703a8a]",
  SERVIDO: "bg-success/20 text-success-dark",
  POR_PAGAR: "bg-warning/30 text-amber-700",
};

const CHIP_COMANDA_TXT: Record<string, string> = {
  ENVIADO: "En cocina",
  EN_PREPARACION: "En preparación",
  PARCIAL_SERVIDO: "Parcial",
  SERVIDO: "Servida",
  POR_PAGAR: "Por pagar",
};

const ESTILO_MESA: Record<string, string> = {
  OCUPADA: "bg-orange-brand/15 text-orange-brand",
  POR_PAGAR: "bg-warning/25 text-amber-700",
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
    <article className="rounded-2xl bg-white p-5 ring-1 ring-cream-300">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-brown-800">
            Mesa #{mesa.numero}
          </p>
          <span
            className={
              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
              (ESTILO_MESA[mesa.estado] ?? "bg-cream-200 text-brown-600")
            }
          >
            {mesa.estado === "POR_PAGAR" ? "Por pagar" : "Ocupada"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-brown-500">
            Total a cobrar
          </p>
          <p className="font-display text-3xl text-brown-800">
            {formatCOP(mesa.total)}
          </p>
        </div>
      </div>

      {mesa.pedidos.length === 0 ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-brown-600/25 p-4 text-center text-sm text-brown-500">
          La mesa está ocupada pero no tiene comandas activas hoy.
          Revisa con el mesero antes de cobrar.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {mesa.pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="rounded-xl bg-cream-50 px-3.5 py-3 ring-1 ring-cream-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-brown-700">
                    Comanda #{pedido.id} · {pedido.hora}
                  </p>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (CHIP_COMANDA[pedido.estado] ??
                        "bg-cream-200 text-brown-600")
                    }
                  >
                    {CHIP_COMANDA_TXT[pedido.estado] ?? pedido.estado}
                  </span>
                  {pedido.paraLlevar ? (
                    <span className="flex items-center gap-1 rounded-full bg-orange-brand/15 px-2 py-0.5 text-[10px] font-bold text-orange-brand">
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
                      <span className="min-w-0 flex-1 font-bold text-brown-800">
                        {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                        {item.nombre}
                        {item.sinSopa ? (
                          <span className="ml-1.5 rounded-md bg-cream-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brown-500">
                            sin sopa
                          </span>
                        ) : null}
                      </span>
                      {item.precio > 0 ? (
                        <span className="font-bold text-brown-700">
                          {formatCOP(item.precio * item.cantidad)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-brown-400">
                          incluido
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {pedido.observaciones ? (
                  <p className="mt-2 text-xs text-brown-500">
                    📝 {pedido.observaciones}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {enCocina > 0 ? (
            <p className="mt-3 rounded-xl bg-warning/20 px-3 py-2 text-xs font-bold text-amber-700">
              ⏳ {enCocina}{" "}
              {enCocina === 1 ? "comanda sigue" : "comandas siguen"} en
              cocina: al cobrar se marcan como pagadas y salen de la lista.
            </p>
          ) : null}

          <form action={accion} className="mt-4 space-y-3.5">
            <input type="hidden" name="mesaId" value={mesa.id} />
            <input type="hidden" name="metodo" value={metodo} />

            {estado.error ? (
              <p className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                {estado.error}
              </p>
            ) : null}

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brown-500">
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
                        ? "bg-brown-800 text-cream-100"
                        : "bg-cream-50 text-brown-600 ring-1 ring-cream-300")
                    }
                  >
                    <Icono className="h-4 w-4" /> {txt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brown-500">
                Propina (opcional)
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  name="propina"
                  value={propinaTxt}
                  onChange={(e) => setPropinaTxt(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-28 rounded-xl border-0 bg-cream-50 px-3 py-2.5 text-sm font-bold text-brown-800 ring-1 ring-cream-300 focus:ring-2 focus:ring-amber-brand"
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
                        ? "bg-brown-800 text-cream-100"
                        : "bg-cream-100 text-brown-600 ring-1 ring-cream-300")
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
                  ? "bg-brown-800/50 text-cream-200/60"
                  : "bg-orange-brand text-white hover:bg-amber-brand")
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
