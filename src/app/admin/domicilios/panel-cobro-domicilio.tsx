"use client";

import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  NotebookPen,
  UserRound,
  Wallet,
} from "lucide-react";
import { useActionState, useState } from "react";
import { formatCOP } from "@/lib/format";
import {
  cobrarDomicilio,
  fiarDomicilio,
  type EstadoAccionDomicilio,
} from "./actions";

const INICIAL: EstadoAccionDomicilio = { error: null, ok: null };

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

/** Billetes típicos del bolsillo para el atajo del «¿con cuánto paga?» */
const BILLETES = [
  { valor: 10000, txt: "$10.000" },
  { valor: 20000, txt: "$20.000" },
  { valor: 50000, txt: "$50.000" },
  { valor: 100000, txt: "$100.000" },
];

/**
 * El pago del domicilio: método de pago, propina y — solo en efectivo —
 * el billete con el que paga el cliente con sus vueltas en vivo. Al
 * confirmar, la acción del servidor manda directo a la factura imprimible.
 * También puede qedar FIADO: nace la deuda (no entra a caja) o — si el
 * cliente deja dinero ahora — entra ese abono y la deuda queda por el resto.
 * Vive a nivel del módulo de domicilios para que también la use la caja.
 */
export function PanelCobroDomicilio({
  domicilioId,
  total,
  fichaCliente = null,
}: {
  domicilioId: number;
  total: number;
  /** Ficha del cliente del domicilio: la deuda se va a su historial */
  fichaCliente?: { id: number; nombre: string } | null;
}) {
  const [estado, accion, pendiente] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(cobrarDomicilio, INICIAL);
  const [estadoFiado, accionFiado, pendienteFiado] = useActionState<
    EstadoAccionDomicilio,
    FormData
  >(fiarDomicilio, INICIAL);
  const [modo, setModo] = useState<"cobrar" | "fiado">("cobrar");
  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [propinaTxt, setPropinaTxt] = useState("");
  const [montoTxt, setMontoTxt] = useState("");
  // Dinero que el cliente deja al fiar (abono parcial opcional)
  const [abonoTxt, setAbonoTxt] = useState("");
  const abonoNum =
    Number.parseInt(abonoTxt.replace(/[^0-9]/g, ""), 10) || 0;

  const propinaNum = Number.parseInt(propinaTxt.replace(/[^0-9]/g, ""), 10) || 0;
  const aCobrar = total + propinaNum;
  const enEfectivo = metodo === "EFECTIVO";

  const montoNum =
    Number.parseInt(montoTxt.replace(/[^0-9]/g, ""), 10) || null;
  const vueltas =
    enEfectivo && montoNum !== null ? montoNum - aCobrar : null;
  const noAlcanza = vueltas !== null && vueltas < 0;

  return (
    <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-2xl text-texto-app">Cobro</p>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
            A cobrar
          </p>
          <p aria-live="polite" className="font-display text-3xl text-texto-app">
            {formatCOP(aCobrar)}
          </p>
        </div>
      </div>

      <form
        action={modo === "cobrar" ? accion : accionFiado}
        className="mt-4 space-y-3.5"
      >
        <input type="hidden" name="domicilioId" value={domicilioId} />
        <input type="hidden" name="metodo" value={metodo} />
        <input type="hidden" name="metodoAbono" value={metodo} />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={modo === "cobrar"}
            onClick={() => setModo("cobrar")}
            className={
              "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition " +
              (modo === "cobrar"
                ? "bg-amber-brand text-brown-950"
                : "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app hover:text-texto-app")
            }
          >
            <Wallet className="h-4 w-4" /> Pagar ahora
          </button>
          <button
            type="button"
            aria-pressed={modo === "fiado"}
            onClick={() => setModo("fiado")}
            className={
              "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition " +
              (modo === "fiado"
                ? "bg-violeta-text text-white"
                : "bg-panel-app text-violeta-text ring-1 ring-violeta-text/30 hover:bg-violeta-text/10")
            }
          >
            <NotebookPen className="h-4 w-4" /> Fiado (deuda)
          </button>
        </div>

        {estado.error ? (
          <p
            aria-live="polite"
            className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm font-bold text-danger-text"
          >
            {estado.error}
          </p>
        ) : null}
        {estadoFiado.error ? (
          <p
            aria-live="polite"
            className="rounded-xl border-2 border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm font-bold text-danger-text"
          >
            {estadoFiado.error}
          </p>
        ) : estadoFiado.ok ? (
          <p
            aria-live="polite"
            className="rounded-xl border-2 border-success/30 bg-success/10 px-3.5 py-2.5 text-sm font-bold text-success-text"
          >
            {estadoFiado.ok}
          </p>
        ) : null}

        {modo === "cobrar" ? (
          <>
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
                aria-pressed={metodo === valor}
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
              aria-label="Propina en pesos"
              className="w-28 rounded-xl border-0 bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60 placeholder:text-texto-muted/25"
            />
            {PRESET_PROPINA.map((p) => (
              <button
                key={p.valor}
                type="button"
                aria-label={
                  p.valor === "" ? "Sin propina" : `Propina de $${p.valor}`
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
                onClick={() => setMontoTxt(String(aCobrar))}
                className="rounded-full bg-panel-app px-3 py-1.5 text-xs font-bold text-texto-muted/60 ring-1 ring-borde-app transition hover:text-texto-app"
              >
                Exacto
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {BILLETES.filter((b) => b.valor >= aCobrar).map((b) => (
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
              {aCobrar > 100000 ? (
                <span className="self-center text-[10px] font-bold uppercase text-texto-muted/40">
                  Billete grande: digítalo arriba
                </span>
              ) : null}
            </div>

            {/* Das las vueltas en vivo: nadie las calcula con el celular */}
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
        ) : (
          <p className="rounded-xl bg-campo-app px-3.5 py-3 text-xs font-bold text-texto-muted/60">
            {metodo === "TARJETA"
              ? "El datáfono cobra el monto exacto: no hay vueltas que registrar."
              : "La transferencia llega exacta: no hay vueltas que registrar."}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente || noAlcanza}
          className={
            "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg transition " +
            (pendiente || noAlcanza
              ? "cursor-not-allowed bg-panel-app text-texto-muted/50"
              : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-texto-app")
          }
        >
          <Wallet className="h-5 w-5" />
          {pendiente ? "Cobrando…" : `Cobrar ${formatCOP(aCobrar)}`}
        </button>
          </>
        ) : (
          <>
            <p className="text-xs text-texto-muted/60">
              La comanda queda{" "}
              <b className="text-violeta-text">fiada</b>: nace la deuda de{" "}
              <b className="text-texto-app">{fichaCliente?.nombre ?? "el cliente"}</b>{" "}
              y no suma a caja. El recaudo entra el día que abonen.
            </p>

            {fichaCliente?.id ? (
              <input type="hidden" name="clienteId" value={fichaCliente.id} />
            ) : null}
            {!fichaCliente ? (
              <p className="rounded-xl bg-warning/10 px-3.5 py-2.5 text-xs font-bold text-warning-text ring-1 ring-warning/25">
                Este domicilio no tiene ficha de cliente: no se puede fiar.
                Regístrala en «Clientes» y vuelve a intentarlo.
              </p>
            ) : null}

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                Dinero que deja ahora (opcional)
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input
                  name="abonoAhora"
                  value={abonoTxt}
                  onChange={(e) => setAbonoTxt(e.target.value)}
                  inputMode="numeric"
                  placeholder="Abono parcial…"
                  aria-label="Dinero que el cliente entrega al fiar"
                  className="w-36 flex-1 rounded-xl border-0 bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60 placeholder:text-texto-muted/25"
                />
                <button
                  type="button"
                  onClick={() => setAbonoTxt("")}
                  className="rounded-full bg-panel-app px-3 py-1.5 text-xs font-bold text-texto-muted/60 ring-1 ring-borde-app transition hover:text-texto-app"
                >
                  Nada
                </button>
              </div>
              {abonoNum > 0 && abonoNum < total ? (
                <p
                  aria-live="polite"
                  className="mt-1.5 flex items-baseline justify-between rounded-xl bg-success/10 px-3.5 py-2 text-xs font-bold ring-1 ring-success/25"
                >
                  <span className="text-success-text">
                    Deja {formatCOP(abonoNum)} (entra a caja)
                  </span>
                  <span className="text-warning-text">
                    Fiado por {formatCOP(total - abonoNum)}
                  </span>
                </p>
              ) : abonoNum >= total ? (
                <p
                  aria-live="assertive"
                  className="mt-1.5 rounded-xl bg-danger/10 px-3.5 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/25"
                >
                  Con {formatCOP(abonoNum)} alcanza para pagar el domicilio
                  completo: usa «Pagar ahora».
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-texto-muted/50">
                  Vacío = la deuda nace por el total del domicilio.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={pendienteFiado || !fichaCliente || abonoNum >= total}
              className={
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg transition " +
                (pendienteFiado || !fichaCliente || abonoNum >= total
                  ? "cursor-not-allowed bg-panel-app text-texto-muted/50"
                  : "bg-violeta-text text-white hover:bg-violeta-text/85")
              }
            >
              <NotebookPen className="h-5 w-5" />
              {pendienteFiado
                ? "Fianado…"
                : `Fiado ${formatCOP(Math.max(0, total - abonoNum))}`}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
