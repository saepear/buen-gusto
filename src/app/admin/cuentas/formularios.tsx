"use client";

import { CircleDollarSign, X } from "lucide-react";
import { useActionState, useState } from "react";
import {
  anularCuenta,
  crearCuenta,
  registrarAbono,
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

/**
 * Formulario de deuda nueva. Con `clienteFijo` no se escoge cliente (viene
 * desde la ficha del cliente); sin él, un <select> lo deja elegir (la página
 * lo llena con los resultados de búsqueda).
 */
export function FormularioNuevaCuenta({
  clientes = [],
  clienteFijo = null,
}: {
  clientes?: OpcionCliente[];
  clienteFijo?: OpcionCliente | null;
}) {
  const [estado, accion, pendiente] = useActionState(crearCuenta, INICIAL);

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
      ) : (
        <label className={ETIQUETA + " sm:col-span-2"}>
          CLIENTE {clientes.length === 0 ? "(busca arriba con «Buscar»)" : ""}
          <select name="clienteId" required className={CAMPO}>
            <option value="">Escoge quién debe…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
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
      <label className={ETIQUETA}>
        PEDIDO DE ORIGEN (opcional)
        <input
          name="pedidoId"
          inputMode="numeric"
          className={CAMPO}
          placeholder="Id del pedido / domicilio"
        />
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pendiente}
          className="w-full rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
        >
          {pendiente ? "Registrando…" : "Registrar deuda"}
        </button>
      </div>
      <div className="sm:col-span-2">
        <Aviso estado={estado} />
      </div>
    </form>
  );
}

/** Pago (total o parcial) de una deuda pendiente */
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

/** Anula una cuenta pendiente conservando el registro (auditoría) */
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
