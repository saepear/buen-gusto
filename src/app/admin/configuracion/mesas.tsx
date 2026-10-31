"use client";

import gsap from "gsap";
import { Eye, EyeOff, LayoutGrid, Trash2, TriangleAlert } from "lucide-react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { type EstadoMesa } from "@/lib/roles";
import { alternarMesa, borrarMesa, crearMesa, type EstadoAccionConfig } from "./acciones";
import { Aviso } from "./usuarios";

const INICIAL: EstadoAccionConfig = { error: null, ok: null };

const ESTILO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "bg-success/10 text-success-text ring-1 ring-success/20",
  OCUPADA: "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
};

const TEXTO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "Libre",
  OCUPADA: "Ocupada",
  POR_PAGAR: "Por pagar",
};

export type MesaDetalle = {
  id: number;
  nombre: string;
  estado: string;
  activa: boolean;
  /** Comandas históricas de la mesa */
  pedidos: number;
};

/** La mesa que el administrador pidió borrar y aún no confirmó */
type ObjetivoBorrar = { id: number; nombre: string; comandas: number };

function ChipMesa({
  mesa,
  onBorrar,
}: {
  mesa: MesaDetalle;
  onBorrar: (mesa: MesaDetalle) => void;
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    alternarMesa,
    INICIAL,
  );
  const oculta = !mesa.activa;
  const e = mesa.estado as EstadoMesa;

  return (
    <div className={oculta ? "rounded-2xl bg-campo-app p-3.5 opacity-70" : "rounded-2xl bg-campo-app p-3.5"}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-display text-lg text-texto-app">
          {mesa.nombre}
        </span>
        {oculta ? (
          <span className="rounded-full bg-panel-app px-2.5 py-0.5 text-[11px] font-bold text-texto-muted/45">
            Oculta
          </span>
        ) : (
          <span
            className={
              "rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
              ESTILO_ESTADO[e]
            }
          >
            {TEXTO_ESTADO[e]}
          </span>
        )}
      </div>
      {mesa.pedidos > 0 ? (
        <p className="mt-0.5 text-[11px] font-bold text-texto-muted/45">
          {mesa.pedidos === 1
            ? "1 comanda guardada"
            : `${mesa.pedidos} comandas guardadas`}
        </p>
      ) : null}

      <div className="mt-3 flex gap-1.5">
        <form action={accion} className="min-w-0 flex-1">
          <input type="hidden" name="mesaId" value={mesa.id} />
          <button
            type="submit"
            disabled={pendiente}
            className={
              "flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50 " +
              (oculta
                ? "bg-success/10 text-success-text ring-1 ring-success/20 hover:bg-success/25"
                : "border border-danger/40 bg-panel-app text-danger-text hover:bg-danger/10")
            }
          >
            {pendiente ? (
              "…"
            ) : oculta ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Mostrar
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Ocultar
              </>
            )}
          </button>
        </form>
        <button
          type="button"
          onClick={() => onBorrar(mesa)}
          disabled={pendiente}
          title="Borrar la mesa del salón"
          aria-label={`Borrar la mesa ${mesa.nombre}`}
          className="flex w-9 items-center justify-center rounded-lg border border-danger/40 bg-panel-app text-danger-text transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <Aviso estado={estado} />
    </div>
  );
}

/**
 * Ventana de confirmación de borrado, animada con GSAP: el fondo se
 * desvanece y la tarjeta entra con rebote suave («back.out»); el cierre
 * invierte la entrada. Si la mesa tiene comandas, la advertencia muestra
 * cuántas y aclara que se pierden con ella.
 */
