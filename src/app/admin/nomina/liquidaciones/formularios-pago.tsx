"use client";

// ═════════ Formulario de pago de nómina (client) ═════════
// Parciales permitidos: nunca más del pendiente. El egreso real de caja
// nace SOLO con método EFECTIVO (dentro de la transacción de la acción).
import { useActionState } from "react";
import { Coins } from "lucide-react";
import { registrarPagoNomina, type EstadoAccionPago } from "./actions";

const INICIAL: EstadoAccionPago = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

export function FormularioPagoNomina({
  liquidacionId,
  netoAPagar,
  pagado,
  metodoHabitual,
}: {
  liquidacionId: number;
  netoAPagar: number;
  pagado: number;
  metodoHabitual: string;
}) {
  const [estado, accion, guardando] = useActionState(registrarPagoNomina, INICIAL);
  const saldoPendiente = Math.max(netoAPagar - pagado, 0);

  return (
    <details className="group rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app w-full">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95">
        <Coins className="h-5 w-5" /> Registrar pago de nómina
      </summary>
      <form action={accion} className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <input type="hidden" name="liquidacionId" value={liquidacionId} />
        {estado.error ? (
          <p aria-live="polite" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20 sm:col-span-2 lg:col-span-3">
            {estado.error}
          </p>
        ) : null}
        {estado.ok ? (
          <p aria-live="polite" className="rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20 sm:col-span-2 lg:col-span-3">
            {estado.ok}
          </p>
        ) : null}

        <label className={ETIQUETA}>
          VALOR DEL PAGO *
          <input name="monto" required inputMode="numeric" className={CAMPO} placeholder="$0" />
          <span className="mt-0.5 block font-normal text-texto-muted/55">
            Pendiente hasta ahora: ${saldoPendiente.toLocaleString("es-CO")}
          </span>
        </label>
        <label className={ETIQUETA}>
          MÉTODO *
          <select name="metodo" defaultValue={metodoHabitual} className={CAMPO}>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA">Transferencia</option>
            <option value="OTRO">Otro</option>
          </select>
        </label>
        <label className={ETIQUETA}>
          REFERENCIA
          <input name="referencia" maxLength={120} className={CAMPO} placeholder="N° de transferencia, nota…" />
        </label>
        <label className={`${ETIQUETA} sm:col-span-2`}>
          OBSERVACIONES
          <input name="observaciones" maxLength={200} className={CAMPO} />
        </label>
        <p className="text-[11px] text-texto-muted/60 sm:col-span-2 lg:col-span-3">
          Un pago en EFECTIVO genera el egreso real de caja (categoría Nómina)
          en el mismo instante. Una transferencia queda registrada aquí sin
          descontar el efectivo físico.
        </p>
        <button
          type="submit"
          disabled={guardando || saldoPendiente <= 0}
          className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50"
        >
          {guardando ? "Guardando…" : saldoPendiente <= 0 ? "Ya está pagada" : "Registrar pago"}
        </button>
      </form>
    </details>
  );
}
