"use client";

// ═════════ Formulario de registro de VALE (client) ═════════
// Al elegir un producto del catálogo se sugiere su precio (editable: el
// precio del vale queda CONGELADO al entregar, no sigue al catálogo).
import { useActionState, useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { registrarVale, type EstadoAccionVale } from "./actions";

const INICIAL: EstadoAccionVale = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

type OpcionProducto = { id: number; nombre: string; precio: number };
type OpcionEmpleado = { id: number; nombre: string };
type OpcionCiclo = { id: number; etiqueta: string };

export function FormularioRegistroVale({
  empleados,
  productos,
  ciclos,
  hoy,
  empleadoInicial,
  cicloInicial,
  abiertoInicial = false,
}: {
  empleados: OpcionEmpleado[];
  productos: OpcionProducto[];
  ciclos: OpcionCiclo[];
  hoy: string;
  empleadoInicial?: number;
  cicloInicial?: number;
  abiertoInicial?: boolean;
}) {
  const [estado, accion, guardando] = useActionState(registrarVale, INICIAL);
  const [productoId, setProductoId] = useState("");
  const [precio, setPrecio] = useState("");

  function alElegirProducto(valor: string) {
    setProductoId(valor);
    const p = productos.find((x) => String(x.id) === valor);
    setPrecio(p && p.precio > 0 ? String(p.precio) : "");
  }

  return (
    <details open={abiertoInicial || !!empleadoInicial} className="group rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app w-full">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-2xl bg-amber-brand px-5 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app active:scale-95">
        <ShoppingBasket className="h-5 w-5" /> Registrar vale
      </summary>
      <form action={accion} className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
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
          EMPLEADO *
          <select name="empleadoId" required className={CAMPO} defaultValue={empleadoInicial ?? ""}>
            <option value="" disabled>
              Elige el empleado…
            </option>
            {empleados.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className={ETIQUETA}>
          PRODUCTO DEL CATÁLOGO
          <select
            name="productoId"
            className={CAMPO}
            value={productoId}
            onChange={(e) => alElegirProducto(e.target.value)}
          >
            <option value="">Libre (nombre a mano)…</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className={ETIQUETA}>
          NOMBRE (si es libre)
          <input name="productoNombre" maxLength={120} className={CAMPO} placeholder="Ej: Coca-Cola 1.5 L" />
        </label>
        <label className={ETIQUETA}>
          CANTIDAD *
          <input name="cantidad" required inputMode="numeric" defaultValue="1" className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          PRECIO AL ENTREGAR (COP) *
          <input
            name="precioUnitario"
            required
            inputMode="numeric"
            value={precio}
            onChange={(e) => setPrecio(e.target.value.replace(/[^0-9]/g, ""))}
            className={CAMPO}
            placeholder="$0"
          />
          <span className="mt-0.5 block font-normal text-texto-muted/55">
            Se congela en el vale (no sigue al catálogo)
          </span>
        </label>
        <label className={ETIQUETA}>
          FECHA DE ENTREGA *
          <input type="date" name="fecha" required defaultValue={hoy} className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          CICLO AL QUE SE ASIGNA
          <select name="cicloId" className={CAMPO} defaultValue={cicloInicial ?? ""}>
            <option value="">Sin asignar (lo liquida el ciclo de su fecha)…</option>
            {ciclos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label className={`${ETIQUETA} sm:col-span-2`}>
          OBSERVACIONES
          <input name="observaciones" maxLength={200} className={CAMPO} />
        </label>
        <p className="text-[11px] text-texto-muted/60 sm:col-span-2 lg:col-span-3">
          El vale nace PENDIENTE. Cuando lo autorices, se descontará al liquidar
          el ciclo (conservando producto, cantidad, precio y autorización).
        </p>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Registrar vale"}
        </button>
      </form>
    </details>
  );
}
