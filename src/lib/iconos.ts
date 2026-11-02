// Catálogo de iconos que el cliente puede darle a sus categorías propias.
// Está aparte de los componentes para poder importarlo desde el servidor
// (acciones) y desde el cliente (picker y secciones) sin duplicar la lista.
import {
  Cake,
  CakeSlice,
  Candy,
  Cherry,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  Drumstick,
  Egg,
  Fish,
  ForkKnife,
  GlassWater,
  Grape,
  Heart,
  IceCreamCone,
  Leaf,
  Martini,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Sparkles,
  Star,
  UtensilsCrossed,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";

/** El icono por defecto de toda categoría nueva */
export const ICONO_CATEGORIA_DEFECTO = "UtensilsCrossed";

/** Lista dedicada a las categorías propias (nombre → componente) */
export const ICONOS_CATEGORIA: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Soup,
  Salad,
  CupSoda,
  Drumstick,
  Wheat,
  Egg,
  Fish,
  Leaf,
  Heart,
  Sparkles,
  Star,
  Pizza,
  Sandwich,
  Popcorn,
  Croissant,
  CakeSlice,
  Cake,
  Donut,
  Cookie,
  Candy,
  Cherry,
  Grape,
  IceCreamCone,
  Coffee,
  GlassWater,
  Wine,
  Martini,
  ForkKnife,
};

/** Orden estable para el picker del panel */
export const LISTA_ICONOS_CATEGORIA = Object.keys(ICONOS_CATEGORIA);

/** Con la clave guardada (o vacía) resuelve el componente; cae al defecto */
export function iconoDeCategoria(clave?: string | null): LucideIcon {
  return (clave && ICONOS_CATEGORIA[clave]) || UtensilsCrossed;
}
