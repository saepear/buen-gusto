"use client";

import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  ArrowUpRight,
  Search,
  ShoppingBag,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";
import { buscarClientesPicker } from "@/app/admin/clientes/actions";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { cobrarMesa, fiarCuenta, type EstadoAccionCaja } from "./acciones";

const SIN_ERROR: EstadoAccionCaja = { error: null };

/** Ficha breve para el picker del fiado (igual que en Cuentas por cobrar) */
type OpcionCliente = { id: number; etiqueta: string };

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
  EN_PREPARACION: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  PARCIAL_SERVIDO: "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
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
  numero: number;
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
  // Segundo canal: fiar la mesa (deuda sin ingreso de caja)
  const [estadoFiado, accionFiado, pendienteFiado] = useActionState<
    EstadoAccionCaja,
    FormData
  >(fiarCuenta, SIN_ERROR);
  const [modo, setModo] = useState<"pagar" | "fiado">("pagar");
  const [metodo, setMetodo] = useState<string>("EFECTIVO");
  const [propinaTxt, setPropinaTxt] = useState("");
  const [origenModal, setOrigenModal] = useState<OrigenModal | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // ── Picker de cliente para el fiado (búsqueda paginada en BD, igual que
  // en Cuentas por cobrar; 8 fichas por página con debounce de 250 ms) ──
  const [terminoFiado, setTerminoFiado] = useState("");
  const [paginaFiado, setPaginaFiado] = useState(1);
  const [candidatas, setCandidatas] = useState<OpcionCliente[]>([]);
  const [candidatasTotal, setCandidatasTotal] = useState(0);
  const [buscandoFiado, setBuscandoFiado] = useState(false);
  const [clienteElejido, setClienteElejido] = useState<OpcionCliente | null>(
    null,
  );
  useEffect(() => {
    let cancelada = false;
    const t = setTimeout(async () => {
      if (cancelada) return;
      setBuscandoFiado(true);
      try {
        const r = await buscarClientesPicker(terminoFiado, paginaFiado);
        if (cancelada) return;
        setCandidatas(r.filas);
        setCandidatasTotal(r.total);
      } finally {
        if (!cancelada) setBuscandoFiado(false);
      }
    }, 250);
    return () => {
      cancelada = true;
      clearTimeout(t);
    };
  }, [terminoFiado, paginaFiado]);
  const paginasFiado = Math.max(1, Math.ceil(candidatasTotal / 8));

  // Dinero que el cliente deja AHORA al fiar (abono parcial opcional)
  const [abonoTxt, setAbonoTxt] = useState("");
  const abonoNum =
    Number.parseInt(abonoTxt.replace(/[^0-9]/g, ""), 10) || 0;

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

  const resumenItems = mesa.pedidos
    .flatMap((pedido) => pedido.items.map((item) => `${item.cantidad > 1 ? `${item.cantidad}× ` : ""}${item.nombre}`))
    .slice(0, 3);
  const itemsRestantes = mesa.pedidos.reduce((total, pedido) => total + pedido.items.length, 0) - resumenItems.length;

  function abrir() {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      setOrigenModal({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
    }
  }

  function cerrar() {
    setOrigenModal(null);
    trigger.current?.focus();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={abrir}
        aria-label={`Abrir cobro de ${mesa.nombre}`}
        className="caja-table-trigger caja-charge-card w-full rounded-[2rem] bg-panel-app p-5 text-left ring-1 ring-borde-app transition hover:-translate-y-0.5 hover:ring-amber-brand/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand"
      >
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block font-display text-2xl text-texto-app">{mesa.nombre}</span>
            <span className={"mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide " + (ESTILO_MESA[mesa.estado] ?? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")}>
              {mesa.estado === "POR_PAGAR" ? "Por pagar" : "Ocupada"}
            </span>
          </span>
          <span className="text-right">
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">Total a cobrar</span>
            <span className="block font-display text-3xl text-texto-app">{formatCOP(mesa.total)}</span>
          </span>
        </span>
        <span className="mt-4 flex items-center gap-2 rounded-xl bg-campo-app px-3.5 py-3 text-sm text-texto-muted/75">
          <span className="min-w-0 flex-1 truncate">
            {resumenItems.length > 0 ? resumenItems.join(" · ") : "Sin comandas activas"}
            {itemsRestantes > 0 ? ` · +${itemsRestantes}` : ""}
          </span>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-brand" />
        </span>
        <span className="mt-3 flex items-center justify-between text-xs font-bold">
          <span className="text-texto-muted/55">{mesa.pedidos.length} {mesa.pedidos.length === 1 ? "comanda" : "comandas"}{enCocina > 0 ? " · En cocina" : ""}</span>
          <span className="text-amber-brand">Abrir cobro</span>
        </span>
      </button>

      {origenModal ? (
        <ModalFlip rapida animacion="suave" origen={origenModal} onClose={cerrar} ariaLabel={`Cobro de ${mesa.nombre}`} panelClassName="caja-charge-modal">
          {(cerrarModal) => (
    <article className="caja-charge-card max-h-[88vh] overflow-y-auto rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
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
        <div className="flex items-start gap-3 text-right">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
              Total a cobrar
            </p>
            <p className="font-display text-3xl text-texto-app">
              {formatCOP(mesa.total)}
            </p>
          </div>
          <button
            type="button"
            onClick={cerrarModal}
            aria-label="Cerrar cobro"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-panel-app text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
          >
            <X className="h-4 w-4" />
          </button>
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
                    Comanda #{pedido.numero} · {pedido.hora}
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

          {estado.error ? (
            <p className="mt-3 rounded-xl border-2 border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger-text">
              {estado.error}
            </p>
          ) : estado.ok ? (
            <p
              aria-live="polite"
              className="mt-3 rounded-xl border-2 border-success/30 bg-success/10 px-3 py-2 text-sm font-bold text-success-text"
            >
              {estado.ok}
            </p>
          ) : null}

          {estadoFiado.error ? (
            <p
              aria-live="polite"
              className="mt-3 rounded-xl border-2 border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger-text"
            >
              {estadoFiado.error}
            </p>
          ) : estadoFiado.ok ? (
            <p
              aria-live="polite"
              className="mt-3 rounded-xl border-2 border-success/30 bg-success/10 px-3 py-2 text-sm font-bold text-success-text"
            >
              {estadoFiado.ok}
            </p>
          ) : null}

          {/* ¿Dinero ahora o fiado? El fiado NO ingresa a caja: crea la deuda */}
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
              ¿Cómo queda esta mesa?
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={modo === "pagar"}
                onClick={() => setModo("pagar")}
                className={
                  "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition " +
                  (modo === "pagar"
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
                <UserRound className="h-4 w-4" /> Fiado (deuda)
              </button>
            </div>
          </div>

          {modo === "pagar" ? (
            <form action={accion} className="mt-4 space-y-3.5">
            <input type="hidden" name="mesaId" value={mesa.id} />
            <input type="hidden" name="metodo" value={metodo} />

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
          ) : (
            <form action={accionFiado} className="mt-4 space-y-3.5">
              <input type="hidden" name="mesaId" value={mesa.id} />
              <input type="hidden" name="metodoAbono" value={metodo} />

              <p className="text-xs text-texto-muted/60">
                La comanda queda <b className="text-violeta-text">fiada</b>: sale de
                las colas y nace la deuda de{" "}
                <b className="text-texto-app">
                  {clienteElejido ? clienteElejido.etiqueta : "el cliente que elijas"}
                </b>.
                No suma a la caja: entra el día que abonen.
              </p>

              {clienteElejido ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                    Cliente de la deuda
                  </p>
                  <p className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app ring-1 ring-violeta-text/30">
                    {clienteElejido.etiqueta}
                    <button
                      type="button"
                      onClick={() => setClienteElejido(null)}
                      title="Cambiar de cliente"
                      className="rounded-full p-1 text-texto-muted/60 transition hover:bg-panel-hover hover:text-danger-text"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </p>
                  <input
                    type="hidden"
                    name="clienteId"
                    value={clienteElejido.id}
                  />
                </div>
              ) : null}

              <div>
                <div className="flex items-center gap-2">
                  <span className="pointer-events-none pl-2.5 text-texto-muted/50">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    value={terminoFiado}
                    onChange={(e) => {
                      setTerminoFiado(e.target.value);
                      setPaginaFiado(1);
                    }}
                    placeholder="Cliente: nombre, teléfono o #ficha…"
                    aria-label="Buscar cliente para el fiado"
                    className="w-full rounded-xl border-0 bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60 placeholder:text-texto-muted/25"
                  />
                </div>
                {!clienteElejido ? (
                  <div className="mt-1.5 max-h-44 overflow-y-auto rounded-xl bg-campo-app/60 p-1.5">
                    {buscandoFiado && candidatas.length === 0 ? (
                      <p className="px-2.5 py-2 text-xs text-texto-muted/50">Buscando…</p>
                    ) : candidatas.length === 0 ? (
                      <p className="px-2.5 py-2 text-xs text-texto-muted/50">
                        Sin fichas para esa búsqueda (página {paginaFiado}).
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {candidatas.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setClienteElejido(c);
                                setTerminoFiado("");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-texto-app transition hover:bg-amber-brand/10"
                            >
                              <UserRound className="h-3.5 w-3.5 shrink-0 text-amber-brand" />
                              <span className="font-bold">{c.etiqueta}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {candidatasTotal > 8 ? (
                      <div className="mt-1 flex items-center justify-between px-1.5 text-[11px] font-bold text-texto-muted/60">
                        <span>
                          {candidatasTotal} ficha{candidatasTotal === 1 ? "" : "s"} ·
                          página {paginaFiado} de {paginasFiado}
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            disabled={paginaFiado <= 1 || buscandoFiado}
                            onClick={() => setPaginaFiado((p) => Math.max(1, p - 1))}
                            className="rounded-lg bg-panel-app px-2 py-1 ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            disabled={paginaFiado >= paginasFiado || buscandoFiado}
                            onClick={() => setPaginaFiado((p) => p + 1)}
                            className="rounded-lg bg-panel-app px-2 py-1 ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
                          >
                            →
                          </button>
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Dinero que entrega AHORA (opcional): abono parcial real */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    name="abonoAhora"
                    value={abonoTxt}
                    onChange={(e) => setAbonoTxt(e.target.value)}
                    inputMode="numeric"
                    placeholder="Dinero que deja ahora (opcional)"
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
                {abonoNum > 0 && abonoNum < mesa.total ? (
                  <p
                    aria-live="polite"
                    className="mt-1.5 flex items-baseline justify-between rounded-xl bg-success/10 px-3.5 py-2 text-xs font-bold ring-1 ring-success/25"
                  >
                    <span className="text-success-text">
                      Deja {formatCOP(abonoNum)} (entra a caja)
                    </span>
                    <span className="text-warning-text">
                      Fiado por {formatCOP(mesa.total - abonoNum)}
                    </span>
                  </p>
                ) : abonoNum >= mesa.total && mesa.total > 0 ? (
                  <p
                    aria-live="assertive"
                    className="mt-1.5 rounded-xl bg-danger/10 px-3.5 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/25"
                  >
                    Con {formatCOP(abonoNum)} alcanza para pagar la mesa completa:
                    usa «Pagar ahora», no el fiado.
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-texto-muted/50">
                    Si lo dejas vacío, la deuda nace por la mesa completa.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={pendienteFiado || !clienteElejido || (abonoNum >= mesa.total && mesa.total > 0)}
                className={
                  "flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg transition " +
                  (pendienteFiado || !clienteElejido
                    ? "bg-panel-app text-texto-muted/60"
                    : "bg-violeta-text text-white hover:bg-violeta-text/85")
                }
              >
                <UserRound className="h-5 w-5" />
                {pendienteFiado
                  ? "Fianado…"
                  : clienteElejido
                    ? `Fiado a ${clienteElejido.etiqueta.split("·")[1]?.trim() ?? "cliente"}`
                    : "Escoge primero el cliente"}
              </button>
            </form>
          )}
        </>
      )}
    </article>
          )}
        </ModalFlip>
      ) : null}
    </>
  );
}

