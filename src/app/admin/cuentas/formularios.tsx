"use client";

import { CircleDollarSign, Search, UserRound, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { formatCOP } from "@/lib/format";
import {
  ESTADO_CUENTA,
  ESTADO_CUENTA_LABEL,
} from "@/lib/roles";
import { buscarClientesPicker } from "@/app/admin/clientes/actions";
import {
  anularCuenta,
  condonarCuenta,
  crearCuenta,
  registrarAbono,
  resumenPedidoCuenta,
  type EstadoAccionCuenta,
} from "./actions";

const INICIAL: EstadoAccionCuenta = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

function Aviso({ estado }: { estado: EstadoAccionCuenta }) {
  if (estado.error) {
    return (
      <p
        aria-live="polite"
        className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20"
      >
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p
        aria-live="polite"
        className="mt-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

export type OpcionCliente = { id: number; etiqueta: string };

/** ¿Qué vino del «Consultar pedido» del servidor? */
type ResumenPedido = {
  existe: false;
} | {
  existe: true;
  estado: string;
  valorPedido: number;
  cobrado: number;
  ligado: number;
  pendiente: number;
  cuentas: { id: number; concepto: string; estado: string; saldo: number }[];
};

/**
 * Formulario de deuda nueva.
 * · El cliente se escoge en un picker con búsqueda EN LA BASE (nombre,
 *   teléfono o «#ficha»), paginado de a 8: nunca se cargan todos.
 * · «Consultar pedido» trae en vivo el pendiente REAL del pedido (válido en
 *   servidor): lo que ya cobró caja y lo que ya quedó ligado a otras deudas.
 */
export function FormularioNuevaCuenta({
  clientes = [],
  clienteFijo = null,
}: {
  clientes?: OpcionCliente[];
  clienteFijo?: OpcionCliente | null;
}) {
  const [estado, accion, pendiente] = useActionState(crearCuenta, INICIAL);

  // ── Picker de cliente (búsqueda paginada en BD) ──
  const [termino, setTermino] = useState("");
  const [pagina, setPagina] = useState(1);
  const [resultados, setResultados] = useState<OpcionCliente[]>([]);
  const [total, setTotal] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [elegido, setElegido] = useState<OpcionCliente | null>(clienteFijo ?? null);

  useEffect(() => {
    let cancelada = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const r = await buscarClientesPicker(termino, pagina);
        if (cancelada) return;
        setResultados(r.filas);
        setTotal(r.total);
      } finally {
        if (!cancelada) setBuscando(false);
      }
    }, 250);
    return () => {
      cancelada = true;
      clearTimeout(t);
    };
  }, [termino, pagina]);

  const paginasTotales = Math.max(1, Math.ceil(total / 8));

  // ── Consulta en vivo del pedido origen ──
  const [consulta, setConsulta] = useState<ResumenPedido | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [pedidoInput, setPedidoInput] = useState("");

  async function consultarPedido() {
    const id = Number.parseInt(pedidoInput, 10);
    if (!Number.isInteger(id)) return;
    setConsultando(true);
    setConsulta(null);
    try {
      const r = await resumenPedidoCuenta(id);
      setConsulta(r as ResumenPedido);
    } finally {
      setConsultando(false);
    }
  }

  return (
    <form
      action={accion}
      className="grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2"
    >
      <h3 className="flex items-center gap-2 font-display text-lg text-texto-app sm:col-span-2">
        <CircleDollarSign className="h-5 w-5 text-danger-text" /> Registrar fiado
      </h3>

      {clienteFijo ? (
        <div className={ETIQUETA + " sm:col-span-2"}>
          CLIENTE
          <input type="hidden" name="clienteId" value={clienteFijo.id} />
          <p className="mt-1 rounded-xl bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app">
            {clienteFijo.etiqueta}
          </p>
        </div>
      ) : elegido ? (
        <div className={ETIQUETA + " sm:col-span-2"}>
          CLIENTE
          <input type="hidden" name="clienteId" value={elegido.id} />
          <p className="mt-1 flex items-center justify-between gap-2 rounded-xl bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app">
            {elegido.etiqueta}
            <button
              type="button"
              onClick={() => setElegido(null)}
              title="Cambiar de cliente"
              className="rounded-full p-1 text-texto-muted/60 transition hover:bg-campo-app hover:text-danger-text"
            >
              <X className="h-4 w-4" />
            </button>
          </p>
        </div>
      ) : (
        <div className={ETIQUETA + " sm:col-span-2"}>
          CLIENTE{" "}
          <span className="font-normal text-texto-muted/55">
            (busca por nombre, teléfono o #ficha)
          </span>
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <span className="pointer-events-none pl-2.5 text-texto-muted/50">
                <Search className="h-4 w-4" />
              </span>
              <input
                value={termino}
                onChange={(e) => {
                  setTermino(e.target.value);
                  setPagina(1);
                }}
                placeholder="Ej: María · #12 · 315…"
                className={CAMPO}
              />
            </div>
            <div className="mt-1.5 max-h-52 overflow-y-auto rounded-xl bg-campo-app/60 p-1.5">
              {buscando && resultados.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-texto-muted/50">Buscando…</p>
              ) : resultados.length === 0 ? (
                <p className="px-2.5 py-2 text-xs text-texto-muted/50">
                  Sin fichas para esa búsqueda (página {pagina}).
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {resultados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setElegido(c);
                          setTermino("");
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
            </div>
            {total > 8 ? (
              <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-texto-muted/60">
                <span>
                  {total} ficha{total === 1 ? "" : "s"} · página {pagina} de {paginasTotales}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    disabled={pagina <= 1 || buscando}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="rounded-lg bg-panel-app px-2 py-1 ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
                  >
                    ← Anteriores
                  </button>
                  <button
                    type="button"
                    disabled={pagina >= paginasTotales || buscando}
                    onClick={() => setPagina((p) => p + 1)}
                    className="rounded-lg bg-panel-app px-2 py-1 ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
                  >
                    Siguientes →
                  </button>
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <label className={ETIQUETA}>
        CONCEPTO *
        <input
          name="concepto"
          required
          maxLength={140}
          className={CAMPO}
          placeholder="Ej: 2 almuerzos del día"
        />
      </label>
      <label className={ETIQUETA}>
        MONTO QUE DEBE *
        <input
          name="valorOriginal"
          inputMode="numeric"
          required
          className={CAMPO}
          placeholder="$0"
        />
      </label>

      <div className="sm:col-span-2">
        <label className={ETIQUETA}>
          PEDIDO DE ORIGEN (opcional)
          <div className="mt-1 flex gap-2">
            <input
              value={pedidoInput}
              onChange={(e) => {
                setPedidoInput(e.target.value);
                setConsulta(null);
              }}
              inputMode="numeric"
              name="pedidoId"
              className={CAMPO}
              placeholder="Id del pedido / domicilio"
            />
            <button
              type="button"
              onClick={consultarPedido}
              disabled={consultando || !Number.isInteger(Number.parseInt(pedidoInput, 10))}
              className="shrink-0 rounded-xl bg-panel-app px-3 py-2.5 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
            >
              {consultando ? "Consultando…" : "Consultar pedido"}
            </button>
          </div>
        </label>

        {consulta ? (
          !consulta.existe ? (
            <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-bold text-warning ring-1 ring-warning/25">
              Ese pedido no existe: revisa el número.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5 rounded-xl bg-campo-app px-3.5 py-2.5 text-xs text-texto-app ring-1 ring-borde-app">
              <p className="font-bold">
                Pedido #{pedidoInput} · estado {consulta.estado}
              </p>
              <p className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-4">
                <span>
                  Valor pedido
                  <b className="block">{formatCOP(consulta.valorPedido)}</b>
                </span>
                <span>
                  Cobrado en caja
                  <b className="block">{formatCOP(consulta.cobrado)}</b>
                </span>
                <span>
                  Ligado a otras deudas
                  <b className="block">{formatCOP(consulta.ligado)}</b>
                </span>
                <span>
                  Queda por fiar
                  <b className="block text-danger-text">{formatCOP(consulta.pendiente)}</b>
                </span>
              </p>
              {consulta.cuentas.length > 0 ? (
                <ul className="space-y-0.5 border-t border-borde-app/60 pt-1.5">
                  {consulta.cuentas.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2">
                      <span className="font-semibold">#{c.id} · {c.concepto}</span>
                      <span>
                        {ESTADO_CUENTA_LABEL[c.estado as keyof typeof ESTADO_CUENTA_LABEL] ?? c.estado} ·{" "}
                        {c.estado === ESTADO_CUENTA.PENDIENTE
                          ? `saldo ${formatCOP(c.saldo)}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t border-borde-app/60 pt-1.5 text-texto-muted/60">
                  Este pedido no tiene deudas vivas todavía.
                </p>
              )}
            </div>
          )
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <Aviso estado={estado} />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pendiente}
          className="w-full rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
        >
          {pendiente ? "Registrando…" : "Registrar deuda"}
        </button>
      </div>
    </form>
  );
}

/** Abono (pago parcial o total) a una deuda pendiente: dinero real de caja */
export function FormularioAbono({
  cuentaId,
  saldo,
}: {
  cuentaId: number;
  saldo: number;
}) {
  const [estado, accion, pendiente] = useActionState(registrarAbono, INICIAL);

  return (
    <form action={accion} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="cuentaId" value={cuentaId} />
      <label className={ETIQUETA}>
        ABONO
        <input
          name="monto"
          inputMode="numeric"
          required
          defaultValue={saldo}
          max={saldo}
          className={CAMPO + " w-28"}
          placeholder="$0"
        />
      </label>
      <label className={ETIQUETA}>
        MÉTODO
        <select name="metodo" required defaultValue="EFECTIVO" className={CAMPO + " w-40"}>
          <option value="EFECTIVO">Efectivo</option>
          <option value="TARJETA">Tarjeta</option>
          <option value="TRANSFERENCIA">Transferencia</option>
        </select>
      </label>
      <label className={ETIQUETA + " min-w-40 grow"}>
        NOTA
        <input name="nota" maxLength={140} className={CAMPO} placeholder="Opcional" />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-xl bg-success px-4 py-2.5 font-display text-md text-brown-950 transition hover:opacity-90 disabled:opacity-50"
      >
        {pendiente ? "Registrando…" : "Recibir abono"}
      </button>
      <div className="w-full">
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/** Condonación del SALDO RESTANTE: perdona lo que falta de la deuda. No es
 *  ingreso de caja; los abonos ya recibidos conservan su condición. Abre un
 *  mini-formulario con confirmación y motivo obligatorio. */
export function FormularioCondonarCuenta({
  cuentaId,
  valorOriginal,
  abonado,
  saldo,
}: {
  cuentaId: number;
  valorOriginal: number;
  abonado: number;
  saldo: number;
}) {
  const [estado, accion, pendiente] = useActionState(condonarCuenta, INICIAL);
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      {abierto ? (
        <form action={accion} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="cuentaId" value={cuentaId} />
          <label className={ETIQUETA + " min-w-52 grow"}>
            MOTIVO DE LA CONDONACIÓN
            <input
              name="motivo"
              required
              minLength={4}
              maxLength={200}
              className={CAMPO}
              placeholder="Ej: clienta fiel, se perdonó lo que restaba"
            />
          </label>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-warning px-4 py-2.5 text-sm font-bold text-texto-app transition hover:opacity-90 disabled:opacity-50"
          >
            {pendiente ? "Condonando…" : `Condonar ${formatCOP(saldo)}`}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            title="No condonar"
            className="rounded-xl bg-panel-app px-3 py-2.5 text-sm text-texto-muted/70 ring-1 ring-borde-app"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="w-full rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning ring-1 ring-warning/20">
            Queda condonado el saldo de {formatCOP(saldo)} (deuda {formatCOP(valorOriginal)} ·
            abonos recibidos {formatCOP(abonado)}). Los abonos siguen siendo dinero de caja;
            la condonación no lo es y no aparece como ingreso.
          </p>
          <div className="w-full">
            <Aviso estado={estado} />
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="text-xs font-bold text-warning underline-offset-2 transition hover:underline"
        >
          Condonar saldo restante…
        </button>
      )}
    </div>
  );
}

/** Anula una cuenta pendiente SIN abonos (por error), conservando el registro
 *  (auditoría). Con abonos se usa «Condonar saldo restante». */
export function FormularioAnularCuenta({
  cuentaId,
}: {
  cuentaId: number;
}) {
  const [estado, accion, pendiente] = useActionState(anularCuenta, INICIAL);
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      {abierto ? (
        <form action={accion} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="cuentaId" value={cuentaId} />
          <label className={ETIQUETA + " grow"}>
            MOTIVO DE LA ANULACIÓN
            <input
              name="motivo"
              required
              minLength={4}
              maxLength={200}
              className={CAMPO}
              placeholder="Ej: se pagó en la mesa por error"
            />
          </label>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-danger-text transition hover:opacity-90 disabled:opacity-50"
          >
            {pendiente ? "Anulando…" : "Confirmar anulación"}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            title="No anular"
            className="rounded-xl bg-panel-app px-3 py-2.5 text-sm text-texto-muted/70 ring-1 ring-borde-app"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="w-full">
            <Aviso estado={estado} />
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="text-xs font-bold text-danger-text/80 underline-offset-2 transition hover:text-danger-text hover:underline"
        >
          Anular esta cuenta…
        </button>
      )}
    </div>
  );
}
