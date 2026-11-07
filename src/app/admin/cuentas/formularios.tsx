"use client";

import { CircleDollarSign, Search, UserRound, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { formatCOP, formatHora } from "@/lib/format";
import { buscarClientesPicker } from "@/app/admin/clientes/actions";
import {
  anularCuenta,
  condonarCuenta,
  crearCuenta,
  desgloseApartadoCuenta,
  desglosePedidoCuenta,
  listarPedidosFiables,
  registrarAbono,
  type DesglosePedido,
  type EstadoAccionCuenta,
  type OrdenFiable,
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

/**
 * Formulario de deuda nueva.
 * · El cliente se escoge en un picker con búsqueda EN LA BASE (nombre,
 *   teléfono o «#ficha»), paginado de a 8: nunca se cargan todos.
 * · «Desde una comanda» lista los pedidos con saldo real por fiar y, al
 *   elegir uno, muestra su desglose de artículos con precios congelados: el
 *   administrador escoge qué unidades quedan fiadas y el servidor recalcula
 *   el importe (nunca el navegador).
 * · «Deuda manual» mantiene el monto digitado para lo que no nace de una
 *   comanda.
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

  // Con una ficha fija (llegada desde «Gestionar fiados») el picker no tiene
  // nada que buscar: no se corre la consulta en segundo plano. Sin ficha, la
  // búsqueda normal sigue igual.
  const hayFichaFija = Boolean(clienteFijo);
  useEffect(() => {
    if (hayFichaFija) return;
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
  }, [termino, pagina, hayFichaFija]);

  const paginasTotales = Math.max(1, Math.ceil(total / 8));

  // ── Pedido de origen: selector + desglose de artículos ──
  const [modo, setModo] = useState<"comanda" | "manual">("comanda");
  const [pedidos, setPedidos] = useState<OrdenFiable[] | null>(null);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [desglose, setDesglose] = useState<DesglosePedido | null>(null);
  const [cargandoDesglose, setCargandoDesglose] = useState(false);
  const [seleccion, setSeleccion] = useState<Record<number, number>>({});
  const [concepto, setConcepto] = useState("");
  const [errorPedido, setErrorPedido] = useState<string | null>(null);
  // Lo que el administrador declara que debe (default: el saldo por fiar)
  const [montoTxt, setMontoTxt] = useState("");
  const montoFiado =
    montoTxt === "" && desglose
      ? desglose.pendiente
      : Number.parseInt(montoTxt.replace(/[^0-9]/g, ""), 10) || 0;
  const totalSeleccionado = desglose
    ? desglose.lineas.reduce(
        (s, l) => s + (seleccion[l.pedidoItemId] ?? 0) * l.precio,
        0,
      )
    : 0;
  const lineasSeleccionadas = desglose && desglose.apartadoId === null
    ? desglose.lineas
        .filter((l) => (seleccion[l.pedidoItemId] ?? 0) > 0)
        .map((l) => ({
          pedidoItemId: l.pedidoItemId,
          cantidad: seleccion[l.pedidoItemId],
        }))
    : [];
  // Comanda: el monto declarado cae dentro del saldo por fiar. Apartado por
  // entregar: se fía completo (apenas hay desglose, ya es válido).
  const desgloseEfetivo =
    desglose !== null &&
    (desglose.apartadoId !== null ||
      (montoFiado > 0 && montoFiado <= desglose.pendiente));

  async function cargarPedidosDePersona(clienteId: number) {
    setCargandoPedidos(true);
    setErrorPedido(null);
    try {
      setPedidos(await listarPedidosFiables(clienteId));
    } catch {
      setErrorPedido("No se pudieron cargar los pedidos de esa persona.");
    } finally {
      setCargandoPedidos(false);
    }
  }

  /** Al elegir persona, sus pedidos por fiar llegan solos */
  useEffect(() => {
    const clienteActual = clienteFijo ?? elegido;
    if (!clienteActual) {
      setPedidos(null);
      return;
    }
    void cargarPedidosDePersona(clienteActual.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteFijo, elegido?.id]);

  async function abrirListaPedidos() {
    setCargandoPedidos(true);
    setErrorPedido(null);
    try {
      const clienteActual = clienteFijo ?? elegido;
      setPedidos(
        await listarPedidosFiables(clienteActual?.id ?? undefined),
      );
    } catch {
      setErrorPedido("No se pudieron cargar los pedidos pendientes.");
    } finally {
      setCargandoPedidos(false);
    }
  }

  async function elegirPedido(p: OrdenFiable) {
    setCargandoDesglose(true);
    setErrorPedido(null);
    try {
      const d =
        p.apartadoId !== null
          ? await desgloseApartadoCuenta(p.apartadoId)
          : await desglosePedidoCuenta(p.pedidoId!);
      if (!d) {
        setErrorPedido(
          p.apartadoId !== null
            ? "Ese apartado ya no se puede fiar (se entregó, canceló o ya se fió)."
            : "Ese pedido ya no se puede fiar (cambió su estado).",
        );
        return;
      }
      setDesglose(d);
      setSeleccion({});
      setMontoTxt("");
      setConcepto(
        d.cliente ? `${d.tipoOrigen} · ${d.cliente}` : d.tipoOrigen,
      );
    } catch {
      setErrorPedido("No se pudo abrir el desglose de ese pedido.");
    } finally {
      setCargandoDesglose(false);
    }
  }

  function cambiarCantidad(pedidoItemId: number, valor: string, max: number) {
    const n = Math.min(max, Math.max(0, Number.parseInt(valor || "0", 10) || 0));
    setSeleccion((s) => ({ ...s, [pedidoItemId]: n }));
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
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          className={CAMPO}
          placeholder="Ej: 2 almuerzos del día"
        />
      </label>
      {modo === "manual" ? (
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
      ) : desglose ? null : (
        <div className={ETIQUETA}>
          MONTO QUE DEBE
          <p className="mt-1 rounded-xl bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app">
            <span className="font-normal text-texto-muted/55">
              se llena al abrir la comanda que va a fiar
            </span>
          </p>
        </div>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={() => setModo("comanda")}
          aria-pressed={modo === "comanda"}
          className={
            "rounded-xl px-3 py-2 text-xs font-bold ring-1 transition " +
            (modo === "comanda"
              ? "bg-amber-brand/20 text-amber-brand ring-amber-brand/50"
              : "bg-panel-app text-texto-muted/70 ring-borde-app hover:bg-panel-hover")
          }
        >
          Desde una comanda
        </button>
        <button
          type="button"
          onClick={() => {
            setModo("manual");
            setDesglose(null);
            setSeleccion({});
            setPedidos(null);
            setErrorPedido(null);
          }}
          aria-pressed={modo === "manual"}
          className={
            "rounded-xl px-3 py-2 text-xs font-bold ring-1 transition " +
            (modo === "manual"
              ? "bg-amber-brand/20 text-amber-brand ring-amber-brand/50"
              : "bg-panel-app text-texto-muted/70 ring-borde-app hover:bg-panel-hover")
          }
        >
          Deuda manual
        </button>
      </div>

      {modo === "comanda" ? (
        <div className="sm:col-span-2">
          {!desglose ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={abrirListaPedidos}
                  disabled={cargandoPedidos}
                  className="rounded-xl bg-panel-app px-3 py-2.5 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
                >
                  {cargandoPedidos
                    ? "Buscando pedidos…"
                    : clienteFijo ?? elegido
                      ? "Recargar pedidos de la persona"
                      : "Ver pedidos pendientes"}
                </button>
                {clienteFijo ?? elegido ? (
                  <span className="text-[11px] text-texto-muted/55">
                    los pedidos de esta persona llegan solos
                  </span>
                ) : null}
              </div>
              {errorPedido ? (
                <p className="mt-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-bold text-warning ring-1 ring-warning/25">
                  {errorPedido}
                </p>
              ) : null}
              {pedidos && pedidos.length === 0 ? (
                <p className="mt-2 text-xs text-texto-muted/55">
                  {clienteFijo ?? elegido
                    ? "Esta persona no tiene comandas ni apartados por fiar en este momento. Si igual debe algo, usa «Deuda manual»."
                    : "No hay pedidos pendientes con saldo por fiar."}
                </p>
              ) : null}
              {pedidos && pedidos.length > 0 ? (
                <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-xl bg-campo-app/60 p-1.5">
                  {pedidos.map((p) => (
                    <li key={p.pedidoId ?? `apartado-${p.apartadoId}`}>
                      <button
                        type="button"
                        onClick={() => elegirPedido(p)}
                        disabled={cargandoDesglose}
                        className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-texto-app transition hover:bg-amber-brand/10 disabled:opacity-50"
                      >
                        <span className="min-w-0">
                          <b className="block truncate">
                            {p.tipoOrigen} · {formatHora(new Date(p.fecha))}
                            {p.cliente ? ` · ${p.cliente}` : ""}
                          </b>
                          <span className="block text-[11px] text-texto-muted/55">
                            Total {formatCOP(p.total)} · cobrado {formatCOP(p.cobrado)} · ligado{" "}
                            {formatCOP(p.ligado)}
                          </span>
                        </span>
                        <strong className="shrink-0 text-danger-text">
                          Queda {formatCOP(p.pendiente)}
                        </strong>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <div className="mt-1 space-y-2 rounded-xl bg-campo-app px-3.5 py-2.5 text-xs text-texto-app ring-1 ring-borde-app">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-bold">
                  {desglose.tipoOrigen}
                  {desglose.cliente ? ` · ${desglose.cliente}` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDesglose(null);
                    setSeleccion({});
                    setPedidos(null);
                    setConcepto("");
                  }}
                  className="rounded-lg bg-panel-app px-2 py-1 font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:bg-panel-hover"
                >
                  Cambiar pedido
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-4">
                <span>
                  {desglose.apartadoId !== null ? "Total apartado" : "Total pedido"}
                  <b className="block">{formatCOP(desglose.total)}</b>
                </span>
                <span>
                  Cobrado en caja
                  <b className="block">{formatCOP(desglose.cobrado)}</b>
                </span>
                <span>
                  Ya fiado
                  <b className="block">{formatCOP(desglose.ligado)}</b>
                </span>
                <span>
                  Queda por fiar
                  <b className="block text-danger-text">{formatCOP(desglose.pendiente)}</b>
                </span>
              </div>
              {desglose.apartadoId !== null ? (
                // Apartado POR ENTREGAR: se fía completo y de una vez
                <div className="mt-1">
                  <span className={ETIQUETA}>MONTO QUE DEBE</span>
                  <p className="mt-1 rounded-xl bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-app">
                    {formatCOP(desglose.pendiente)}
                    <span className="ml-2 font-normal text-texto-muted/55">
                      · el apartado se fía completo
                    </span>
                  </p>
                  <span className="mt-0.5 block text-[11px] text-texto-muted/55">
                    Su comanda aún no existe (nace al entregar): por eso no hay
                    fiado parcial. La entrega saldrá fiada con esta misma deuda,
                    sin cobrar de nuevo. Si pagara algo al entregar, se registra
                    como abono de esta deuda.
                  </span>
                </div>
              ) : (
                <label className="block">
                  <span className={ETIQUETA}>MONTO QUE DEBE (máx. {formatCOP(desglose.pendiente)})</span>
                  <input
                    name="valorFiado"
                    inputMode="numeric"
                    value={montoTxt === "" ? String(desglose.pendiente) : montoTxt}
                    onChange={(e) => setMontoTxt(e.target.value)}
                    className={CAMPO + " mt-1 w-36 font-bold"}
                    placeholder={String(desglose.pendiente)}
                  />
                  <span className="mt-0.5 block text-[11px] text-texto-muted/55">
                    Si fiás menos de lo que vale la comanda, el pedido conserva el
                    saldo que falta (y sigue en el tablero o en la caja).
                  </span>
                </label>
              )}
              <ul className="space-y-1.5 border-t border-borde-app/60 pt-2">
                {desglose.lineas.map((l) =>
                  desglose.apartadoId !== null ? (
                    // Apartado: lista de solo lectura (se fía todo de una vez)
                    <li key={l.pedidoItemId} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 grow">
                        <b className="block truncate">
                          {l.cantidad > 1 ? `${l.cantidad}× ` : ""}
                          {l.nombre}
                        </b>
                        <span className="text-[11px] text-texto-muted/55">
                          {l.precio > 0 ? `${formatCOP(l.precio)} c/u` : "incluido"}
                          {l.precio > 0 && l.cantidad > 1
                            ? ` · ${formatCOP(l.subtotal)}` : ""}
                          {l.conSopa === true ? " · con sopa" : ""}
                          {l.conSopa === false ? " · sin sopa" : ""}
                          {l.nota ? ` · ${l.nota}` : ""}
                        </span>
                      </span>
                      <span className="w-24 text-right font-bold tabular-nums">
                        {formatCOP(l.subtotal)}
                      </span>
                    </li>
                  ) : (
                    <li key={l.pedidoItemId} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 grow">
                        <b className="block truncate">{l.nombre}</b>
                        <span className="text-[11px] text-texto-muted/55">
                          {formatCOP(l.precio)} c/u · {l.cantidad} en el pedido
                          {l.yaFiadas > 0 ? ` · ${l.yaFiadas} ya fiada(s)` : ""}
                          {l.disponibles === 0 ? " · sin unidades libres" : ""}
                        </span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={l.disponibles}
                        value={seleccion[l.pedidoItemId] ?? 0}
                        onChange={(e) =>
                          cambiarCantidad(l.pedidoItemId, e.target.value, l.disponibles)
                        }
                        disabled={l.disponibles === 0}
                        aria-label={`Cantidad de ${l.nombre} a fiar`}
                        className={CAMPO + " w-20 text-right"}
                      />
                      <span className="w-24 text-right font-bold tabular-nums">
                        {formatCOP((seleccion[l.pedidoItemId] ?? 0) * l.precio)}
                      </span>
                    </li>
                  ),
                )}
              </ul>
              {desglose.apartadoId === null && totalSeleccionado > desglose.pendiente ? (
                <p className="rounded-lg bg-danger/10 px-2.5 py-1.5 font-bold text-danger-text">
                  La selección ({formatCOP(totalSeleccionado)}) supera el saldo por fiar.
                </p>
              ) : null}
              {desglose.apartadoId === null ? (
                <>
                  <p className="flex items-center justify-between border-t border-borde-app/60 pt-2 text-sm font-bold">
                    <span>Total seleccionado</span>
                    <span className="text-danger-text">{formatCOP(totalSeleccionado)}</span>
                  </p>
                  {totalSeleccionado === 0 ? (
                    <p className="text-[11px] text-texto-muted/55">
                      Sin unidades apartadas, la deuda lleva la foto de TODO lo que
                      se llevó (y el monto lo dice el campo «MONTO QUE DEBE»).
                    </p>
                  ) : null}
                </>
              ) : null}
              {desglose.pedidoId !== null ? (
                <input type="hidden" name="pedidoId" value={desglose.pedidoId} />
              ) : null}
              <input type="hidden" name="apartadoId" value={desglose.apartadoId ?? ""} />
              <input
                type="hidden"
                name="lineas"
                value={JSON.stringify(lineasSeleccionadas)}
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <Aviso estado={estado} />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={
            pendiente ||
            (modo === "comanda" && (!desglose || !desgloseEfetivo))
          }
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
