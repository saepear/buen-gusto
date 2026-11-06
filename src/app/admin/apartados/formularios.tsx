"use client";

import {
  CalendarClock,
  CookingPot,
  Minus,
  Plus,
  ShoppingBag,
  StickyNote,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { precioAlmuerzo, precioEspecialDelDia } from "@/lib/precios";
import { formatCOP } from "@/lib/format";
import {
  buscarClientesApartado,
  crearApartado,
  crearClienteRapido,
  menuDeFechaApartado,
  type CargaApartado,
  type ClienteRapidoResultado,
  type ComponenteMenuApartado,
  type EstadoAccionApartado,
} from "./actions";

const INICIAL: EstadoAccionApartado = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

export type ExtraDelCatalogo = {
  productoId: number;
  nombre: string;
  precio: number;
  tipo: string; // BEBIDA | ADICIONAL
};

export type ClienteOpcion = { id: number; nombre: string; telefono: string };

/** Un plan de almuerzo armado con el menú DE SU FECHA de entrega */
type Linea = {
  conSopa: boolean;
  proteinaProductoId: number;
  /** Principios y ensaladas incluidos (ids de Producto del menú de esa fecha) */
  principios: number[];
  ensaladas: number[];
  /** Sopa exacta escogida; null = la sopa del día del menú de entrega */
  sopa: number | null;
  /** Adicionales del catálogo DENTRO del plato: productoId → unidades */
  adicionales: Record<number, number>;
  cantidad: number;
  nota: string;
};

type Otro = { nombre: string; precio: string; cantidad: number; nota: string };

const nuevaLinea = (proteinaProductoId: number): Linea => ({
  conSopa: true,
  proteinaProductoId,
  principios: [],
  ensaladas: [],
  sopa: null,
  adicionales: {},
  cantidad: 1,
  nota: "",
});

/** Píldora de elección (sopa, principios, ensaladas) */
const CHIP = (elegido: boolean) =>
  "rounded-xl px-2.5 py-1.5 text-xs font-bold ring-1 transition " +
  (elegido
    ? "bg-amber-brand text-brown-950 ring-amber-brand"
    : "bg-panel-app text-texto-app ring-borde-app hover:ring-amber-brand/50");

function Stepper({
  cantidad,
  set,
  min = 0,
  max = 50,
}: {
  cantidad: number;
  set: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <span className="inline-flex items-center overflow-hidden rounded-xl ring-1 ring-borde-app">
      <button
        type="button"
        aria-label="Quitar uno"
        disabled={cantidad <= min}
        onClick={() => set(Math.max(min, cantidad - 1))}
        className="px-2 py-1.5 text-texto-muted/70 transition hover:text-texto-app disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center text-sm font-bold text-texto-app">
        {cantidad}
      </span>
      <button
        type="button"
        aria-label="Agregar uno"
        disabled={cantidad >= max}
        onClick={() => set(Math.min(max, cantidad + 1))}
        className="px-2 py-1.5 text-texto-muted/70 transition hover:text-texto-app disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </span>
  );
}

/**
 * Constructor de un apartado: los platos se arman con el menú DE LA FECHA DE
 * ENTREGA (nunca «hoy» en silencio) y los precios los congela el SERVIDOR al
 * guardar; aquí solo se muestran.
 */
export function FormularioApartado({
  menu: menuSemilla,
  fechaHoy,
  extras,
  clientes: clientesIniciales,
}: {
  /** Componentes del menú de la fecha por defecto (hoy); null = ese día no hay */
  menu: ComponenteMenuApartado[] | null;
  fechaHoy: string;
  extras: ExtraDelCatalogo[];
  clientes: ClienteOpcion[];
}) {
  const [estado, accion, pendiente] = useActionState(crearApartado, INICIAL);

  // ── Cliente: filtro en vivo (busca EN BASE) + ficha + creación rápida ──
  const [clientes, setClientes] = useState<ClienteOpcion[]>(clientesIniciales);
  const [clienteQ, setClienteQ] = useState("");
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [buscandoClientes, setBuscandoClientes] = useState(false);

  const [fechaEntrega, setFechaEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  // Cómo se entrega: comer en mesa del salón (por defecto, lo habitual en
  // un apartado) o recoger y llevar con empaque — cambia el precio congelado.
  const [paraLlevar, setParaLlevar] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [extrasCant, setExtrasCant] = useState<Record<number, number>>({});
  const [otros, setOtros] = useState<Otro[]>([]);

  // Menú DE LA FECHA DE ENTREGA (nunca «hoy» en silencio): se siembra con el
  // de hoy y se recarga al cambiar la fecha
  const [menuFecha, setMenuFecha] = useState<{
    fecha: string;
    existe: boolean;
    componentes: ComponenteMenuApartado[];
  }>({
    fecha: fechaHoy,
    existe: menuSemilla !== null,
    componentes: menuSemilla ?? [],
  });
  const [cargandoMenu, setCargandoMenu] = useState(false);
  const [avisoMenu, setAvisoMenu] = useState<string | null>(null);

  // Panel «registrar cliente nuevo» (sin abrir otra página ni perder el pedido)
  const [panelCrear, setPanelCrear] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTelefono, setNuevoTelefono] = useState("");
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [nuevoBarrio, setNuevoBarrio] = useState("");
  const [creandoCliente, setCreandoCliente] = useState(false);
  const [errCrear, setErrCrear] = useState<string | null>(null);
  const [avisoCrear, setAvisoCrear] = useState<string | null>(null);
  const [coincidencias, setCoincidencias] = useState<
    ClienteRapidoResultado["coincidencias"] | null
  >(null);

  // Búsqueda en BD con 250 ms de reposo; la página siembra 12 fichas al abrir
  const primerRun = useRef(true);
  useEffect(() => {
    if (primerRun.current) {
      primerRun.current = false;
      return;
    }
    let vivo = true;
    setBuscandoClientes(true);
    const t = setTimeout(async () => {
      const filas = await buscarClientesApartado(clienteQ.trim());
      if (vivo) {
        setClientes(filas);
        setBuscandoClientes(false);
      }
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [clienteQ]);

  /** Alta desde el panel: misma regla de duplicados de Clientes. Los campos
   *  del constructor (planes, extras, entrega) NO se tocan. */
  const crearRapido = async (forzar = false) => {
    setCreandoCliente(true);
    setErrCrear(null);
    setAvisoCrear(null);
    try {
      const res = await crearClienteRapido({
        nombre: nuevoNombre,
        telefono: nuevoTelefono,
        direccion: nuevaDireccion,
        barrio: nuevoBarrio,
        forzar,
      });
      if (res.error) {
        setErrCrear(res.error);
      } else if (res.coincidencias && res.coincidencias.length > 0) {
        setCoincidencias(res.coincidencias);
      } else if (res.cliente) {
        const c = res.cliente;
        setCoincidencias(null);
        setAvisoCrear(res.ok);
        setClientes((prev) => [
          { id: c.id, nombre: c.nombre, telefono: c.telefono },
          ...prev.filter((x) => x.id !== c.id),
        ]);
        setClienteId(c.id); // queda seleccionado al instante
        setPanelCrear(false);
        setNuevoNombre("");
        setNuevoTelefono("");
        setNuevaDireccion("");
        setNuevoBarrio("");
      }
    } finally {
      setCreandoCliente(false);
    }
  };

  /** Enter no debe mandar el form principal al escribir en el panel */
  const sinEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") e.preventDefault();
  };

  const limito = clienteQ.trim().toLowerCase();
  const clientesFiltrados = clientes
    .filter(
      (c) =>
        !limito ||
        c.nombre.toLowerCase().includes(limito) ||
        c.telefono.replace(/\D/g, "").includes(limito.replace(/\D/g, "")),
    )
    .slice(0, 30);
  const clienteElegido = clientes.find((c) => c.id === clienteId);

  // ── Menú de la fecha de entrega: hoy por defecto; al cambiar la fecha se
  // consulta el menú DE ESE DÍA (y los planes armados se quitan: hubo
  // otro menú). Sin menú esa fecha → aviso y solo extras/narrados.
  const fechaCargada = useRef(fechaHoy);
  useEffect(() => {
    const efectiva =
      fechaEntrega === "" || fechaEntrega === fechaHoy ? fechaHoy : fechaEntrega;
    if (efectiva === fechaCargada.current || !/^\d{4}-\d{2}-\d{2}$/.test(efectiva)) {
      return;
    }
    fechaCargada.current = efectiva;
    if (lineas.length > 0) {
      // Los planes eran del menú de otra fecha: se quitan y se rearman
      setLineas([]);
      setAvisoMenu(
        `Cambió la fecha de entrega: vuelve a armar los almuerzos con el menú del ${efectiva}.`,
      );
    } else {
      setAvisoMenu(null);
    }
    // De vuelta a hoy: la semilla de la página es el menú de hoy
    if (efectiva === fechaHoy) {
      setMenuFecha({
        fecha: fechaHoy,
        existe: menuSemilla !== null,
        componentes: menuSemilla ?? [],
      });
      setCargandoMenu(false);
      return;
    }
    setCargandoMenu(true);
    let vivo = true;
    const t = setTimeout(async () => {
      const m = await menuDeFechaApartado(efectiva);
      if (!vivo) return;
      setCargandoMenu(false);
      setMenuFecha({
        fecha: m.fecha,
        existe: m.existeMenu,
        componentes: m.componentes,
      });
      if (!m.existeMenu) {
        setAvisoMenu(
          `Para el ${m.fecha} todavía no hay menú: solo se puede apartar bebidas y lo narrado a mano.`,
        );
      }
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaEntrega, fechaHoy, menuSemilla]);

  // ── Componentes del menú de esa fecha
  const porProductoDelMenu = new Map(
    menuFecha.componentes.map((c) => [c.productoId, c] as const),
  );
  const proteinasMenu = menuFecha.componentes.filter((c) => c.tipo === "PROTEINA");
  const principiosMenu = menuFecha.componentes.filter((c) => c.tipo === "PRINCIPIO");
  const ensaladasMenu = menuFecha.componentes.filter((c) => c.tipo === "ENSALADA");
  const sopasMenu = menuFecha.componentes.filter((c) => c.tipo === "SOPA");
  const adicionalesCatalogo = extras.filter((e) => e.tipo === "ADICIONAL");
  const extrasPorProducto = new Map(extras.map((e) => [e.productoId, e] as const));

  /** Precio congelado de UNA unidad del plan: proteína (el especial del día
   *  de ESA FECHA manda, si no el almuerzo corriente en su modalidad) más los
   *  adicionales que van dentro del plato. */
  const precioPlato = (l: Linea) => {
    const prot = porProductoDelMenu.get(l.proteinaProductoId);
    const base =
      prot && prot.precioPropio > 0
        ? precioEspecialDelDia(prot.precioPropio, l.conSopa, paraLlevar)
        : precioAlmuerzo(l.conSopa, paraLlevar);
    const adicion = Object.entries(l.adicionales).reduce(
      (suma, [id, n]) =>
        suma + (extrasPorProducto.get(Number(id))?.precio ?? 0) * n,
      0,
    );
    return base + adicion;
  };

  const total = useMemo(() => {
    let t = 0;
    for (const l of lineas) {
      t += precioPlato(l) * l.cantidad;
    }
    for (const e of extras) {
      t += e.precio * (extrasCant[e.productoId] ?? 0);
    }
    for (const o of otros) {
      t += Number(o.precio.replace(/[^0-9]/g, "") || 0) * o.cantidad;
    }
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineas, extrasCant, otros, extras, menuFecha, paraLlevar]);

  // El apartado se despachó bien: limpiar el constructor para el siguiente
  const okPrevio = useRef<string | null>(null);
  useEffect(() => {
    if (estado.ok && estado.ok !== okPrevio.current) {
      setLineas([]);
      setExtrasCant({});
      setOtros([]);
      setObservaciones("");
      setHoraEntrega("");
      setAvisoMenu(null);
    }
    if (estado.ok) okPrevio.current = estado.ok;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.ok]);

  const hayExtras = Object.values(extrasCant).some((n) => n > 0);
  const puedeEnviar =
    clienteId !== null &&
    total > 0 &&
    (lineas.length > 0 || otros.length > 0 || hayExtras);

  const carga: CargaApartado = {
    clienteId: clienteId ?? 0,
    fechaEntrega: fechaEntrega || undefined,
    horaEntrega: horaEntrega.trim() || undefined,
    paraLlevar,
    lineas: lineas.map((l) => ({
      conSopa: l.conSopa,
      proteinaProductoId: l.proteinaProductoId,
      principiosProductoIds: l.principios,
      ensaladasProductoIds: l.ensaladas,
      sopaProductoId: l.conSopa ? l.sopa : undefined,
      adicionalesProductoIds: Object.entries(l.adicionales).flatMap(([id, n]) =>
        Array.from({ length: n }, () => Number(id)),
      ),
      cantidad: l.cantidad,
      nota: l.nota.trim() || undefined,
    })),
    extras: Object.entries(extrasCant)
      .filter(([, n]) => n > 0)
      .map(([id, n]) => ({ productoId: Number(id), cantidad: n })),
    otros: otros.map((o) => ({
      nombre: o.nombre,
      precio: Number(o.precio.replace(/[^0-9]/g, "") || 0),
      cantidad: o.cantidad,
      nota: o.nota.trim() || undefined,
    })),
    observaciones: observaciones.trim() || undefined,
  };

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="datos" value={JSON.stringify(carga)} />

      {/* Cliente */}
      <section className="rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-texto-app">
          <UserRound className="h-5 w-5 text-amber-brand" /> ¿Quién aparta?
        </h2>

        {clienteId !== null && clienteElegido ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-brand/10 px-3.5 py-2.5 ring-1 ring-amber-brand/40">
            <p className="text-sm text-texto-app">
              Apertando para{" "}
              <strong className="font-bold">
                {clienteElegido.nombre}
                {clienteElegido.telefono ? ` · ${clienteElegido.telefono}` : ""}
              </strong>{" "}
              <span className="text-texto-muted/60">(#{clienteId})</span>
            </p>
            <button
              type="button"
              onClick={() => setClienteId(null)}
              className="flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
            >
              <X className="h-3.5 w-3.5" /> Cambiar cliente
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              value={clienteQ}
              onChange={(e) => setClienteQ(e.target.value)}
              placeholder="Buscar cliente por nombre o teléfono…"
              aria-label="Buscar clientes"
              className={CAMPO + " mb-1"}
            />
            <p aria-live="polite" className="mb-2 min-h-4 text-[11px] text-texto-muted/50">
              {!buscandoClientes &&
              clienteQ.trim() !== "" &&
              clientesFiltrados.length === 0
                ? "Nadie con ese nombre o teléfono: regístralo abajo."
                : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {clientesFiltrados.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClienteId(c.id)}
                  className={
                    "rounded-xl px-3.5 py-2 text-sm font-bold ring-1 transition " +
                    (clienteId === c.id
                      ? "bg-amber-brand text-brown-950 ring-amber-brand"
                      : "bg-fondo-app text-texto-app ring-borde-app hover:ring-amber-brand/50")
                  }
                >
                  {c.nombre}
                  {c.telefono ? (
                    <span className="ml-1.5 font-medium opacity-70">
                      {c.telefono}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* Creación rápida: las mismas reglas de Clientes, sin salir de aquí */}
            {panelCrear ? (
              <div className="mt-3 rounded-xl bg-panel-app p-3.5 ring-1 ring-borde-app">
                <p className="text-sm font-bold text-texto-app">
                  Registrar cliente nuevo
                </p>
                <p className="text-xs text-texto-muted/60">
                  Si ya existe aparecerá arriba para que decidas: no se crea
                  doble ficha ni se reutiliza en silencio.
                </p>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <label className={ETIQUETA}>
                    NOMBRE *
                    <input
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      onKeyDown={sinEnter}
                      maxLength={60}
                      placeholder="Ej: Gloria Ramírez"
                      className={CAMPO + " mt-1"}
                    />
                  </label>
                  <label className={ETIQUETA}>
                    TELÉFONO (opcional)
                    <input
                      value={nuevoTelefono}
                      onChange={(e) => setNuevoTelefono(e.target.value)}
                      onKeyDown={sinEnter}
                      inputMode="tel"
                      maxLength={24}
                      placeholder="Ej: 313 555 0202"
                      className={CAMPO + " mt-1"}
                    />
                  </label>
                  <label className={ETIQUETA}>
                    DIRECCIÓN (opcional)
                    <input
                      value={nuevaDireccion}
                      onChange={(e) => setNuevaDireccion(e.target.value)}
                      onKeyDown={sinEnter}
                      maxLength={120}
                      placeholder="Ej: Cra 8 # 5-55"
                      className={CAMPO + " mt-1"}
                    />
                  </label>
                  <label className={ETIQUETA}>
                    BARRIO (opcional)
                    <input
                      value={nuevoBarrio}
                      onChange={(e) => setNuevoBarrio(e.target.value)}
                      onKeyDown={sinEnter}
                      maxLength={60}
                      placeholder="Ej: Centro"
                      className={CAMPO + " mt-1"}
                    />
                  </label>
                </div>

                {errCrear ? (
                  <p
                    aria-live="polite"
                    className="mt-2 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger-text ring-1 ring-danger/20"
                  >
                    {errCrear}
                  </p>
                ) : null}

                {coincidencias && coincidencias.length > 0 ? (
                  <div
                    role="status"
                    className="mt-2 rounded-xl bg-info/10 px-3.5 py-3 text-sm ring-1 ring-info/20"
                  >
                    <p className="font-bold text-info-text">
                      Ya hay fichas que podrían ser este cliente
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {coincidencias.map((c) => (
                        <li
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-panel-app px-3 py-2 ring-1 ring-borde-app"
                        >
                          <span className="text-texto-app">
                            <span className="font-bold">
                              #{c.id} · {c.nombre}
                            </span>
                            {c.telefono ? (
                              <span className="text-texto-muted/70">
                                {" "}
                                · {c.telefono}
                              </span>
                            ) : null}
                            {c.direccion || c.barrio ? (
                              <span className="text-texto-muted/50">
                                {" "}
                                · {[c.direccion, c.barrio].filter(Boolean).join(" · ")}
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setClientes((prev) => [
                                { id: c.id, nombre: c.nombre, telefono: c.telefono },
                                ...prev.filter((x) => x.id !== c.id),
                              ]);
                              setClienteId(c.id);
                              setCoincidencias(null);
                              setPanelCrear(false);
                              setNuevoNombre("");
                              setNuevoTelefono("");
                              setNuevaDireccion("");
                              setNuevoBarrio("");
                            }}
                            className="rounded-lg bg-fondo-app px-2.5 py-1.5 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:ring-amber-brand/50"
                          >
                            Apertar a esta ficha
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={creandoCliente}
                      onClick={() => crearRapido(true)}
                      className="mt-2 rounded-xl bg-panel-app px-3.5 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand/20 disabled:opacity-50"
                    >
                      {creandoCliente ? "Guardando…" : "Es otra persona: crear ficha nueva"}
                    </button>
                  </div>
                ) : null}

                {avisoCrear ? (
                  <p
                    aria-live="polite"
                    className="mt-2 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm text-success-text ring-1 ring-success/20"
                  >
                    {avisoCrear}
                  </p>
                ) : null}

                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={creandoCliente}
                    onClick={() => crearRapido(false)}
                    className="rounded-xl bg-amber-brand px-4 py-2.5 text-sm font-bold text-brown-950 transition hover:bg-orange-brand disabled:opacity-40"
                  >
                    {creandoCliente ? "Guardando…" : "Guardar cliente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanelCrear(false);
                      setNuevoNombre("");
                      setNuevoTelefono("");
                      setNuevaDireccion("");
                      setNuevoBarrio("");
                      setErrCrear(null);
                      setCoincidencias(null);
                      setAvisoCrear(null);
                    }}
                    className="rounded-xl bg-fondo-app px-3.5 py-2.5 text-sm font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:text-texto-app"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPanelCrear(true);
                  setErrCrear(null);
                  setCoincidencias(null);
                  setAvisoCrear(null);
                }}
                className="mt-2.5 flex items-center gap-2 rounded-xl bg-panel-app px-3.5 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
              >
                <UserPlus className="h-4 w-4 text-amber-brand" /> Registrar cliente nuevo
              </button>
            )}
          </>
        )}
      </section>

      {/* Aviso del cambio de menú por fecha */}
      {avisoMenu ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-warning/10 px-4 py-3 text-sm font-bold text-amber-brand ring-1 ring-warning/30"
        >
          {avisoMenu}
        </p>
      ) : null}

      {/* Almuerzos del menú DE LA FECHA DE ENTREGA */}
      <section className="rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg text-texto-app">
            Almuerzos del menú{" "}
            {menuFecha.fecha === fechaHoy ? "de hoy" : `del ${menuFecha.fecha}`}
          </h2>
          <p className="text-xs text-texto-muted/50">
            {cargandoMenu
              ? "Buscando el menú de esa fecha…"
              : fechaEntrega === "" || fechaEntrega === fechaHoy
                ? "Sin fecha de entrega = hoy"
                : "El precio se congela con el menú de esa fecha"}
          </p>
        </div>

        {cargandoMenu ? (
          <p className="rounded-xl bg-panel-app p-3 text-sm text-texto-muted/60">
            Buscando el menú…
          </p>
        ) : !menuFecha.existe ? (
          <div className="rounded-xl bg-warning/10 p-3.5 ring-1 ring-warning/30">
            <p className="text-sm font-bold text-amber-brand">
              El {menuFecha.fecha} todavía no tiene menú apartado
            </p>
            <p className="mt-1 text-sm text-texto-muted/70">
              Aquí solo se puede apartar bebidas y lo narrado a mano. Cuando el
              menú de ese día esté registrado, elegilo de nuevo y arma los
              almuerzos con sus precios.
            </p>
          </div>
        ) : proteinasMenu.length === 0 ? (
          <p className="rounded-xl bg-panel-app p-3 text-sm text-warning-text">
            El menú no tiene proteínas: no hay almuerzos completos para apartar.
            Se puede apartar bebidas y lo narrado a mano (abajo).
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {lineas.map((_, i) => (
                <span
                  key={i}
                  className="rounded-full bg-fondo-app px-2 py-0.5 text-[10px] font-bold text-texto-muted/60 ring-1 ring-borde-app"
                >
                  Plan {i + 1}
                </span>
              ))}
            </div>
            <ul className="space-y-2.5">
              {lineas.map((l, i) => {
                const guarda = (cambios: Partial<Linea>) =>
                  setLineas(
                    lineas.map((x, j) => (j === i ? { ...x, ...cambios } : x)),
                  );
                return (
                  <li
                    key={i}
                    className="rounded-xl bg-fondo-app p-3 ring-1 ring-borde-app"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={l.proteinaProductoId}
                        onChange={(e) =>
                          guarda({ proteinaProductoId: Number(e.target.value) })
                        }
                        aria-label={`Proteína del plan ${i + 1}`}
                        className="rounded-xl bg-fondo-app px-2.5 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app"
                      >
                        {proteinasMenu.map((pr) => (
                          <option key={pr.productoId} value={pr.productoId}>
                            {pr.nombre}
                            {pr.disponibles !== null && pr.disponibles <= 8
                              ? ` · quedan ${pr.disponibles}`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <span className="inline-flex overflow-hidden rounded-xl ring-1 ring-borde-app">
                        <button
                          type="button"
                          onClick={() => guarda({ conSopa: true })}
                          className={
                            "px-3 py-2 text-xs font-bold transition " +
                            (l.conSopa
                              ? "bg-amber-brand text-brown-950"
                              : "bg-fondo-app text-texto-muted/60")
                          }
                        >
                          Completo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            guarda({ conSopa: false, sopa: null })
                          }
                          className={
                            "px-3 py-2 text-xs font-bold transition " +
                            (!l.conSopa
                              ? "bg-amber-brand text-brown-950"
                              : "bg-fondo-app text-texto-muted/60")
                          }
                        >
                          Bandeja
                        </button>
                      </span>
                      <Stepper cantidad={l.cantidad} set={(n) => guarda({ cantidad: n })} />
                      <strong className="font-display text-md text-texto-app">
                        {formatCOP(precioPlato(l) * l.cantidad)}
                      </strong>
                      <button
                        type="button"
                        onClick={() => setLineas(lineas.filter((_, j) => j !== i))}
                        aria-label={`Quitar plan ${i + 1}`}
                        className="ml-auto rounded-xl bg-panel-app p-1.5 text-danger-text/70 ring-1 ring-borde-app transition hover:text-danger-text"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Sopa exacta del menú (o «sopa del día») */}
                    {l.conSopa ? (
                      sopasMenu.length > 0 ? (
                        <div className="mt-2.5">
                          <p className="mb-1 text-[10px] font-bold tracking-wide text-texto-muted/50">
                            SOPA
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => guarda({ sopa: null })}
                              className={CHIP(l.sopa === null)}
                            >
                              Sopa del día
                            </button>
                            {sopasMenu.map((s) => (
                              <button
                                key={s.productoId}
                                type="button"
                                onClick={() => guarda({ sopa: s.productoId })}
                                className={CHIP(l.sopa === s.productoId)}
                              >
                                {s.nombre}
                                {s.disponibles !== null && s.disponibles <= 8
                                  ? ` · ${s.disponibles}`
                                  : ""}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-texto-muted/55">
                          El menú de esa fecha no trae sopa: se llevará la sopa
                          del día de la entrega.
                        </p>
                      )
                    ) : null}

                    {/* Principios incluidos */}
                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-bold tracking-wide text-texto-muted/50">
                        PRINCIPIOS (incluidos)
                      </p>
                      {principiosMenu.length === 0 ? (
                        <p className="text-xs text-texto-muted/55">
                          El menú de esa fecha no tiene principios.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {principiosMenu.map((p) => {
                            const elegido = l.principios.includes(p.productoId);
                            return (
                              <button
                                key={p.productoId}
                                type="button"
                                onClick={() =>
                                  guarda({
                                    principios: elegido
                                      ? l.principios.filter(
                                          (x) => x !== p.productoId,
                                        )
                                      : [...l.principios, p.productoId],
                                  })
                                }
                                className={CHIP(elegido)}
                              >
                                {p.nombre}
                                {p.disponibles !== null && p.disponibles <= 8
                                  ? ` · ${p.disponibles}`
                                  : ""}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Ensaladas incluidas */}
                    <div className="mt-2">
                      <p className="mb-1 text-[10px] font-bold tracking-wide text-texto-muted/50">
                        ENSALADAS (incluidas)
                      </p>
                      {ensaladasMenu.length === 0 ? (
                        <p className="text-xs text-texto-muted/55">
                          El menú de esa fecha no tiene ensaladas.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {ensaladasMenu.map((e) => {
                            const elegido = l.ensaladas.includes(e.productoId);
                            return (
                              <button
                                key={e.productoId}
                                type="button"
                                onClick={() =>
                                  guarda({
                                    ensaladas: elegido
                                      ? l.ensaladas.filter(
                                          (x) => x !== e.productoId,
                                        )
                                      : [...l.ensaladas, e.productoId],
                                  })
                                }
                                className={CHIP(elegido)}
                              >
                                {e.nombre}
                                {e.disponibles !== null && e.disponibles <= 8
                                  ? ` · ${e.disponibles}`
                                  : ""}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Adicionales DENTRO del plato (se cobran aparte) */}
                    {adicionalesCatalogo.length > 0 ? (
                      <div className="mt-2">
                        <p className="mb-1 text-[10px] font-bold tracking-wide text-texto-muted/50">
                          ADICIONALES EN EL PLATO (se cobran aparte)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {adicionalesCatalogo.map((e) => {
                            const n = l.adicionales[e.productoId] ?? 0;
                            return (
                              <span
                                key={e.productoId}
                                className={
                                  "flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold ring-1 transition " +
                                  (n > 0
                                    ? "bg-amber-brand/15 text-amber-brand ring-amber-brand/40"
                                    : "bg-panel-app text-texto-app ring-borde-app")
                                }
                              >
                                <button
                                  type="button"
                                  aria-label={`Quitar un ${e.nombre} del plan ${i + 1}`}
                                  onClick={() =>
                                    guarda({
                                      adicionales: {
                                        ...l.adicionales,
                                        [e.productoId]: Math.max(0, n - 1),
                                      },
                                    })
                                  }
                                  className="opacity-60 transition hover:opacity-100"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                {e.nombre}
                                {n > 0 ? (
                                  <b className="text-amber-brand">×{n}</b>
                                ) : (
                                  <span className="opacity-70">
                                    {formatCOP(e.precio)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  aria-label={`Agregar un ${e.nombre} al plan ${i + 1}`}
                                  onClick={() =>
                                    guarda({
                                      adicionales: {
                                        ...l.adicionales,
                                        [e.productoId]: n + 1,
                                      },
                                    })
                                  }
                                  className="opacity-60 transition hover:opacity-100"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <input
                      value={l.nota}
                      onChange={(e) => guarda({ nota: e.target.value })}
                      maxLength={60}
                      placeholder="Nota para cocina (ej: sin cebolla)…"
                      className={CAMPO + " mt-2 text-xs"}
                    />
                  </li>
                );
              })}
            </ul>
            {lineas.length === 0 ? (
              <p className="mb-2 text-sm text-texto-muted/60">
                Aun no hay planes de almuerzo en la lista.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() =>
                setLineas([
                  ...lineas,
                  nuevaLinea(proteinasMenu[0].productoId),
                ])
              }
              disabled={proteinasMenu.length === 0}
              className="mt-3 flex items-center gap-2 rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover disabled:opacity-40"
            >
              <Plus className="h-4 w-4 text-amber-brand" /> Añadir almuerzo
            </button>
          </>
        )}
      </section>

      {/* Extras del catálogo */}
      <section className="rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
        <h2 className="mb-3 font-display text-lg text-texto-app">
          Bebidas y adicionales
        </h2>
        {extras.length === 0 ? (
          <p className="text-sm text-texto-muted/60">
            No hay bebidas o adicionales con precio en el catálogo.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {extras.map((e) => {
              const n = extrasCant[e.productoId] ?? 0;
              return (
                <li
                  key={e.productoId}
                  className={
                    "flex items-center justify-between gap-2 rounded-xl bg-fondo-app px-3 py-2 ring-1 transition " +
                    (n > 0 ? "ring-amber-brand/50" : "ring-borde-app")
                  }
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-texto-app">
                      {e.nombre}
                    </span>
                    <span className="text-xs text-texto-muted/55">
                      {formatCOP(e.precio)}
                    </span>
                  </span>
                  <Stepper
                    cantidad={n}
                    set={(v) =>
                      setExtrasCant({ ...extrasCant, [e.productoId]: v })
                    }
                    max={20}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Narrados a mano */}
      <section className="rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app">
        <h2 className="mb-1 flex items-center gap-2 font-display text-lg text-texto-app">
          <StickyNote className="h-5 w-5 text-amber-brand" /> Otras cosas apartadas
        </h2>
        <p className="mb-3 text-xs text-texto-muted/60">
          Ítems que no están en el catálogo (recuerda anotar su valor).
        </p>
        <ul className="space-y-2">
          {otros.map((o, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2 rounded-xl bg-fondo-app p-2.5 ring-1 ring-borde-app">
              <label className={ETIQUETA + " min-w-36 grow"}>
                QUÉ SERÁ
                <input
                  value={o.nombre}
                  onChange={(e) =>
                    setOtros(otros.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))
                  }
                  maxLength={60}
                  className={CAMPO}
                  placeholder="Ej: 30 mantecadas"
                />
              </label>
              <label className={ETIQUETA}>
                PRECIO U.
                <input
                  value={o.precio}
                  onChange={(e) =>
                    setOtros(otros.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))
                  }
                  inputMode="numeric"
                  className={CAMPO + " w-24"}
                  placeholder="$0"
                />
              </label>
              <Stepper
                cantidad={o.cantidad}
                set={(n) =>
                  setOtros(otros.map((x, j) => (j === i ? { ...x, cantidad: n } : x)))
                }
              />
              <button
                type="button"
                onClick={() => setOtros(otros.filter((_, j) => j !== i))}
                aria-label="Quitar ítem"
                className="rounded-xl bg-panel-app p-2 text-danger-text/70 ring-1 ring-borde-app hover:text-danger-text"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setOtros([...otros, { nombre: "", precio: "", cantidad: 1, nota: "" }])
          }
          className="mt-3 flex items-center gap-2 rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
        >
          <Plus className="h-4 w-4 text-amber-brand" /> Añadir ítem a mano
        </button>
      </section>

      {/* Entrega y notas */}
      <section className="grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2">
        {/* Modalidad de entrega: congela el precio del plato (llevar con
            empaque / en mesa a los platos del salón) */}
        <div className="sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
            ¿Cómo lo entrega?
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={paraLlevar}
              onClick={() => setParaLlevar(true)}
              className={
                "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition " +
                (paraLlevar
                  ? "bg-amber-brand text-brown-950"
                  : "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app hover:text-texto-app")
              }
            >
              <ShoppingBag className="h-4 w-4" /> Recoger y llevar
            </button>
            <button
              type="button"
              aria-pressed={!paraLlevar}
              onClick={() => setParaLlevar(false)}
              className={
                "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition " +
                (!paraLlevar
                  ? "bg-amber-brand text-brown-950"
                  : "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app hover:text-texto-app")
              }
            >
              <CookingPot className="h-4 w-4" /> Comer en mesa
            </button>
          </div>
          <p className="mt-1 text-[11px] text-texto-muted/55">
            {paraLlevar
              ? "Precios para llevar (el completo lleva su empaque)."
              : "Precios de salón, sin empaque."}
          </p>
        </div>
        <label className={ETIQUETA}>
          FECHA DE ENTREGA (opcional · hoy si no se dice)
          <input
            type="date"
            value={fechaEntrega}
            onChange={(e) => setFechaEntrega(e.target.value)}
            className={CAMPO + " mt-1"}
          />
        </label>
        <label className={ETIQUETA}>
          HORA QUE DIJO EL CLIENTE
          <input
            value={horaEntrega}
            onChange={(e) => setHoraEntrega(e.target.value)}
            maxLength={30}
            className={CAMPO + " mt-1"}
            placeholder="Ej: 12:30, la 1 y media"
          />
        </label>
        <label className={ETIQUETA + " sm:col-span-2"}>
          OBSERVACIONES
          <input
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            maxLength={240}
            className={CAMPO}
            placeholder="Ej: son para una reunión de la iglesia, cobrar todo junto"
          />
        </label>
      </section>

      {/* Pie: total + enviar */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brown-900/95 px-4 py-3 ring-1 ring-amber-brand/30 backdrop-blur">
        <span className="text-sm text-cream-200/80">
          Total congelado al apartar:
          <strong className="ml-2 font-display text-2xl text-amber-brand">
            {formatCOP(total)}
          </strong>
        </span>
        <button
          type="submit"
          disabled={!puedeEnviar || pendiente}
          className="flex items-center gap-2 rounded-xl bg-amber-brand px-6 py-3 font-display text-md text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-40"
        >
          <CalendarClock className="h-5 w-5" />
          {pendiente ? "Guardando…" : "Guardar apartado"}
        </button>
      </div>

      {estado.error ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger-text ring-1 ring-danger/20"
        >
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p
          aria-live="polite"
          className="rounded-xl bg-success/10 px-4 py-3 text-sm font-bold text-success-text ring-1 ring-success/20"
        >
          {estado.ok} Queda en la lista «Por entregar».
        </p>
      ) : null}
    </form>
  );
}
