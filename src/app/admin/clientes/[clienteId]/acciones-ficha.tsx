"use client";

import { AlertTriangle, Merge, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import {
  buscarClientes,
  eliminarCliente,
  fusionarClientesForm,
  prepararFusion,
  type EstadoAccionCliente,
} from "../actions";
import { formatCOP } from "@/lib/format";

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";

type ResumenFusion = NonNullable<
  Awaited<ReturnType<typeof prepararFusion>>
>;
type Candidatos = Awaited<ReturnType<typeof buscarClientes>>;

function Mensaje({ estado }: { estado: EstadoAccionCliente }) {
  if (!estado.error && !estado.ok) return null;
  return (
    <p
      aria-live="polite"
      className={
        "mt-2.5 rounded-xl px-3.5 py-2.5 text-sm ring-1 " +
        (estado.error
          ? "bg-danger/10 text-danger-text ring-danger/20"
          : "bg-success/10 text-success-text ring-success/20")
      }
    >
      {estado.error ?? estado.ok}
    </p>
  );
}

/** Cuidado «eliminación permanente» solo para fichas sin historial: la ficha
 *  se identifica por nombre + teléfono y hay que confirmar dos veces. */
function BloqueEliminar({
  clienteId,
  nombre,
  telefono,
  tieneHistorial,
}: {
  clienteId: number;
  nombre: string;
  telefono: string;
  tieneHistorial: boolean;
}) {
  const [estado, accion, pendiente] = useActionState(
    eliminarCliente,
    {} as EstadoAccionCliente,
  );
  const [abierto, setAbierto] = useState(false);

  return (
    <form action={accion} className="rounded-2xl bg-danger/5 p-4 ring-1 ring-danger/20">
      <input type="hidden" name="cliente" value={clienteId} />
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="flex items-center gap-2 text-sm text-danger-text">
          <Trash2 aria-hidden className="h-4 w-4" />
          <span className="font-bold">Eliminar ficha</span>
          <span className="text-texto-muted/70">
            solo si no tiene domicilios, apartados ni deudas
          </span>
        </p>
        {tieneHistorial ? null : abierto ? (
          <button type="button" onClick={() => setAbierto(false)} className="rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app">
            <X aria-hidden className="mr-1 inline h-3.5 w-3.5" /> No borrar
          </button>
        ) : (
          <button type="button" onClick={() => setAbierto(true)} className="rounded-xl bg-danger/15 px-3.5 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/25 transition hover:bg-danger/25">
            Eliminar ficha
          </button>
        )}
      </div>

      {tieneHistorial ? (
        <p className="mt-1.5 text-xs text-texto-muted/60">
          Esta ficha tiene historial (domicilios, apartados, deudas o fusiones
          recibidas): no se elimina. Si es un duplicado, usa{" "}
          <span className="font-bold text-texto-app">Fusionar con otro cliente</span>{" "}
          para conservar todo en la ficha que se queda.
        </p>
      ) : abierto ? (
        <div className="mt-3 rounded-xl bg-panel-app p-3 ring-1 ring-danger/25">
          <p className="text-sm text-texto-muted/80">
            Vas a eliminar a <span className="font-bold text-texto-app">{nombre}</span>
            {telefono ? <span> · {telefono}</span> : null} (ficha #{clienteId}). La
            eliminación es <span className="font-bold text-danger-text">permanente</span> y
            la ficha no tendrá historial que pueda perderse.
          </p>
          <button
            type="submit"
            disabled={pendiente}
            className="mt-2.5 rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-texto-app transition hover:opacity-90 disabled:opacity-50"
          >
            {pendiente ? "Eliminando…" : "Sí, eliminar definitivamente"}
          </button>
        </div>
      ) : null}

      <Mensaje estado={estado} />
    </form>
  );
}

/** Fusión con otra ficha: mueve el historial al destino y borra esta ficha */
function BloqueFusionar({ clienteId }: { clienteId: number }) {
  const [estado, accion, pendiente] = useActionState(
    fusionarClientesForm,
    {} as EstadoAccionCliente,
  );
  const [abierto, setAbierto] = useState(false);
  const [busca, setBusca] = useState("");
  const [candidatos, setCandidatos] = useState<Candidatos>([]);
  const [destino, setDestino] = useState<ResumenFusion | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    const t = setTimeout(async () => {
      setCargando(true);
      const filas = await buscarClientes(busca);
      if (vivo) {
        setCandidatos(filas.filter((f) => f.id !== clienteId));
        setCargando(false);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [abierto, busca, clienteId]);

  const elegir = async (id: number) => {
    const resumen = await prepararFusion(clienteId, id);
    setDestino(resumen);
  };

  return (
    <form action={accion} className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
      <input type="hidden" name="origenId" value={clienteId} />
      <input type="hidden" name="destinoId" value={destino?.destino?.id ?? ""} />
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="flex items-center gap-2 text-sm">
          <Merge aria-hidden className="h-4 w-4 text-amber-brand" />
          <span className="font-bold">Fusionar con otro cliente</span>
          <span className="text-texto-muted/70">cuando la ficha es un duplicado</span>
        </p>
        <button
          type="button"
          onClick={() => {
            setAbierto(!abierto);
            setDestino(null);
          }}
          className="rounded-xl bg-panel-hover px-3.5 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app"
        >
          {abierto ? "Cerrar" : "Fusionar…"}
        </button>
      </div>

      {abierto ? (
        <div className="mt-3 space-y-2.5">
          <label className="block text-xs font-bold tracking-wide text-texto-muted/60">
            BUSCAR LA FICHA QUE SE CONSERVA
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nombre o teléfono…"
              className={CAMPO + " mt-1"}
            />
          </label>
          {cargando ? <p className="text-xs text-texto-muted/50">Buscando…</p> : null}
          {!cargando && candidatos.length === 0 ? (
            <p className="text-xs text-texto-muted/50">Sin resultados.</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {candidatos.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => elegir(c.id)}
                className={
                  "rounded-xl px-3 py-2 text-left text-sm ring-1 transition " +
                  (destino?.destino?.id === c.id
                    ? "bg-amber-brand/20 ring-amber-brand/50"
                    : "bg-fondo-app ring-borde-app hover:ring-amber-brand/40")
                }
              >
                <span className="font-bold text-texto-app">#{c.id} · {c.nombre}</span>
                {c.telefono ? <span className="block text-[11px] text-texto-muted/60">{c.telefono}</span> : null}
              </button>
            ))}
          </div>

          {destino ? (
            <div className="rounded-xl bg-fondo-app p-3 ring-1 ring-borde-app">
              <p className="text-sm font-bold text-texto-app">Resumen de la fusión</p>
              <p className="mt-1 text-sm text-texto-muted/80">
                Se conserva <span className="font-bold">#{destino.destino?.id} {destino.destino?.nombre}{destino.destino?.telefono ? ` · ${destino.destino.telefono}` : ""}</span>; se
                fusiona y borra <span className="font-bold">#{destino.origen?.id} {destino.origen?.nombre}{destino.origen?.telefono ? ` · ${destino.origen.telefono}` : ""}</span>.
              </p>
              <ul className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                <li className="rounded-lg bg-panel-app px-2.5 py-1.5 ring-1 ring-borde-app">
                  {destino.historial?.domicilios ?? 0} domicilios
                </li>
                <li className="rounded-lg bg-panel-app px-2.5 py-1.5 ring-1 ring-borde-app">
                  {destino.historial?.apartados ?? 0} apartados
                </li>
                <li className="rounded-lg bg-panel-app px-2.5 py-1.5 ring-1 ring-borde-app">
                  {destino.historial?.cuentas ?? 0} deudas
                </li>
                {destino.historial?.saldoPendiente ? (
                  <li className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-danger-text ring-danger/25">
                    saldo {formatCOP(destino.historial.saldoPendiente)}
                  </li>
                ) : null}
              </ul>
              <p className="mt-2 text-xs text-texto-muted/60">
                Los importes, abonos y estados quedan iguales; no crea movimientos de caja. Los
                datos vacíos de la ficha que se conserva se completan con los de la que se borra.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-warning-text" />
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(false);
                    setDestino(null);
                  }}
                  className="rounded-xl bg-panel-hover px-3.5 py-2 text-xs font-bold text-texto-muted/80 ring-1 ring-borde-app transition hover:text-texto-app"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pendiente}
                  className="rounded-xl bg-amber-brand px-4 py-2.5 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
                >
                  {pendiente ? "Fusionando…" : "Confirmar fusión"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Mensaje estado={estado} />
    </form>
  );
}

/** Bloque con las dos operaciones de limpieza de duplicados */
export function AccionesDuplicados({
  clienteId,
  nombre,
  telefono,
  tieneHistorial,
}: {
  clienteId: number;
  nombre: string;
  telefono: string;
  tieneHistorial: boolean;
}) {
  return (
    <section aria-label="Gestión de fichas duplicadas" className="mb-8 space-y-3">
      <BloqueFusionar clienteId={clienteId} />
      <BloqueEliminar
        clienteId={clienteId}
        nombre={nombre}
        telefono={telefono}
        tieneHistorial={tieneHistorial}
      />
    </section>
  );
}
