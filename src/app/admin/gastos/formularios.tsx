"use client";

import { ChevronDown, MinusCircle, Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { anularGasto, crearGasto, type EstadoAccionGasto } from "./actions";

const INICIAL: EstadoAccionGasto = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

function Mensaje({ estado }: { estado: EstadoAccionGasto }) {
  if (estado.error) {
    return (
      <p
        aria-live="polite"
        className="sm:col-span-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20"
      >
        {estado.error}
      </p>
    );
  }
  if (estado.ok) {
    return (
      <p
        aria-live="polite"
        className="sm:col-span-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20"
      >
        {estado.ok}
      </p>
    );
  }
  return null;
}

export type OpcionesGasto = {
  categorias: { valor: string; texto: string }[];
};

/** Post para registrar un gasto (se abre con un toque) */
export function FormularioNuevoGasto({ opciones }: { opciones: OpcionesGasto }) {
  const [estado, accion, pendiente] = useActionState(crearGasto, INICIAL);
  const [abierto, setAbierto] = useState(false);
  const [origen, setOrigen] = useState("CAJA");

  return (
    <section aria-label="Registrar gasto">
      {estado.ok && !abierto ? <Mensaje estado={estado} /> : null}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95"
      >
        <Plus className="h-5 w-5" /> Registrar gasto
        <ChevronDown
          aria-hidden
          className={
            "h-4 w-4 transition-transform " + (abierto ? "rotate-180" : "")
          }
        />
      </button>

      {abierto ? (
        <form
          action={accion}
          className="mt-3 grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2"
        >
          <h3 className="font-display text-lg text-texto-app sm:col-span-2">
            Nuevo gasto
          </h3>
          <label className={ETIQUETA}>
            QUÉ SE COMPRÓ *
            <input
              name="descripcion"
              required
              maxLength={140}
              className={CAMPO}
              placeholder="Ej: libra de arroz, gasolina moto, bolsas"
            />
          </label>
          <label className={ETIQUETA}>
            CATEGORÍA *
            <select name="categoria" required defaultValue="" className={CAMPO}>
              <option value="" disabled>
                Escoge una…
              </option>
              {opciones.categorias.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.texto}
                </option>
              ))}
            </select>
          </label>
          <label className={ETIQUETA}>
            VALOR *
            <input
              name="valor"
              inputMode="numeric"
              required
              className={CAMPO}
              placeholder="$0"
            />
          </label>
          <label className={ETIQUETA}>
            MÉTODO *
            <select name="metodo" required defaultValue="EFECTIVO" className={CAMPO}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TARJETA">Tarjeta</option>
            </select>
          </label>
          <fieldset className="sm:col-span-2">
            <legend className={ETIQUETA}>ORIGEN DEL DINERO *</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {[
                {
                  valor: "CAJA",
                  texto: "Dinero de caja",
                },
                {
                  valor: "EXTERNO",
                  texto: "Dinero externo",
                },
              ].map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => setOrigen(o.valor)}
                  aria-pressed={origen === o.valor}
                  className={
                    "rounded-xl px-3.5 py-2 text-xs font-bold ring-1 transition " +
                    (origen === o.valor
                      ? "bg-amber-brand text-brown-950 ring-amber-brand"
                      : "bg-fondo-app text-texto-app ring-borde-app hover:ring-amber-brand/50")
                  }
                >
                  {o.texto}
                </button>
              ))}
            </div>
            {origen ? (
              <p className="mt-1 text-[11px] text-texto-muted/55">
                {origen === "CAJA"
                  ? "Con efectivo de caja se descuenta del efectivo disponible de hoy."
                  : "Queda auditado en los reportes, sin tocar el efectivo de caja."}
              </p>
            ) : null}
            <input type="hidden" name="origen" value={origen} />
          </fieldset>
          <label className={ETIQUETA + " sm:col-span-2"}>
            OBSERVACIONES
            <input
              name="observaciones"
              maxLength={240}
              className={CAMPO}
              placeholder="Opcional: a quién se lo compró, factura…"
            />
          </label>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50 sm:col-span-2"
          >
            {pendiente ? "Guardando…" : "Registrar gasto"}
          </button>
          <Mensaje estado={estado} />
        </form>
      ) : null}
    </section>
  );
}

/** Anular un gasto activo (conserva el registro, con motivo) */
export function AccionAnularGasto({ gastoId }: { gastoId: number }) {
  const [estado, accion, pendiente] = useActionState(anularGasto, INICIAL);
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="w-full">
      {abierto ? (
        <form action={accion} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="gastoId" value={gastoId} />
          <label className={ETIQUETA + " min-w-48 grow"}>
            MOTIVO DE LA ANULACIÓN
            <input
              name="motivo"
              required
              minLength={4}
              maxLength={200}
              className={CAMPO}
              placeholder="Ej: se registró doble"
            />
          </label>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-danger-text transition hover:opacity-90 disabled:opacity-50"
          >
            {pendiente ? "Anulando…" : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-xl bg-panel-app px-3 py-2.5 text-sm text-texto-muted/70 ring-1 ring-borde-app"
          >
            Volver
          </button>
          <div className="w-full">
            <Mensaje estado={estado} />
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex items-center gap-1.5 text-xs font-bold text-danger-text/70 transition hover:text-danger-text hover:underline"
        >
          <MinusCircle className="h-3.5 w-3.5" /> Anular
        </button>
      )}
    </div>
  );
}
