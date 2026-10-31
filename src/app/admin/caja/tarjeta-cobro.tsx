"use client";

import {
  Banknote,
  CreditCard,
  HandCoins,
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

/** Billetes típicos para el atajo del «¿con cuánto paga?» */
const BILLETES = [
  { valor: 10000, txt: "$10.000" },
  { valor: 20000, txt: "$20.000" },
  { valor: 50000, txt: "$50.000" },
  { valor: 100000, txt: "$100.000" },
];

const CHIP_COMANDA: Record<string, string> = {
  ENVIADO: "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
  EN_PREPARACION: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  PARCIAL_SERVIDO: "bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20",
  SERVIDO: "bg-success/10 text-success-text ring-1 ring-success/20",
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
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
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
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
  nombre: string;
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
  const enEfectivo = metodo === "EFECTIVO";

  // ¿Con cuánto pagó el cliente y cuánto se le devuelve? Solo se pide en
  // efectivo; vacío queda como pago exacto.
  const [montoTxt, setMontoTxt] = useState("");
  const montoNum = Number.parseInt(montoTxt.replace(/[^0-9]/g, ""), 10) || null;
  const vueltas = enEfectivo && montoNum !== null ? montoNum - total : null;
  const noAlcanza = vueltas !== null && vueltas < 0;

  const enCocina = mesa.pedidos.filter(
    (p) => p.estado === "ENVIADO" || p.estado === "EN_PREPARACION" || p.estado === "PARCIAL_SERVIDO",
  ).length;

  return (
    <article className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl text-texto-app">
            {mesa.nombre}
          </p>
          <span
            className={
              "mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
              (ESTILO_MESA[mesa.estado] ?? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
            }
          >
            {mesa.estado === "POR_PAGAR" ? "Por pagar" : "Ocupada"}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
            Total a cobrar
          </p>
          <p className="font-display text-3xl text-texto-app">
            {formatCOP(mesa.total)}
          </p>
        </div>
      </div>

      {mesa.pedidos.length === 0 ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-borde-app p-4 text-center text-sm text-texto-muted/45">
          La mesa está ocupada pero no tiene comandas activas hoy.
          Revisa con el mesero antes de cobrar.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            {mesa.pedidos.map((pedido) => (
              <div
                key={pedido.id}
                className="rounded-xl bg-panel-app px-3.5 py-3 ring-1 ring-borde-app"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-texto-app">
                    Comanda #{pedido.id} · {pedido.hora}
                  </p>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (CHIP_COMANDA[pedido.estado] ??
                        "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
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
                      <span className="min-w-0 flex-1 font-bold text-texto-app">
                        {item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                        {item.nombre}
                        {item.sinSopa ? (
                          <span className="ml-1.5 rounded-md bg-panel-app px-1.5 py-0.5 text-[10px] font-bold uppercase text-texto-muted/45">
                            sin sopa
                          </span>
                        ) : null}
                      </span>
                      {item.precio > 0 ? (
                        <span className="font-bold text-texto-app">
                          {formatCOP(item.precio * item.cantidad)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-texto-muted/35">
                          incluido
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {pedido.observaciones ? (
                  <p className="mt-2 text-xs text-texto-muted/45">
                    📝 {pedido.observaciones}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {enCocina > 0 ? (
            <p className="mt-3 rounded-xl bg-warning/10 px-3 py-2 text-xs font-bold text-warning-text ring-1 ring-warning/20">
              ⏳ {enCocina}{" "}
              {enCocina === 1 ? "comanda sigue" : "comandas siguen"} en
              cocina: al cobrar se marcan como pagadas y salen de la lista.
            </p>
          ) : null}

          <form action={accion} className="mt-4 space-y-3.5">
            <input type="hidden" name="mesaId" value={mesa.id} />
            <input type="hidden" name="metodo" value={metodo} />

            {estado.error ? (
              <p className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger-text">
                {estado.error}
              </p>
            ) : null}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
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
                        : "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
                    }
                  >
                    <Icono className="h-4 w-4" /> {txt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                Propina (opcional)
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  name="propina"
                  value={propinaTxt}
                  onChange={(e) => setPropinaTxt(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                  className="w-28 rounded-xl border-0 bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60 placeholder:text-texto-muted/25"
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
                        : "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
                    }
                  >
                    {p.txt}
                  </button>
                ))}
              </div>
            </div>

            {enEfectivo ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                  ¿Con cuánto paga el cliente? (opcional)
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <input
                    name="montoPagado"
                    value={montoTxt}
                    onChange={(e) => setMontoTxt(e.target.value)}
                    inputMode="numeric"
                    placeholder="Billete…"
                    aria-label="Monto entregado por el cliente"
                    className="w-36 flex-1 rounded-xl border-0 bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60 placeholder:text-texto-muted/25"
                  />
                  <button
                    type="button"
                    onClick={() => setMontoTxt(String(total))}
                    className="rounded-full bg-panel-app px-3 py-1.5 text-xs font-bold text-texto-muted/60 ring-1 ring-borde-app transition hover:text-texto-app"
                  >
                    Exacto
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BILLETES.filter((b) => b.valor >= total).map((b) => (
                    <button
                      key={b.valor}
                      type="button"
                      aria-label={`Cliente paga con ${b.txt}`}
                      onClick={() => setMontoTxt(String(b.valor))}
                      className="rounded-full bg-panel-app px-3 py-1.5 text-xs font-bold text-texto-muted/60 ring-1 ring-borde-app transition hover:text-texto-app"
                    >
                      {b.txt}
                    </button>
                  ))}
                </div>

                {noAlcanza ? (
                  <p
                    aria-live="assertive"
                    className="mt-2.5 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm font-bold text-danger-text ring-1 ring-danger/25"
                  >
                    No alcanza: faltan {formatCOP(Math.abs(vueltas ?? 0))}
                  </p>
                ) : vueltas !== null ? (
                  <p
                    aria-live="assertive"
                    className="mt-2.5 flex items-baseline justify-between rounded-xl bg-success/10 px-3.5 py-2.5 text-sm ring-1 ring-success/25"
                  >
                    <span className="flex items-center gap-1.5 font-bold text-success-text">
                      <HandCoins className="h-4 w-4" /> Vueltas
                    </span>
                    <span className="font-display text-xl tabular-nums text-success-text">
                      {formatCOP(vueltas)}
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-texto-muted/50">
                    Si dejas el billete vacío queda registrado como pago exacto.
                  </p>
                )}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pendiente || noAlcanza}
              className={
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg transition " +
                (pendiente
                  ? "bg-panel-app text-texto-muted/60"
                  : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-texto-app")
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

