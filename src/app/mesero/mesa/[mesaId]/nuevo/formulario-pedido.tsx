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
import { PRECIO_ICOPOR, precioAlmuerzo } from "@/lib/precios";
import type { ItemMenuHoy } from "@/lib/pedido";
import { tomarPedido } from "@/app/mesero/actions";

export type EstadoFormularioPedido = { error: string | null; ok: string | null };

/** Acción de servidor que guarda el pedido (mesero o domicilio) */
export type AccionPedido = (
  previa: EstadoFormularioPedido,
  datos: FormData,
) => Promise<EstadoFormularioPedido>;

const SIN_ENVIAR: EstadoFormularioPedido = { error: null, ok: null };

export type Extra = { id: number; nombre: string; tipo: string; precio: number };

/** Datos de entrega del domicilio (se piden en la comanda / checkout) */
type DatosCliente = {
  cliente: string;
  telefono: string;
  /** Hora futura que pidió el cliente ("para las 12", "la 1 y media") */
  horaEntrega: string;
  direccion: string;
  barrio: string;
  referencia: string;
};

/** Un plato de la comanda: lo armado en el constructor × cuántos van */
type LineaPlato = {
  /** Marca local del renglón para los botones de + / − y quitar */
  clave: number;
  conSopa: boolean;
  proteinaId: number;
  principios: number[];
  ensaladas: number[];
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

/** Encabezado de cada sección, con ícono en píldora de color */
function TituloSeccion({
  Icono,
  clase,
  titulo,
  sub,
}: {
  Icono: LucideIcon;
  clase: string;
  titulo: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className={
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " + clase
        }
      >
        <Icono className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
          {titulo}
        </p>
        <p className="text-[11px] text-texto-muted/35">{sub}</p>
      </div>
    </div>
  );
}

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

/** Aviso hundido para las secciones en las que hoy no hay nada */
function NotaVacia({ texto }: { texto: string }) {
  return (
    <p className="mt-3 rounded-2xl bg-campo-app px-3.5 py-3 text-sm text-texto-muted/45">
      {texto}
    </p>
  );
}

const ICONO_TIPO: Record<string, LucideIcon> = {
  PROTEINA: Drumstick,
  PRINCIPIO: Wheat,
  ENSALADA: Salad,
  SOPA: Soup,
  BEBIDA: CupSoda,
  ADICIONAL: Star,
};

export function FormularioPedido({
  mesa,
  menu,
  extras,
  modo = "mesa",
  accion: accionPedido = tomarPedido,
}: {
  mesa: { id: number; nombre: string };
  menu: ItemMenuHoy[];
  extras: Extra[];
  /** "domicilio": siempre para llevar y pide los datos del cliente */
  modo?: "mesa" | "domicilio";
  /** Acción de servidor que guarda el pedido (por defecto, la del mesero) */
  accion?: AccionPedido;
}) {
  const [estado, accion, pendiente] = useActionState<
    EstadoFormularioPedido,
    FormData
  >(accionPedido, SIN_ENVIAR);

  const esDomicilio = modo === "domicilio";

  // ---- Constructor del plato (se arman de uno en uno) ----
  const [conSopa, setConSopa] = useState(true);
  const [proteina, setProteina] = useState<number | null>(null);
  const [principios, setPrincipios] = useState<number[]>([]);
  const [ensaladas, setEnsaladas] = useState<number[]>([]);
  const [sopa, setSopa] = useState<number | null>(null);
  const [cantidadPlato, setCantidadPlato] = useState(1);

  // ---- La comanda: 1 a muchos platos + extras de todo el pedido ----
  const [lineas, setLineas] = useState<LineaPlato[]>([]);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [nota, setNota] = useState("");
  const [llevar, setLlevar] = useState(false);
  const [comandaAbierta, setComandaAbierta] = useState(false);
  /** Checkout en domicilio: los datos del cliente viven en la comanda */
  const [datosCliente, setDatosCliente] = useState<DatosCliente>({
    cliente: "",
    telefono: "",
    horaEntrega: "",
    direccion: "",
    barrio: "",
    referencia: "",
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
  const bebidas = extras.filter((e) => e.tipo === "BEBIDA");
  const adicionales = extras.filter((e) => e.tipo === "ADICIONAL");

  const porItemId = new Map(menu.map((m) => [m.itemId, m]));
  const porProductoId = new Map(extras.map((e) => [e.id, e]));

  const estaParaLlevar = esDomicilio || llevar;

  const totalExtras = Object.entries(cantidades).reduce(
    (suma, [id, n]) => suma + (porProductoId.get(Number(id))?.precio ?? 0) * n,
    0,
  );
  const precioLinea = (l: LineaPlato) => precioAlmuerzo(l.conSopa, estaParaLlevar);
  const totalPlatos = lineas.reduce((suma, l) => suma + l.cantidad, 0);
  const totalComanda =
    lineas.reduce((suma, l) => suma + precioLinea(l) * l.cantidad, 0) + totalExtras;

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
          nombresPrincipios.length || nombresEnsaladas.length
            ? ` · ${[...nombresPrincipios, ...nombresEnsaladas].join(", ")}`
            : ""
        }`;

  const datos = JSON.stringify({
    // La carga nueva: 1 a muchos platos, cada uno con su configuración
    lineas: lineas.map((l) => ({
      conSopa: l.conSopa,
      proteinaId: l.proteinaId,
      principios: l.principios,
      ensaladas: l.ensaladas,
      sopaId: l.sopaId,
      cantidad: l.cantidad,
    })),
    // Extras compartidos: un id por unidad, igual que siempre
    extras: Object.entries(cantidades).flatMap(([id, n]) =>
      Array.from({ length: n }, () => Number(id)),
    ),
    llevar: estaParaLlevar,
  });

  /** Lo que acompañó al plato (principios, ensaladas y sopa) */
  const porcionesDe = (l: LineaPlato) => {
    const nombres = [
      ...l.principios.map((id) => porItemId.get(id)?.nombre ?? "").filter(Boolean),
      ...l.ensaladas.map((id) => porItemId.get(id)?.nombre ?? "").filter(Boolean),
    ];
    if (l.conSopa) {
      nombres.push(
        l.sopaId !== null ? (porItemId.get(l.sopaId)?.nombre ?? "Sopa") : "Sopa del día",
      );
    }
    return nombres.join(" · ");
  };

  const añadirPlato = () => {
    if (proteina === null) return;
    const clave = siguienteClave.current++;
    setLineas((previas) => {
      const nueva = {
        conSopa,
        proteinaId: proteina,
        principios,
        ensaladas,
        sopaId: conSopa ? sopa : null,
        cantidad: cantidadPlato,
      };
      // El mismo plato dos veces suma peso en el renglón que ya estaba
      const index = previas.findIndex(
        (l) =>
          l.conSopa === nueva.conSopa &&
          l.proteinaId === nueva.proteinaId &&
          (l.sopaId ?? null) === (nueva.sopaId ?? null) &&
          mismoSet(l.principios, nueva.principios) &&
          mismoSet(l.ensaladas, nueva.ensaladas),
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
    setSopa(null);
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
  const pedirExtra = (id: number, delta: number) => {
    setCantidades((prev) => {
      const n = (prev[id] ?? 0) + delta;
      const copia = { ...prev };
      if (n <= 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });
  };

  const FichaMenu = ({
    item,
    elegido,
    onClick,
  }: {
    item: ItemMenuHoy;
    elegido: boolean;
    onClick: () => void;
  }) => {
    const agotado = item.disponibles === 0;
    const Icono = ICONO_TIPO[item.tipo] ?? UtensilsCrossed;
    return (
      <button
        type="button"
        disabled={agotado}
        onClick={onClick}
        aria-pressed={elegido}
        className={
          "flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition active:scale-95 sm:px-3 sm:py-2.5 " +
          (agotado
            ? "bg-campo-app text-texto-muted/35 ring-1 ring-borde-app"
            : elegido
              ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
              : "bg-campo-app text-texto-app ring-1 ring-borde-app hover:ring-amber-brand/60")
        }
      >
        <span
          aria-hidden
          className={
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl sm:h-8 sm:w-8 " +
            (agotado
              ? "bg-fondo-app/40 text-texto-muted/25"
              : elegido
                ? "bg-fondo-app/60 text-brown-950"
                : "bg-fondo-app/60 text-texto-muted/45")
          }
        >
          <Icono className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight font-bold">
            {item.nombre}
          </span>
          <span
            className={
              "text-[10px] font-bold " +
              (agotado
                ? "text-danger-text"
                : item.disponibles === null
                  ? elegido
                    ? "text-brown-950/70"
                    : "text-texto-muted/35"
                  : item.disponibles <= 5
                    ? "text-warning-text"
                    : elegido
                      ? "text-brown-950/70"
                      : "text-texto-muted/35")
            }
          >
            {agotado
              ? "Agotado"
              : item.disponibles === null
                ? "Ilimitado"
                : `Quedan ${item.disponibles}`}
          </span>
        </span>
      </button>
    );
  };

  const ChipExtra = ({ e }: { e: Extra }) => {
    const n = cantidades[e.id] ?? 0;
    const activo = n > 0;
    return (
      <span
        className={
          "flex items-center overflow-hidden rounded-2xl transition " +
          (activo
            ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
            : "bg-campo-app ring-1 ring-borde-app")
        }
      >
        {activo ? (
          <button
            type="button"
            aria-label={`Quitar ${e.nombre}`}
            onClick={() => pedirExtra(e.id, -1)}
            className="flex h-full items-center px-2.5 transition hover:bg-danger/80"
          >
            <Minus aria-hidden className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => pedirExtra(e.id, 1)}
          className="flex flex-1 items-center gap-2 px-2.5 py-2.5 text-left"
        >
          {!activo ? (
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-fondo-app/60 text-texto-muted/45"
            >
              <Plus className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-bold">
              {e.nombre}
              {activo && n > 1 ? ` ×${n}` : ""}
            </span>
            <span
              className={
                "text-[10px] font-bold tabular-nums " +
                (activo ? "text-brown-950/70" : "text-texto-muted/35")
              }
            >
              {e.precio > 0 ? formatCOP(e.precio) : "Gratis"}
            </span>
          </span>
        </button>
      </span>
    );
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
              ? "Vacía · toca la proteína para armar el plato"
              : `${totalPlatos} ${totalPlatos === 1 ? "plato" : "platos"} en la comanda`}
          </p>
        </div>
        <button
          type="button"
          onClick={vaciarComanda}
          disabled={pendiente || (totalPlatos === 0 && totalExtras === 0)}
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

      {totalPlatos === 0 && totalExtras === 0 ? (
        <p className="mt-3 rounded-2xl bg-campo-app px-3.5 py-3 text-sm text-texto-muted/45">
          Aún no hay platos: elige con sopa o bandeja, la proteína y añade a la
          comanda.
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
            clase="bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20"
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
              Para llevar · + {formatCOP(PRECIO_ICOPOR)} de icopor por almuerzo
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
        disabled={pendiente || totalPlatos === 0}
        className={
          "mt-2.5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-md transition active:scale-95 " +
          (pendiente || totalPlatos === 0
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
                sub={`Se cobra en la entrega · incluye icopor de ${formatCOP(PRECIO_ICOPOR)}`}
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
                      {ok ? `+ ${formatCOP(PRECIO_ICOPOR)} de icopor` : "se sirve en la mesa"}
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
              clase="bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20"
              titulo="¿El almuerzo lleva sopa?"
              sub="La bandeja es el mismo almuerzo sin sopa"
            />
            <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-panel-app p-1.5 ring-1 ring-borde-app">
              {(
                [
                  { ok: true, txt: "Con sopa" },
                  { ok: false, txt: "Bandeja (sin sopa)" },
                ] as const
              ).map((o) => (
                <button
                  key={o.txt}
                  type="button"
                  onClick={() => setConSopa(o.ok)}
                  aria-pressed={conSopa === o.ok}
                  className={
                    "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 font-display text-md transition active:scale-95 sm:py-2.5 " +
                    (conSopa === o.ok
                      ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
                      : "text-texto-muted/70 hover:bg-panel-hover")
                  }
                >
                  <span className="flex items-center gap-2">
                    <Soup aria-hidden className="h-4 w-4" /> {o.txt}
                  </span>
                  <span className="text-[10px] font-bold tabular-nums normal-case">
                    {formatCOP(precioAlmuerzo(o.ok, estaParaLlevar))}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Proteína: el almuerzo se cobra en esta línea */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Drumstick}
              clase="bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20"
              titulo="Proteína"
              sub="Elige una · puede ir ×2, ×3 en cantidad"
            />
            {proteinasMenu.length === 0 ? (
              <NotaVacia texto="Hoy no hay proteína en el menú…" />
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {proteinasMenu.map((item) => (
                  <FichaMenu
                    key={item.itemId}
                    item={item}
                    elegido={proteina === item.itemId}
                    onClick={() => setProteina(item.itemId)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 3. Principios */}
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

          {/* 4. Ensaladas (apartado especial) */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Salad}
              clase="bg-[#4ec27e]/10 text-[#8fdcae] ring-1 ring-[#4ec27e]/20"
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
                clase="bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20"
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

          {/* 6. Bebidas */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={CupSoda}
              clase="bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20"
              titulo="Bebidas"
              sub="Comparten las mesas del pedido · sumadas al total"
            />
            {bebidas.length === 0 ? (
              <NotaVacia texto="Hoy no hay bebidas…" />
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {bebidas.map((e) => (
                  <ChipExtra key={e.id} e={e} />
                ))}
              </div>
            )}
          </section>

          {/* 7. Adicionales */}
          <section className="mt-3 rounded-[1.5rem] bg-panel-app p-3 ring-1 ring-borde-app shadow-2xl sm:mt-3.5 sm:rounded-[2rem] sm:p-4">
            <TituloSeccion
              Icono={Star}
              clase="bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20"
              titulo="Adicionales"
              sub="Huevo, carne extra, los que pidan"
            />
            {adicionales.length === 0 ? (
              <NotaVacia texto="Hoy no hay adicionales…" />
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {adicionales.map((e) => (
                  <ChipExtra key={e.id} e={e} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Comanda: fija en escritorio, modal en móvil */}
        <aside className="hidden rounded-[2rem] bg-panel-app p-4 ring-1 ring-borde-app shadow-2xl lg:sticky lg:top-4 lg:block">
          {PanelComanda()}
        </aside>
      </div>

      {/* Barra fija: añadir el plato armado · en móvil abre la comanda.
          En escritorio se alinea a la columna de contenido (pl-64 del shell):
          centrarla sobre el viewport la descolocaba y pisaba «Cerrar sesión».
          Además solo la pastilla oscura captura clics */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:pl-64">
        <div className="mx-auto w-full max-w-xl px-3 barra-seguro sm:max-w-2xl lg:max-w-6xl">
          <div className="pointer-events-auto flex items-center gap-2 rounded-[1.75rem] bg-brown-950/95 px-3 py-3 shadow-flotante ring-1 ring-borde-app backdrop-blur sm:gap-2.5 sm:px-4">
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
                  ? "cursor-not-allowed bg-brown-800/60 text-texto-muted/50"
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
          <div className="animar-subir max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-brown-900 p-4 shadow-pop ring-1 ring-borde-app sm:p-5">
            {PanelComanda({ alCerrar: () => setComandaAbierta(false) })}
          </div>
        </div>
      ) : null}
    </form>
  );
}