function DialogoBorrar({
  mesa,
  estado,
  pendiente,
  accion,
  onCerrar,
}: {
  mesa: ObjetivoBorrar;
  estado: EstadoAccionConfig;
  pendiente: boolean;
  /** Acción ya envuelta por useActionState */
  accion: (datos: FormData) => void;
  onCerrar: () => void;
}) {
  const fondoRef = useRef<HTMLDivElement>(null);
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const cerrando = useRef(false);

  /** Cierre con animación: invierte la entrada y suelta la ventana al final */
  const cerrarAnimado = () => {
    if (cerrando.current) return;
    cerrando.current = true;
    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducido || !fondoRef.current || !tarjetaRef.current) {
      onCerrar();
      return;
    }
    gsap.killTweensOf([fondoRef.current, tarjetaRef.current]);
    // Respaldo por tiempo: si el navegador suspende los frames (pestaña en
    // segundo plano), la ventana se suelta igual y no queda la vida muerta.
    const respaldo = setTimeout(onCerrar, 600);
    gsap.to(fondoRef.current, { opacity: 0, duration: 0.2, ease: "power2.in" });
    gsap.to(tarjetaRef.current, {
      opacity: 0,
      scale: 0.94,
      y: 8,
      duration: 0.24,
      ease: "power2.in",
      onComplete: () => {
        clearTimeout(respaldo);
        onCerrar();
      },
    });
  };

  // Apertura: fondo + tarjeta entran con GSAP (una sola vez, al montar)
  useEffect(() => {
    const reducido = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducido || !fondoRef.current || !tarjetaRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(fondoRef.current, {
        opacity: 0,
        duration: 0.25,
        ease: "power2.out",
      });
      gsap.from(tarjetaRef.current, {
        opacity: 0,
        scale: 0.92,
        y: 12,
        duration: 0.4,
        ease: "back.out(1.5)",
      });
    });
    return () => ctx.revert();
  }, []);

  // Escape cierra la ventana (salvo que el borrado ya esté en camino)
  useEffect(() => {
    const teclas = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrarAnimado();
    };
    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Borrado confirmado: la ventana se va y el panel muestra el aviso. La
  // primera corrida no cuenta: tras un borrado anterior, estado.ok sigue
  // guardando su mensaje aunque se abra una ventana nueva.
  const primerEfectoOk = useRef(true);
  useEffect(() => {
    if (primerEfectoOk.current) {
      primerEfectoOk.current = false;
      return;
    }
    if (estado.ok !== null) cerrarAnimado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.ok]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        ref={fondoRef}
        aria-hidden
        onClick={cerrarAnimado}
        className="absolute inset-0 bg-brown-950/65 backdrop-blur-sm"
      />
      <div
        ref={tarjetaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="borrar-mesa-titulo"
        aria-describedby="borrar-mesa-desc"
        className="relative w-full max-w-md rounded-[2rem] bg-panel-app p-6 shadow-2xl ring-1 ring-borde-app"
      >
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger-text ring-1 ring-danger/25"
          >
            <TriangleAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3
              id="borrar-mesa-titulo"
              className="font-display text-xl leading-tight text-texto-app"
            >
              ¿Estás seguro de que quieres eliminar esta mesa?
            </h3>
            <p
              id="borrar-mesa-desc"
              className="mt-1.5 text-sm leading-relaxed text-texto-muted/80"
            >
              La mesa «{mesa.nombre}» desaparece del salón para siempre.
            </p>
            {mesa.comandas > 0 ? (
              <p className="mt-2.5 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm leading-relaxed text-danger-text ring-1 ring-danger/20">
                Lleva {mesa.comandas}{" "}
                {mesa.comandas === 1 ? "comanda guardada" : "comandas guardadas"}:{" "}
                se borran con la mesa y no habrá forma de recuperarlas.
              </p>
            ) : (
              <p className="mt-2.5 text-sm text-texto-muted/50">
                No tiene comandas guardadas: no se pierde nada del historial.
              </p>
            )}
          </div>
        </div>

        <form
          action={accion}
          className="mt-5 flex flex-col gap-2.5 sm:flex-row"
        >
          <input type="hidden" name="mesaId" value={mesa.id} />
          <button
            type="button"
            onClick={cerrarAnimado}
            disabled={pendiente}
            autoFocus
            className="flex-1 rounded-xl bg-campo-app px-4 py-3 font-display text-md text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover active:scale-95 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pendiente}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-danger px-4 py-3 font-display text-md text-danger-text ring-1 ring-danger/30 transition hover:bg-danger/85 hover:text-texto-app active:scale-95 disabled:opacity-50"
          >
            {pendiente ? (
              "Eliminando…"
            ) : (
              <>
                <Trash2 aria-hidden className="h-4 w-4" /> Sí, eliminar
              </>
            )}
          </button>
        </form>

        {estado.error ? (
          <div className="mt-3">
            <Aviso estado={estado} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PanelMesas({ mesas }: { mesas: MesaDetalle[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionConfig, FormData>(
    crearMesa,
    INICIAL,
  );
  const [estadoBorrar, accionBorrar, pendienteBorrar] = useActionState<
    EstadoAccionConfig,
    FormData
  >(borrarMesa, INICIAL);
  const [nombre, setNombre] = useState("");
  const [aprobada, setAprobada] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [objetivo, setObjetivo] = useState<ObjetivoBorrar | null>(null);
  const activas = mesas.filter((m) => m.activa);
  const ocultas = mesas.filter((m) => !m.activa);

  // Al crear una mesa con éxito, se limpia el campo para la siguiente
  // (setState durante el render, del modo que recomienda la documentación)
  if (estado.ok !== null && estado.ok !== aprobada) {
    setAprobada(estado.ok);
    setNombre("");
  }

  /** Siguiente número libre mirando los nombres existentes (ej. "Mesa 3") */
  const siguienteNumero = () => {
    const numeros = mesas
      .map((m) => m.nombre.match(/\d+/))
      .filter(Boolean)
      .map((m) => Number(m![0]));
    setNombre(String(numeros.length ? Math.max(...numeros) + 1 : 1));
  };

  /** Primera letra A–Z que aún no esté usada como nombre de una sola letra */
  const siguienteLetra = () => {
    const usadas = new Set(
      mesas
        .map((m) => m.nombre.trim().toUpperCase())
        .filter((n) => n.length === 1)
        .map((n) => n.charCodeAt(0)),
    );
    for (let c = 65; c <= 90; c++) {
      if (!usadas.has(c)) {
        setNombre(String.fromCharCode(c));
        break;
      }
    }
  };

  /** Pide el borrado de una mesa: abre la ventana de confirmación GSAP */
  const pedirBorrar = (mesa: MesaDetalle) => {
    setObjetivo({ id: mesa.id, nombre: mesa.nombre, comandas: mesa.pedidos });
  };

  /** Cierre definitivo de la ventana (el diálogo ya terminó su animación) */
  const soltarBorrar = () => setObjetivo(null);

  return (
    <section className="overflow-hidden rounded-[2rem] bg-panel-app ring-1 ring-borde-app">
      {/* Cabecera del módulo */}
      <div className="flex items-start justify-between gap-3 border-b border-borde-app px-5 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-campo-app ring-1 ring-borde-app">
            <LayoutGrid className="h-5 w-5 text-texto-muted" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl text-texto-app">
              Mesas del salón
            </h2>
            <p className="mt-0.5 text-sm text-texto-muted/75">
              Los meseros y la caja solo ven las mesas visibles. Cualquier mesa
              se puede borrar (ícono de basura): si ya tiene comandas, la
              ventana de confirmación avisa cuántas se pierden con ella.
            </p>
          </div>
        </div>
        <p className="shrink-0 pt-1.5 text-xs font-bold text-texto-muted/70">
          {activas.length} {activas.length === 1 ? "visible" : "visibles"}
        </p>
      </div>

      <div className="px-5 py-4 sm:px-6">
        {/* Alta: nombre a lo ancho con sugerencias y envío alineados */}
        <form
          action={accion}
          className="grid gap-2 rounded-2xl bg-campo-app p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
        >
          <input
            ref={inputRef}
            name="nombre"
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la mesa (1, 2… o A, B…)"
            aria-label="Nombre de la mesa nueva"
            className="rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
          <button
            type="button"
            onClick={() => {
              siguienteNumero();
              inputRef.current?.focus();
            }}
            title="Sugerir el siguiente número"
            className="rounded-lg bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70"
          >
            Núm…
          </button>
          <button
            type="button"
            onClick={() => {
              siguienteLetra();
              inputRef.current?.focus();
            }}
            title="Sugerir la siguiente letra disponible"
            className="rounded-lg bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70"
          >
            A…
          </button>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand/70 disabled:opacity-50"
          >
            {pendiente ? "Creando…" : "Agregar mesa"}
          </button>
          <div className="sm:col-span-full">
            <Aviso estado={estado} />
          </div>
        </form>

        {/* Mesas visibles */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {activas.map((m) => (
            <ChipMesa key={m.id} mesa={m} onBorrar={pedirBorrar} />
          ))}
        </div>

        {/* Mesas ocultas: sección aparte al fondo del módulo */}
        {ocultas.length > 0 ? (
          <div className="mt-4 border-t border-borde-app pt-4">
            <p className="text-sm font-bold text-texto-muted/75">
              Ocultas ({ocultas.length})
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ocultas.map((m) => (
                <ChipMesa key={m.id} mesa={m} onBorrar={pedirBorrar} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Resultado del borrado cuando la ventana ya se fue */}
        {!objetivo && estadoBorrar.ok ? (
          <div className="mt-4">
            <Aviso estado={estadoBorrar} />
          </div>
        ) : null}
      </div>

      {/* Ventana de confirmación «¿Estás seguro?» animada con GSAP */}
      {objetivo ? (
        <DialogoBorrar
          mesa={objetivo}
          estado={estadoBorrar}
          pendiente={pendienteBorrar}
          accion={accionBorrar}
          onCerrar={soltarBorrar}
        />
      ) : null}
    </section>
  );
}
