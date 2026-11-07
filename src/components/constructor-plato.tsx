// Constructor de platos compartido: la MISMA experiencia de armado para el
// mesero, los domicilios y los apartados. Solo pinta y recibe estado: cada
// pantalla sigue decidiendo precios, inventario y qué hace con el plato.
import {
  CupSoda,
  Drumstick,
  Minus,
  Plus,
  Salad,
  Soup,
  Star,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { formatCOP } from "@/lib/format";

/** Lo mínimo que necesita una ficha del menú para pintarse */
export type ItemConstructor = {
  nombre: string;
  tipo: string;
  /** null = porciones ilimitadas */
  disponibles: number | null;
  /** Precio especial del día (0 = rige el almuerzo corriente) */
  precioPropio?: number;
};

/** Bebida o adicional del catálogo (postre de la ficha de cantidad) */
export type ExtraConstructor = {
  nombre: string;
  precio: number;
};

export const ICONO_TIPO: Record<string, LucideIcon> = {
  PROTEINA: Drumstick,
  PRINCIPIO: Wheat,
  ENSALADA: Salad,
  SOPA: Soup,
  BEBIDA: CupSoda,
  ADICIONAL: Star,
};

/** Tintes en el orden del solar: cada categoría propia revive un color
 *  propio y estático calculado de su nombre */
const TINTES_CATEGORIA = [
  "bg-menta-text/10 text-menta-text ring-1 ring-menta-text/20",
  "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
  "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
  "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20",
];

export function claseDeCategoria(nombre: string): string {
  let suma = 0;
  for (let i = 0; i < nombre.length; i += 1) {
    suma = (suma * 31 + nombre.charCodeAt(i)) >>> 0;
  }
  return TINTES_CATEGORIA[suma % TINTES_CATEGORIA.length];
}

/** Encabezado de cada sección, con ícono en píldora de color */
export function TituloSeccion({
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

/** Aviso hundido para las secciones en las que hoy no hay nada */
export function NotaVacia({ texto }: { texto: string }) {
  return (
    <p className="mt-3 rounded-2xl bg-campo-app px-3.5 py-3 text-sm text-texto-muted/45">
      {texto}
    </p>
  );
}

/** Ficha del menú (principio, proteína, ensalada, sopa o categoría propia) */
export function FichaMenu({
  item,
  elegido,
  onClick,
  precioVisible = false,
}: {
  item: ItemConstructor;
  elegido: boolean;
  onClick: () => void;
  /** true solo en la sección de proteína: cuando el ítem trae precio
   *  especial del día, la ficha muestra cuánto cobra */
  precioVisible?: boolean;
}) {
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
          {(precioVisible && (item.precioPropio ?? 0) > 0
            ? `${formatCOP(item.precioPropio ?? 0)} · `
            : "") +
            (agotado
              ? "Agotado"
              : item.disponibles === null
                ? "Ilimitado"
                : `Quedan ${item.disponibles}`)}
        </span>
      </span>
    </button>
  );
}

/** Chip de cantidad para un adicional o una bebida (con + / − acumulables) */
export function ChipCantidad({
  etiqueta,
  precio,
  cantidad,
  onSumar,
  onRestar,
  ariaQuitar,
}: {
  etiqueta: string;
  precio: number;
  cantidad: number;
  onSumar: () => void;
  onRestar: () => void;
  /** Texto accesible del botón de quitar */
  ariaQuitar: string;
}) {
  const activo = cantidad > 0;
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
          aria-label={ariaQuitar}
          onClick={onRestar}
          className="flex h-full items-center px-2.5 transition hover:bg-danger/80"
        >
          <Minus aria-hidden className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSumar}
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
            {etiqueta}
            {activo && cantidad > 1 ? ` ×${cantidad}` : ""}
          </span>
          <span
            className={
              "text-[10px] font-bold tabular-nums " +
              (activo ? "text-brown-950/70" : "text-texto-muted/35")
            }
          >
            {precio > 0 ? formatCOP(precio) : "Gratis"}
          </span>
        </span>
      </button>
    </span>
  );
}

/** Píldora de dos opciones para la modalidad del plato (sopa/bandeja) */
export function PildoraModalidad({
  opciones,
  valor,
  onElegir,
}: {
  opciones: { valor: boolean; texto: string; detalle: string; Icono: LucideIcon }[];
  valor: boolean;
  onElegir: (v: boolean) => void;
}) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-panel-app p-1.5 ring-1 ring-borde-app">
      {opciones.map(({ valor: ok, texto, detalle, Icono }) => (
        <button
          key={texto}
          type="button"
          onClick={() => onElegir(ok)}
          aria-pressed={valor === ok}
          className={
            "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 font-display text-md transition active:scale-95 sm:py-2.5 " +
            (valor === ok
              ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
              : "text-texto-muted/70 hover:bg-panel-hover")
          }
        >
          <span className="flex items-center gap-2">
            <Icono aria-hidden className="h-4 w-4" /> {texto}
          </span>
          <span className="text-[10px] font-bold tabular-nums normal-case">
            {detalle}
          </span>
        </button>
      ))}
    </div>
  );
}
