"use client";

import {
  ClipboardList,
  Clock,
  CupSoda,
  Drumstick,
  MapPin,
  Minus,
  Phone,
  Plus,
  Salad,
  Send,
  ShoppingBag,
  Soup,
  Star,
  StickyNote,
  Trash2,
  User,
  UtensilsCrossed,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { formatCOP } from "@/lib/format";
import { PRECIO_ICOPOR, precioAlmuerzo, precioEspecialDelDia } from "@/lib/precios";
import type { CategoriaPropia } from "@/lib/config";
import type { ClienteResumen } from "@/lib/clientes";
import { iconoDeCategoria } from "@/lib/iconos";
import type { ItemMenuHoy } from "@/lib/pedido";
import {
  ChipCantidad,
  FichaMenu,
  NotaVacia,
  PildoraModalidad,
  TituloSeccion,
  claseDeCategoria,
} from "@/components/constructor-plato";
import { tomarPedido } from "@/app/mesero/actions";
import { actualizarProgresoDomicilio } from "@/app/admin/domicilios/nuevo/progreso-domicilio";

/** error/ok del envío + coincidencias que piden decisión (solo domicilios) */
export type EstadoFormularioPedido = {
  error: string | null;
  ok: string | null;
  /** Fichas candidatas: el teléfono que escribió ya pertenece a otra persona */
  coincidencias?: ClienteResumen[];
};

/** Acción de servidor que guarda el pedido (mesero o domicilio) */
export type AccionPedido = (
  previa: EstadoFormularioPedido,
  datos: FormData,
) => Promise<EstadoFormularioPedido>;

const SIN_ENVIAR: EstadoFormularioPedido = { error: null, ok: null };

export type Extra = { id: number; nombre: string; tipo: string; precio: number };

/** Datos de entrega del domicilio (se piden en la comanda / checkout) */
export type DatosCliente = {
  cliente: string;
  telefono: string;
  /** Hora futura que pidió el cliente ("para las 12", "la 1 y media") */
  horaEntrega: string;
  direccion: string;
  barrio: string;
  referencia: string;
};

/** Cliente del historial cuyos datos ya vienen cargados («Realizar pedido») */
export type ClientePreseteado = {
  cliente: string;
  telefono: string;
  horaEntrega: string | null;
  direccion: string;
  barrio: string | null;
  referencia: string | null;
};

/** Un plato de la comanda: lo armado en el constructor × cuántos van */
type LineaPlato = {
  /** Marca local del renglón para los botones de + / − y quitar */
  clave: number;
  conSopa: boolean;
  proteinaId: number;
  principios: number[];
  ensaladas: number[];
  /** Productos de las categorías propias del cliente que van en el plato */
  propios: number[];
  /** Adicionales del catálogo que van EN el plato (aparecen dentro del
      «PEDIDO n» de la comanda): un id por unidad pedida */
  adicionales: number[];
  sopaId: number | null;
  cantidad: number;
};

const ordenarNumeros = (lista: number[]) => [...lista].sort((x, y) => x - y);

/** ¿Dos selecciones son el mismo plato? (para fusionar en una línea) */
const mismoSet = (a: number[], b: number[]) => {
  if (a.length !== b.length) return false;
  const ordenA = ordenarNumeros(a);
  const ordenB = ordenarNumeros(b);
  return ordenA.every((v, i) => v === ordenB[i]);
};

/** Campo de texto accesible con ícono, usado en los datos del cliente */
function Campo({
  icono,
  name,
  placeholder,
  ariaLabel,
  valor,
  onChange,
  tipo = "text",
  inputMode,
  autoCompletar,
  requerido,
}: {
  icono: ReactNode;
  name: string;
  placeholder: string;
  /** Texto accesible: la píldora-label no tiene contenido de texto */
  ariaLabel: string;
  /** Valor controlado: los datos del cliente viven en un solo estado y
      todos los mounts llegan al FormData con el MISMO valor */
  valor: string;
  onChange: (valor: string) => void;
  tipo?: "text" | "tel";
  inputMode?: "text" | "tel" | "numeric";
  /** Token de autollenado del navegador (tel, street-address…) */
  autoCompletar?: string;
  requerido?: boolean;
}) {
  return (
    <label className="campo-redondo flex items-center gap-2.5 rounded-2xl bg-campo-app px-3.5 py-3 ring-1 ring-borde-app focus-within:ring-2 focus-within:ring-amber-brand/60">
      <span aria-hidden className="shrink-0 text-texto-muted/35">
        {icono}
      </span>
      <input
        name={name}
        type={tipo}
        placeholder={placeholder}
        aria-label={ariaLabel}
        inputMode={inputMode}
        autoComplete={autoCompletar}
        required={requerido}
        maxLength={120}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-base text-texto-app outline-none placeholder:text-texto-muted/25"
      />
    </label>
  );
}

export function FormularioPedido({
  mesa,
  menu,
  extras,
  categorias = [],
  modo = "mesa",
  accion: accionPedido = tomarPedido,
  clientePreseteado = null,
}: {
  mesa: { id: number; nombre: string };
  menu: ItemMenuHoy[];
  extras: Extra[];
  /** Categorías propias del cliente (además de bebidas y adicionales) */
  categorias?: CategoriaPropia[];
  /** "domicilio": siempre para llevar y pide los datos del cliente */
  modo?: "mesa" | "domicilio";
  /** Acción de servidor que guarda el pedido (por defecto, la del mesero) */
  accion?: AccionPedido;
  /** Solo Admin→Domicilios: cliente del historial con sus datos precargados */
  clientePreseteado?: ClientePreseteado | null;
}) {
  const [estado, accion, pendiente] = useActionState<
    EstadoFormularioPedido,
    FormData
  >(accionPedido, SIN_ENVIAR);

  const esDomicilio = modo === "domicilio";

  // ---- Decisión de coincidencias (solo domicilio): el teléfono que escribió
  // ---- ya pertenece a otra persona. El admin elige ficha o «persona nueva».
  const [eleccion, setEleccion] = useState<
    { tipo: "ficha"; id: number } | { tipo: "nueva" } | null
  >(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- una respuesta nueva invalida cualquier elección anterior.
    if (estado.coincidencias) setEleccion(null);
  }, [estado]);
  const hayCoincidencias =
    esDomicilio && (estado.coincidencias?.length ?? 0) > 0;

  // ---- Constructor del plato (se arman de uno en uno) ----
  const [conSopa, setConSopa] = useState(false);
  const [proteina, setProteina] = useState<number | null>(null);
  const [principios, setPrincipios] = useState<number[]>([]);
  const [ensaladas, setEnsaladas] = useState<number[]>([]);
  const [propios, setPropios] = useState<number[]>([]);
  const [sopa, setSopa] = useState<number | null>(null);
  const [cantidadPlato, setCantidadPlato] = useState(1);
  /** Adicionales del catálogo que van EN el plato de la vez, por productoId:
   *  entran al «PEDIDO n» del plato (no al grupo de extras de toda la comanda) */
  const [adicionales, setAdicionales] = useState<Record<number, number>>({});

  // ---- La comanda: 1 a muchos platos + extras de todo el pedido ----
  const [lineas, setLineas] = useState<LineaPlato[]>([]);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [nota, setNota] = useState("");
  const [llevar, setLlevar] = useState(false);
  const [comandaAbierta, setComandaAbierta] = useState(false);
  /** Checkout en domicilio: los datos del cliente viven en la comanda. Con
      «Realizar pedido» del historial, el cliente viene precargado (la página
      manda `key` para remontar el formulario limpio con esos datos). */
  const [datosCliente, setDatosCliente] = useState<DatosCliente>({
    cliente: clientePreseteado?.cliente ?? "",
    telefono: clientePreseteado?.telefono ?? "",
    horaEntrega: clientePreseteado?.horaEntrega ?? "",
    direccion: clientePreseteado?.direccion ?? "",
    barrio: clientePreseteado?.barrio ?? "",
    referencia: clientePreseteado?.referencia ?? "",
  });

  const actualizarCliente = (campo: keyof DatosCliente, valor: string) =>
    setDatosCliente((prev) => ({ ...prev, [campo]: valor }));

  const formRef = useRef<HTMLFormElement>(null);
  /** Panel de la comanda en móvil: al abrirlo, el foco entra a él */
  const modalRef = useRef<HTMLDivElement>(null);
  const siguienteClave = useRef(1);

  useEffect(() => {
    if (comandaAbierta) modalRef.current?.focus();
    // Con la comanda abierta el fondo deja de desplazarse (checkout enfocado)
    document.body.style.overflow = comandaAbierta ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [comandaAbierta]);

  const proteinasMenu = menu.filter((m) => m.tipo === "PROTEINA");
  const principiosMenu = menu.filter((m) => m.tipo === "PRINCIPIO");
  const ensaladasMenu = menu.filter((m) => m.tipo === "ENSALADA");
  const sopasMenu = menu.filter((m) => m.tipo === "SOPA");

  /** Secciones de extras fijas de la casa. Los adicionales NO van aquí:
   *  viajan dentro del plato (sección propia, más abajo); los extras
   *  compartidos del pedido completo son solo las bebidas. */
  const seccionesExtra = [
    {
      tipo: "BEBIDA",
      titulo: "Bebidas",
      sub: "Comparten las mesas del pedido · sumadas al total",
      Icono: CupSoda as LucideIcon,
      clase: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
      items: extras.filter((e) => e.tipo === "BEBIDA"),
    },
  ];
  /** Adicionales del catálogo que entran en el plato bajo construcción */
  const adicionalesMenu = extras.filter((e) => e.tipo === "ADICIONAL");

  /** Secciones del plato para las categorías propias del cliente */
  const seccionesPropias = categorias.map((c) => ({
    tipo: c.nombre,
    Icono: iconoDeCategoria(c.icono),
    clase: claseDeCategoria(c.nombre),
    items: menu.filter((m) => m.tipo === c.nombre),
  })).filter((s) => s.items.length > 0);

  const porItemId = new Map(menu.map((m) => [m.itemId, m]));
  const porProductoId = new Map(extras.map((e) => [e.id, e]));

  const estaParaLlevar = esDomicilio || llevar;

  const totalExtras = Object.entries(cantidades).reduce(
    (suma, [id, n]) => suma + (porProductoId.get(Number(id))?.precio ?? 0) * n,
    0,
  );
  /** Unidades de bebida compartidas: el grupo 0 de la comanda (los
   *  adicionales viajan dentro de cada plato) */
  const totalBebidas = Object.values(cantidades).reduce((suma, n) => suma + n, 0);

  /** Costo de los adicionales que van dentro de un plato (por unidad del
   *  plato: la lista trae un id por unidad pedida) */
  const costoAdicionalesDe = (lista: number[]) =>
    lista.reduce((suma, id) => suma + (porProductoId.get(id)?.precio ?? 0), 0);

  // ¿Hoy hay alguna proteína con precio especial? Con ella en el menú no
  // tiene sentido presumir los $ de la semana corriente en sopa/bandeja.
  const hayEspecialHoy = proteinasMenu.some((m) => m.precioPropio > 0);

  /** Precio del plato: la proteína con precio especial del día (los
   *  especiales del domingo: asados, gallinas, pescados) manda sobre el
   *  almuerzo corriente; para llevar solo el COMPLETO suma el icopor (la
   *  bandeja lleva su empaque ya en el precio) — y los adicionales del
   *  plato se cobran aparte con su precio de catálogo. */
  const precioLinea = (l: LineaPlato) => {
    const propio = porItemId.get(l.proteinaId)?.precioPropio ?? 0;
    const base =
      propio > 0
        ? precioEspecialDelDia(propio, l.conSopa, estaParaLlevar)
        : precioAlmuerzo(l.conSopa, estaParaLlevar);
    return base + costoAdicionalesDe(l.adicionales ?? []);
  };
  /** Precio que muestra cada píldora de sopa/bandeja: con una proteína
      especial ya elegida es su precio (el icopor de llevar solo suma a la
      opción CON sopa); con especiales en el menú pero sin elegir, no se
      presume el corriente; si no, el del almuerzo corriente. */
  const precioPildora = (conSopaOpcion: boolean): string => {
    const propio =
      proteina !== null ? (porItemId.get(proteina)?.precioPropio ?? 0) : 0;
    if (propio > 0) {
      return formatCOP(
        precioEspecialDelDia(propio, conSopaOpcion, estaParaLlevar),
      );
    }
    if (hayEspecialHoy) return "Especial · según la proteína";
    return formatCOP(precioAlmuerzo(conSopaOpcion, estaParaLlevar));
  };
  const totalPlatos = lineas.reduce((suma, l) => suma + l.cantidad, 0);
  const totalComanda =
    lineas.reduce((suma, l) => suma + precioLinea(l) * l.cantidad, 0) + totalExtras;

  useEffect(() => {
    if (!esDomicilio) return;
    const tieneCliente = datosCliente.cliente.trim().length > 0;
    const tienePedido = totalPlatos > 0 || totalBebidas > 0;
    actualizarProgresoDomicilio(!tieneCliente ? 1 : tienePedido ? 3 : 2);
  }, [esDomicilio, datosCliente.cliente, totalPlatos, totalBebidas]);

  // Se elige una proteína sí o sí: el almuerzo se cobra en esa línea
  const nombreProteina =
    proteina !== null ? (porItemId.get(proteina)?.nombre ?? "—") : null;
  const nombreSopa = sopa !== null ? (porItemId.get(sopa)?.nombre ?? null) : null;
  const nombresPrincipios = principios
    .map((id) => porItemId.get(id)?.nombre ?? "")
    .filter(Boolean);
  const nombresEnsaladas = ensaladas
    .map((id) => porItemId.get(id)?.nombre ?? "")
    .filter(Boolean);
  const nombresPropios = propios
    .map((id) => porItemId.get(id)?.nombre ?? "")
    .filter(Boolean);
  /** Adicionales del plato de la vez, con su cantidad si piden más de uno */
  const nombresAdicionales = Object.entries(adicionales)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => {
      const nombre = porProductoId.get(Number(id))?.nombre ?? "";
      return nombre ? (n > 1 ? `${nombre} ×${n}` : nombre) : "";
    })
    .filter(Boolean);

  /** Resumen del plato en construcción, para la barra de abajo */
  const resumenPlato =
    proteina === null
      ? null
      : `${conSopa ? "Con sopa" : "Bandeja"} · ${nombreProteina ?? ""}${
          conSopa
            ? nombreSopa
              ? ` · ${nombreSopa}`
              : " · sopa del día"
            : ""
        }${
          nombresPrincipios.length ||
          nombresEnsaladas.length ||
          nombresPropios.length ||
          nombresAdicionales.length
            ? ` · ${[
                ...nombresPrincipios,
                ...nombresEnsaladas,
                ...nombresPropios,
                ...nombresAdicionales,
              ].join(", ")}`
            : ""
        }`;

  const datos = JSON.stringify({
    // La carga nueva: 1 a muchos platos, cada uno con su configuración
    lineas: lineas.map((l) => ({
      conSopa: l.conSopa,
      proteinaId: l.proteinaId,
      principios: l.principios,
      ensaladas: l.ensaladas,
      propios: l.propios,
      adicionales: l.adicionales ?? [],
      sopaId: l.sopaId,
      cantidad: l.cantidad,
    })),
    // Extras compartidos (bebidas): un id por unidad, igual que siempre
    extras: Object.entries(cantidades).flatMap(([id, n]) =>
      Array.from({ length: n }, () => Number(id)),
    ),
    llevar: estaParaLlevar,
  });

  /** Lo que acompañó al plato (principios, ensaladas, propios y sopa) */
  const porcionesDe = (l: LineaPlato) => {
    const nombres = [
      ...l.principios.map((id) => porItemId.get(id)?.nombre ?? "").filter(Boolean),
      ...l.ensaladas.map((id) => porItemId.get(id)?.nombre ?? "").filter(Boolean),
      ...l.propios.map((id) => porItemId.get(id)?.nombre ?? "").filter(Boolean),
    ];
    if (l.conSopa) {
      nombres.push(
        l.sopaId !== null ? (porItemId.get(l.sopaId)?.nombre ?? "Sopa") : "Sopa del día",
      );
    }
    return nombres.join(" · ");
  };

  /** Los adicionales pegados a un plato de la comanda, con su cantidad */
  const adicionalesDe = (l: LineaPlato) => {
    const conteo = new Map<number, number>();
    for (const id of l.adicionales ?? []) {
      conteo.set(id, (conteo.get(id) ?? 0) + 1);
    }
    return (
      [...conteo]
        .map(([id, n]) => {
          const nombre = porProductoId.get(id)?.nombre ?? "";
          return nombre ? (n > 1 ? `${nombre} ×${n}` : nombre) : "";
        })
        .filter(Boolean)
        .join(", ") || null
    );
  };

  const añadirPlato = () => {
    if (proteina === null) return;
    const clave = siguienteClave.current++;
    // Los adicionales guardados como chip (2 huevos = dos entradas) viajan
    // dentro del plato: el ticket los imprimirá en su «PEDIDO n»
    const adicionalesDelPlato = Object.entries(adicionales).flatMap(([id, n]) =>
      Array.from({ length: n }, () => Number(id)),
    );
    setLineas((previas) => {
      const nueva = {
        conSopa,
        proteinaId: proteina,
        principios,
        ensaladas,
        propios,
        adicionales: adicionalesDelPlato,
        sopaId: conSopa ? sopa : null,
        cantidad: cantidadPlato,
      };
      // El mismo plato dos veces (con sus mismos adicionales) suma peso en
      // el renglón que ya estaba
      const index = previas.findIndex(
        (l) =>
          l.conSopa === nueva.conSopa &&
          l.proteinaId === nueva.proteinaId &&
          (l.sopaId ?? null) === (nueva.sopaId ?? null) &&
          mismoSet(l.principios, nueva.principios) &&
          mismoSet(l.ensaladas, nueva.ensaladas) &&
          mismoSet(l.propios ?? [], nueva.propios) &&
          mismoSet(l.adicionales ?? [], nueva.adicionales),
      );
      if (index >= 0) {
        const copia = [...previas];
        copia[index] = { ...copia[index], cantidad: copia[index].cantidad + cantidadPlato };
        return copia;
      }
      return [...previas, { clave, ...nueva }];
    });
    setProteina(null);
    setPrincipios([]);
    setEnsaladas([]);
    setPropios([]);
    setSopa(null);
    setAdicionales({});
    setCantidadPlato(1);
  };

  const ajustarLinea = (clave: number, delta: number) =>
    setLineas((previas) =>
      previas
        .map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    );

  const quitarLinea = (clave: number) =>
    setLineas((previas) => previas.filter((l) => l.clave !== clave));

  const quitarExtra = (id: number) =>
    setCantidades((prev) => {
      const copia = { ...prev };
      delete copia[id];
      return copia;
    });

  const vaciarComanda = () => {
    setLineas([]);
    setCantidades({});
    setPropios([]);
    setAdicionales({});
  };

  const aceptarPrincipio = (itemId: number) => {
    setPrincipios((prev) =>
      prev.includes(itemId) ? prev.filter((p) => p !== itemId) : [...prev, itemId],
    );
  };
  const aceptarEnsalada = (itemId: number) => {
    setEnsaladas((prev) =>
      prev.includes(itemId) ? prev.filter((p) => p !== itemId) : [...prev, itemId],
    );
  };
  const aceptarPropio = (itemId: number) => {
    setPropios((prev) =>
      prev.includes(itemId) ? prev.filter((p) => p !== itemId) : [...prev, itemId],
    );
  };
  const pedirExtra = (id: number, delta: number) => {
    setCantidades((prev) => {
      const n = (prev[id] ?? 0) + delta;
      const copia = { ...prev };
      if (n <= 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });
  };

  /** Adicional para el plato de la vez (más/menos unidades del mismo) */
  const pedirAdicional = (id: number, delta: number) => {
    setAdicionales((prev) => {
      const n = (prev[id] ?? 0) + delta;
      const copia = { ...prev };
      if (n <= 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });
  };

  /** El panel de la comanda: escritorio (fijo a la derecha) y móvil (modal).
      alCerrar: el modal móvil pasa su botón de cierre para que viva DENTRO
      del encabezado (antes flotaba encima del botón Vaciar). */
  const PanelComanda = ({ alCerrar }: { alCerrar?: () => void } = {}) => (
    <div>
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20"
        >
          <ClipboardList className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg leading-none text-texto-app">Comanda</p>
          <p aria-live="polite" className="mt-1 text-[11px] text-texto-muted/45">
            {totalPlatos === 0
              ? totalBebidas > 0
                ? `Sin almuerzo · ${totalBebidas} ${totalBebidas === 1 ? "bebida" : "bebidas"} en la comanda`
                : "Vacía · toca la proteína para armar el plato"
              : `${totalPlatos} ${totalPlatos === 1 ? "plato" : "platos"} en la comanda`}
          </p>
        </div>
        <button
          type="button"
          onClick={vaciarComanda}
          disabled={pendiente || (totalPlatos === 0 && totalBebidas === 0)}
          aria-label="Vaciar la comanda"
          title="Vaciar la comanda"
          className="rounded-xl bg-campo-app p-2 text-texto-muted/50 ring-1 ring-borde-app transition hover:text-danger-text disabled:opacity-40"
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </button>
        {alCerrar ? (
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar la comanda"
            title="Cerrar la comanda"
            className="rounded-xl bg-campo-app p-2 text-texto-muted/60 ring-1 ring-borde-app transition hover:text-danger-text"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <ul className="mt-3 space-y-2">
        {lineas.map((l) => {
          const nombre = porItemId.get(l.proteinaId)?.nombre ?? "—";
          const porciones = porcionesDe(l);
          return (
            <li key={l.clave} className="rounded-2xl bg-campo-app p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-texto-app">
                    {l.cantidad}× {nombre}
                  </p>
                  <p className="truncate text-[11px] text-texto-muted/45">
                    {l.conSopa ? "con sopa" : "bandeja"}
                    {porciones ? ` · ${porciones}` : ""}
                  </p>
                  {adicionalesDe(l) ? (
                    <p className="truncate text-[11px] font-bold text-orange-brand/95">
                      + {adicionalesDe(l)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => quitarLinea(l.clave)}
                  aria-label={`Quitar ${nombre} de la comanda`}
                  className="shrink-0 rounded-lg p-1.5 text-texto-muted/35 transition hover:text-danger-text"
                >
                  <Trash2 aria-hidden className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-panel-app ring-1 ring-borde-app">
                  <button
                    type="button"
                    onClick={() => ajustarLinea(l.clave, -1)}
                    aria-label={`Una menos de ${nombre}`}
                    className="flex h-9 w-9 items-center justify-center text-texto-muted/60 transition hover:text-danger-text"
                  >
                    <Minus aria-hidden className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums text-texto-app">
                    {l.cantidad}
                  </span>
                  <button
                    type="button"
                    onClick={() => ajustarLinea(l.clave, 1)}
                    aria-label={`Una más de ${nombre}`}
                    className="flex h-9 w-9 items-center justify-center text-texto-muted/60 transition hover:text-amber-brand"
                  >
                    <Plus aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="ml-auto text-sm font-bold tabular-nums text-texto-app">
                  {formatCOP(precioLinea(l) * l.cantidad)}
                </p>
              </div>
            </li>
          );
        })}
        {Object.entries(cantidades)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => {
            const extra = porProductoId.get(Number(id));
            if (!extra) return null;
            return (
              <li key={`E${id}`} className="rounded-2xl bg-campo-app p-3">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-texto-app">
                    {n}× {extra.nombre}
                  </p>
                  <button
                    type="button"
                    onClick={() => quitarExtra(extra.id)}
                    aria-label={`Quitar todo el ${extra.nombre}`}
                    className="shrink-0 rounded-lg p-1.5 text-texto-muted/35 transition hover:text-danger-text"
                  >
                    <Trash2 aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex items-center rounded-xl bg-panel-app ring-1 ring-borde-app">
                    <button
                      type="button"
                      onClick={() => pedirExtra(extra.id, -1)}
                      aria-label={`Una menos de ${extra.nombre}`}
                      className="flex h-9 w-9 items-center justify-center text-texto-muted/60 transition hover:text-danger-text"
                    >
                      <Minus aria-hidden className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-7 text-center text-sm font-bold tabular-nums text-texto-app">
                      {n}
                    </span>
                    <button
                      type="button"
                      onClick={() => pedirExtra(extra.id, 1)}
                      aria-label={`Una más de ${extra.nombre}`}
                      className="flex h-9 w-9 items-center justify-center text-texto-muted/60 transition hover:text-amber-brand"
                    >
                      <Plus aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="ml-auto text-sm font-bold tabular-nums text-texto-app">
                    {formatCOP(extra.precio * n)}
                  </p>
                </div>
              </li>
            );
          })}
      </ul>

      {totalPlatos === 0 && totalBebidas === 0 ? (
        <p className="mt-3 rounded-2xl bg-campo-app px-3.5 py-3 text-sm text-texto-muted/45">
          Vacía: basta una sola cosa para la comanda — toca la proteína (el
          especial del dominical vale solo, sin principios ni ensalada) o pone
          una bebida y envía.
        </p>
      ) : null}

      {/* Checkout en domicilio: los datos del cliente se piden aquí, como el
          carrito del referencia (en móvil el panel es el modal inferior). Los
          campos van controlados: el panel se llama desde el aside escritorio
          y desde el modal móvil, y ambos llegan al FormData igual. */}
      {esDomicilio ? (
        <div className="mt-3.5">
          <TituloSeccion
            Icono={MapPin}
            clase="bg-info-text/10 text-info-text ring-1 ring-info-text/20"
            titulo="Cliente"
            sub="Nombre sí o sí · teléfono y dirección opcionales"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Campo
                icono={<User className="h-4 w-4" />}
                name="cliente"
                ariaLabel="Nombre del cliente"
                placeholder="Nombre del cliente…"
                valor={datosCliente.cliente}
                onChange={(valor) => actualizarCliente("cliente", valor)}
                requerido
              />
            </div>
            <Campo
              icono={<Phone className="h-4 w-4" />}
              name="telefono"
              ariaLabel="Teléfono del cliente"
              placeholder="Teléfono (opcional)…"
              tipo="tel"
              inputMode="tel"
              autoCompletar="tel"
              valor={datosCliente.telefono}
              onChange={(valor) => actualizarCliente("telefono", valor)}
            />
            <Campo
              icono={<Clock className="h-4 w-4" />}
              name="horaEntrega"
              ariaLabel="Hora de entrega"
              placeholder="Para las 12, la 1 y media…"
              valor={datosCliente.horaEntrega}
              onChange={(valor) => actualizarCliente("horaEntrega", valor)}
            />
            <Campo
              icono={<MapPin className="h-4 w-4" />}
              name="barrio"
              ariaLabel="Barrio de la entrega"
              placeholder="Barrio…"
              autoCompletar="address-level3"
              valor={datosCliente.barrio}
              onChange={(valor) => actualizarCliente("barrio", valor)}
            />
            <Campo
              icono={<StickyNote className="h-4 w-4" />}
              name="referencia"
              ariaLabel="Referencia de la casa"
              placeholder="Referencia: portón azul…"
              valor={datosCliente.referencia}
              onChange={(valor) => actualizarCliente("referencia", valor)}
            />
            <div className="col-span-2">
              <Campo
                icono={<MapPin className="h-4 w-4" />}
                name="direccion"
                ariaLabel="Dirección de entrega"
                placeholder="Dirección de entrega (opcional)…"
                autoCompletar="street-address"
                valor={datosCliente.direccion}
                onChange={(valor) => actualizarCliente("direccion", valor)}
              />
            </div>
          </div>
        </div>
      ) : null}

      {esDomicilio ? (
        <p className="mt-3 rounded-2xl bg-campo-app px-3.5 py-2.5 text-[11px] font-bold text-texto-muted/60">
          Domicilio · para llevar · se cobra en la entrega
        </p>
      ) : (
        /* El canal se elige arriba (sección «¿Cómo va el pedido?»); aquí solo
           recordamos cuál está activo mientras armamos la comanda. */
        <p className="mt-3.5 flex items-center gap-2 rounded-2xl bg-campo-app px-3.5 py-2.5 text-[11px] font-bold text-texto-muted/60">
          {llevar ? (
            <>
              <ShoppingBag aria-hidden className="h-3.5 w-3.5 shrink-0 text-orange-brand" />
              Para llevar · + {formatCOP(PRECIO_ICOPOR)} de icopor con sopa ·
              bandeja con su empaque incluido
            </>
          ) : (
            <>
              <UtensilsCrossed aria-hidden className="h-3.5 w-3.5 shrink-0 text-success-text" />
              En la mesa · sin recargo, se sirve en la mesa
            </>
          )}
        </p>
      )}

      <label className="campo-redondo mt-3 flex items-center gap-2.5 rounded-2xl bg-campo-app px-3.5 py-3.5 ring-1 ring-borde-app focus-within:ring-2 focus-within:ring-amber-brand/60">
        <StickyNote aria-hidden className="h-4 w-4 shrink-0 text-texto-muted/35" />
        <input
          name="observaciones"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          maxLength={140}
          aria-label="Nota para la cocina"
          autoComplete="off"
          placeholder="Sin arroz, sin cebolla…"
          className="w-full bg-transparent text-base text-texto-app outline-none placeholder:text-texto-muted/25"
        />
      </label>

      <div className="mt-3.5 flex items-baseline justify-between border-t border-dashed border-borde-app pt-3">
        <span className="text-sm font-bold text-texto-muted/70">Total</span>
        <p aria-live="polite" className="font-display text-2xl tabular-nums text-texto-app">
          {formatCOP(totalComanda)}
        </p>
      </div>

      <button
        type="submit"
        disabled={pendiente || (totalPlatos === 0 && totalBebidas === 0)}
        className={
          "mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-md transition active:scale-95 " +
          (pendiente || (totalPlatos === 0 && totalBebidas === 0)
            ? "cursor-not-allowed bg-brown-800/50 text-cream-50/60"
            : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-texto-app")
        }
      >
        <Send aria-hidden className="h-4.5 w-4.5" />
        {pendiente ? "Enviando…" : esDomicilio ? "Crear domicilio" : "Enviar a cocina"}
      </button>
    </div>
  );

  return (
    <form
      ref={formRef}
      action={accion}
      className="mx-auto w-full max-w-xl px-4 pt-4 pb-44 sm:max-w-2xl lg:max-w-6xl"
    >
      <input type="hidden" name="mesaId" value={mesa.id} />
      <input type="hidden" name="datos" value={datos} />

      {estado.error ? (
        <p
          aria-live="polite"
          className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger-text ring-1 ring-danger/30"
        >
          {estado.error}
        </p>
      ) : null}

      {/* La ficha que el admin confirmó frente al aviso de coincidencias */}
      <input
        type="hidden"
        name="clienteIdElegido"
        value={eleccion?.tipo === "ficha" ? eleccion.id : ""}
      />
      {eleccion?.tipo === "nueva" ? (
        <input type="hidden" name="clienteNuevo" value="1" />
      ) : null}

      {hayCoincidencias && estado.coincidencias ? (
        <section
          aria-live="polite"
          className="mb-3 rounded-2xl bg-warning/10 px-4 py-3 ring-1 ring-warning/30"
        >
          <p className="text-sm font-bold text-warning-text">
            El teléfono que escribiste ya está guardado con otro nombre
          </p>
          <p className="mt-1 text-xs text-warning-text/80">
            ¿Quién es la persona de este pedido? Si el número lo comparte familia
            o amigos, registra una ficha aparte; los fiados van por ficha.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {estado.coincidencias.map((cada) => (
              <button
                key={cada.id}
                type="button"
                onClick={() => setEleccion({ tipo: "ficha", id: cada.id })}
                aria-pressed={eleccion?.tipo === "ficha" && eleccion.id === cada.id}
                className={
                  "rounded-xl px-3 py-2 text-left text-sm ring-1 transition " +
                  (eleccion?.tipo === "ficha" && eleccion.id === cada.id
                    ? "bg-amber-brand/20 ring-amber-brand/50"
                    : "bg-fondo-app ring-borde-app hover:ring-amber-brand/40")
                }
              >
                <span className="font-bold text-texto-app">{cada.nombre}</span>
                <span className="block text-[11px] text-texto-muted/60">
                  {cada.telefono || "Sin teléfono"}
                  {cada.direccion ? ` · ${cada.direccion}` : ""}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setEleccion({ tipo: "nueva" })}
              aria-pressed={eleccion?.tipo === "nueva"}
              className={
                "rounded-xl px-3 py-2 text-left text-sm ring-1 transition " +
                (eleccion?.tipo === "nueva"
                  ? "bg-amber-brand/20 ring-amber-brand/50"
                  : "bg-fondo-app ring-borde-app hover:ring-amber-brand/40")
              }
            >
              <span className="font-bold text-texto-app">Persona nueva</span>
              <span className="block text-[11px] text-texto-muted/60">
                Crea una ficha aparte con este número
              </span>
            </button>
          </div>
          <p className="mt-2 text-[11px] font-bold text-warning-text">
            Elige una opción y vuelve a pulsar «Crear domicilio».
          </p>
        </section>
      ) : null}

      {/* Comida a la izquierda; la comanda vive a la derecha en escritorio
          y en un modal en móvil (botón «Comanda» de la barra de abajo) */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-4">
        <div>
          {/* Canal: en domicilio siempre va para llevar */}
          {esDomicilio ? (
            <section className="rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:rounded-[2rem] sm:p-4">
              <TituloSeccion
                Icono={ShoppingBag}
                clase="bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20"
                titulo="Domicilio · para llevar"
                sub={`Se cobra en la entrega · icopor de ${formatCOP(PRECIO_ICOPOR)} solo con sopa`}
              />
            </section>
          ) : (
            /* Canal del salón: el mesero decide si el pedido va para la mesa
               o para llevar. Al elegir llevar, el icopor entra en el precio
               de CADA almuerzo (la píldora de sopa/bandeja lo muestra). */
            <section className="rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:rounded-[2rem] sm:p-4">
              <TituloSeccion
                Icono={UtensilsCrossed}
                clase="bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20"
                titulo="¿Cómo va el pedido?"
                sub="Se aplica a todos los platos de la comanda"
              />
              <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-campo-app p-1.5 ring-1 ring-borde-app">
                {(
                  [
                    { ok: false, txt: "En la mesa", Icono: UtensilsCrossed },
                    { ok: true, txt: "Para llevar", Icono: ShoppingBag },
                  ] as const
                ).map(({ ok, txt, Icono }) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => setLlevar(ok)}
                    aria-pressed={llevar === ok}
                    className={
                      "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 font-display text-md transition active:scale-95 sm:py-2.5 " +
                      (llevar === ok
                        ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
                        : "text-texto-muted/70 hover:bg-panel-hover")
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Icono aria-hidden className="h-4 w-4" /> {txt}
                    </span>
                    <span className="text-[10px] font-bold normal-case">
                      {ok
                        ? `icopor ${formatCOP(PRECIO_ICOPOR)} solo con sopa`
                        : "se sirve en la mesa"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 1. ¿El plato lleva sopa? (por cada plato) */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Soup}
              clase="bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20"
              titulo="¿El almuerzo lleva sopa?"
              sub="La bandeja es el mismo almuerzo sin sopa"
            />
            <PildoraModalidad
              valor={conSopa}
              onElegir={setConSopa}
              opciones={[
                {
                  valor: true,
                  texto: "Con sopa",
                  detalle: precioPildora(true),
                  Icono: Soup,
                },
                {
                  valor: false,
                  texto: "Bandeja (sin sopa)",
                  detalle: precioPildora(false),
                  Icono: Soup,
                },
              ]}
            />
          </section>

          {/* 2. Principios: se piden antes de la proteína */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Wheat}
              clase="bg-success/10 text-success-text ring-1 ring-success/20"
              titulo="Principios"
              sub="Los que pidan · frijoles, papa, pasta…"
            />
            {principiosMenu.length === 0 ? (
              <NotaVacia texto="Hoy no hay principios…" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {principiosMenu.map((item) => (
                  <FichaMenu
                    key={item.itemId}
                    item={item}
                    elegido={principios.includes(item.itemId)}
                    onClick={() => aceptarPrincipio(item.itemId)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 3. Proteína: el plato se cobra aquí — almuerzo corriente o el
                 precio especial del ítem (domingos de asados) */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Drumstick}
              clase="bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20"
              titulo="Proteína"
              sub="Elige una · el especial del domingo muestra su precio en la ficha"
            />
            {proteinasMenu.length === 0 ? (
              <NotaVacia texto="Hoy no hay proteína en el menú…" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {proteinasMenu.map((item) => (
                  <FichaMenu
                    key={item.itemId}
                    item={item}
                    precioVisible
                    elegido={proteina === item.itemId}
                    onClick={() => setProteina(item.itemId)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 4. Ensaladas (apartado especial) */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Salad}
              clase="bg-menta-text/10 text-menta-text ring-1 ring-menta-text/20"
              titulo="Ensalada"
              sub="Elige una o varias · incluida en la bandeja"
            />
            {ensaladasMenu.length === 0 ? (
              <NotaVacia texto="Hoy no hay ensalada en el menú…" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {ensaladasMenu.map((item) => (
                  <FichaMenu
                    key={item.itemId}
                    item={item}
                    elegido={ensaladas.includes(item.itemId)}
                    onClick={() => aceptarEnsalada(item.itemId)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 5. Sopa del día (solo si lleva) */}
          {conSopa ? (
            <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
              <TituloSeccion
                Icono={Soup}
                clase="bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20"
                titulo="Sopa del día"
                sub="Opcional · si no eliges, la cocina pone la del día"
              />
              {sopasMenu.length === 0 ? (
                <NotaVacia texto="Hoy no hay sopa del día…" />
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {sopasMenu.map((item) => (
                    <FichaMenu
                      key={item.itemId}
                      item={item}
                      elegido={sopa === item.itemId}
                      onClick={() => setSopa(item.itemId)}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {/* 6. Las categorías propias del cliente: viajan en el plato,
              igual que las ensaladas (porción incluida, sin precio) */}
          {seccionesPropias.map((s) => (
            <section
              key={s.tipo}
              className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4"
            >
              <TituloSeccion
                Icono={s.Icono}
                clase={s.clase}
                titulo={s.tipo}
                sub="Elige una o varias · entran en el almuerzo"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {s.items.map((item) => (
                  <FichaMenu
                    key={item.itemId}
                    item={item}
                    elegido={propios.includes(item.itemId)}
                    onClick={() => aceptarPropio(item.itemId)}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* 7. Adicionales de la casa: entran en el plato de la vez y se
              cobran con su precio. En la comanda se imprimen dentro del
              «PEDIDO n» del plato, no en el grupo de extras. */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Star}
              clase="bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20"
              titulo="Adicionales"
              sub="Huevo, carne extra… · entran en el plato de la vez"
            />
            {adicionalesMenu.length === 0 ? (
              <NotaVacia texto="Hoy no hay adicionales…" />
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {adicionalesMenu.map((e) => (
                  <ChipCantidad
                    key={e.id}
                    etiqueta={e.nombre}
                    precio={e.precio}
                    cantidad={adicionales[e.id] ?? 0}
                    onSumar={() => pedirAdicional(e.id, 1)}
                    onRestar={() => pedirAdicional(e.id, -1)}
                    ariaQuitar={`Quitar ${e.nombre} del plato`}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 8. Extras compartidos del pedido: las bebidas */}
          {seccionesExtra.map((s) => (
            <section
              key={s.tipo}
              className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4"
            >
              <TituloSeccion
                Icono={s.Icono}
                clase={s.clase}
                titulo={s.titulo}
                sub={s.sub}
              />
              {s.items.length === 0 ? (
                <NotaVacia texto={`Hoy no hay ${s.titulo.toLowerCase()}…`} />
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.items.map((e) => (
                    <ChipCantidad
                      key={e.id}
                      etiqueta={e.nombre}
                      precio={e.precio}
                      cantidad={cantidades[e.id] ?? 0}
                      onSumar={() => pedirExtra(e.id, 1)}
                      onRestar={() => pedirExtra(e.id, -1)}
                      ariaQuitar={`Quitar ${e.nombre}`}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Comanda: fija en escritorio, modal en móvil */}
        <aside className="hidden rounded-[2rem] bg-panel-app p-4 ring-1 ring-borde-app shadow-2xl lg:sticky lg:top-4 lg:block">
          {PanelComanda()}
        </aside>
      </div>

      {/* Barra fija: añadir el plato armado · en móvil abre la comanda.
          En escritorio se alinea a la columna de contenido (pl-64 del shell):
          centrarla sobre el viewport la descolocaba y pisaba «Cerrar sesión»,
          así que en lg la pastilla se compacta (w-fit) y se centra sobre esa
          columna en vez de estirarse. Solo la pastilla oscura captura clics */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:pl-64">
        <div className="mx-auto w-full max-w-xl px-3 barra-seguro sm:max-w-2xl lg:max-w-6xl">
          <div className="pointer-events-auto mx-auto flex w-full items-center gap-2 rounded-[1.75rem] bg-glass-app px-3 py-3 shadow-flotante ring-1 ring-borde-app backdrop-blur sm:gap-2.5 sm:px-4 lg:w-fit lg:max-w-3xl">
            <p
              aria-live="polite"
              className="hidden min-w-0 flex-1 truncate text-sm font-bold text-texto-app sm:block"
            >
              {resumenPlato ?? "Falta la proteína del nuevo plato"}
            </p>
            <div className="flex shrink-0 items-center rounded-2xl bg-campo-app ring-1 ring-borde-app">
              <button
                type="button"
                onClick={() => setCantidadPlato((n) => Math.max(1, n - 1))}
                disabled={cantidadPlato <= 1}
                aria-label="Un plato menos"
                className="flex h-9 w-9 items-center justify-center text-texto-muted/60 transition hover:text-amber-brand disabled:opacity-30"
              >
                <Minus aria-hidden className="h-4 w-4" />
              </button>
              <span className="w-7 text-center text-sm font-bold tabular-nums text-texto-app sm:w-8">
                {cantidadPlato}
              </span>
              <button
                type="button"
                onClick={() => setCantidadPlato((n) => Math.min(50, n + 1))}
                aria-label="Un plato más"
                className="flex h-9 w-9 items-center justify-center text-texto-muted/60 transition hover:text-amber-brand"
              >
                <Plus aria-hidden className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={añadirPlato}
              disabled={proteina === null || pendiente}
              title={proteina === null ? "Falta la proteína" : undefined}
              className={
                "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl px-3 py-2.5 font-display text-md transition active:scale-95 sm:flex-none sm:shrink-0 sm:gap-1.5 sm:px-4 " +
                (proteina === null || pendiente
                  ? "cursor-not-allowed bg-campo-app text-texto-muted/60"
                  : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-texto-app")
              }
            >
              <Plus aria-hidden className="h-4.5 w-4.5" />
              Añadir
            </button>
            <button
              type="button"
              onClick={() => setComandaAbierta(true)}
              aria-label={`Abrir la comanda: ${totalPlatos} platos, total ${formatCOP(totalComanda)}`}
              className="flex shrink-0 flex-col items-center rounded-2xl bg-panel-app px-2.5 py-2 ring-1 ring-borde-app transition hover:bg-panel-hover lg:hidden"
            >
              <span className="flex items-center gap-1.5">
                <ClipboardList aria-hidden className="h-4.5 w-4.5 text-amber-brand" />
                <span className="font-display text-md text-texto-app">Comanda</span>
                {totalPlatos > 0 ? (
                  <span className="rounded-full bg-amber-brand px-1.5 text-[10px] font-bold tabular-nums text-brown-950">
                    {totalPlatos}
                  </span>
                ) : null}
              </span>
              {totalPlatos > 0 ? (
                <span className="text-[10px] font-bold tabular-nums text-texto-muted/70">
                  {formatCOP(totalComanda)}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </div>

      {/* Comanda como modal en móvil */}
      {comandaAbierta ? (
        <div
          ref={modalRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Comanda del pedido"
          className="animar-aparecer fixed inset-0 z-50 flex items-end justify-center bg-glass-app p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm [overscroll-behavior:contain] sm:items-center sm:pb-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setComandaAbierta(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setComandaAbierta(false);
          }}
        >
          <div className="animar-subir max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-glass-app p-4 shadow-pop ring-1 ring-borde-app sm:p-5">
            {PanelComanda({ alCerrar: () => setComandaAbierta(false) })}
          </div>
        </div>
      ) : null}
    </form>
  );
}
