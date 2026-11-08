import {
  CupSoda,
  Drumstick,
  Plus,
  Salad,
  Soup,
  Star,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { getCategoriasPersonalizadas } from "@/lib/config";
import { iconoDeCategoria } from "@/lib/iconos";
import {
  TIPO_PRODUCTO,
  TIPO_PRODUCTO_LABEL,
  type TipoProducto,
} from "@/lib/roles";
import {
  FormularioNuevoProducto,
  PanelCategorias,
  TarjetaProducto,
} from "./tarjetas";
import "./productos.css";

const ICONO_TIPO: Record<TipoProducto, LucideIcon> = {
  PROTEINA: Drumstick,
  PRINCIPIO: Wheat,
  ENSALADA: Salad,
  SOPA: Soup,
  BEBIDA: CupSoda,
  ADICIONAL: Star,
};

const DESCRIPCION_TIPO: Record<TipoProducto, string> = {
  PROTEINA: "La carne del día · stock por porciones",
  PRINCIPIO: "Los acompañantes del día · stock por porciones",
  ENSALADA: "Otro acompañante (ensalada verde, dulce…) · stock por porciones",
  SOPA: "Sopa del día · stock por porciones",
  BEBIDA: "Bebidas del catálogo · precio en COP",
  ADICIONAL: "Extras con precio en COP",
};

export default async function PaginaProductos() {
  const productos = await db.producto.findMany();
  const categorias = await getCategoriasPersonalizadas();
  const ORDEN: TipoProducto[] = [
    TIPO_PRODUCTO.PROTEINA,
    TIPO_PRODUCTO.PRINCIPIO,
    TIPO_PRODUCTO.ENSALADA,
    TIPO_PRODUCTO.SOPA,
    TIPO_PRODUCTO.BEBIDA,
    TIPO_PRODUCTO.ADICIONAL,
  ];

  return (
    <div className="productos-shell">
      <EncabezadoPagina
        titulo="Productos"
        subtitulo="Catálogo del restaurante: lo que va al menú del día y lo que se vende aparte"
      />

      <FormularioNuevoProducto categorias={categorias} />

      <PanelCategorias categorias={categorias} />

      <nav className="productos-category-nav" aria-label="Categorías de productos">
        {ORDEN.map(tipo => <a key={tipo} href={`#productos-${tipo}`}>{TIPO_PRODUCTO_LABEL[tipo]} <span>{productos.filter(p => p.tipo === tipo).length}</span></a>)}
        {categorias.map(c => <a key={c.nombre} href={`#productos-${encodeURIComponent(c.nombre)}`}>{c.nombre}</a>)}
      </nav>

      <div className="mt-8 space-y-8">
        {ORDEN.map((tipo) => {
          const delTipo = productos
            .filter((p) => p.tipo === tipo)
            .sort((a, b) =>
              a.activo === b.activo
                ? a.nombre.localeCompare(b.nombre)
                : a.activo
                  ? -1
                  : 1,
            );
          const Icono = ICONO_TIPO[tipo];
          return (
            <section key={tipo} id={`productos-${tipo}`} className="productos-category-section">
              <h2 className="mb-3 flex items-center gap-2.5 font-display text-xl text-texto-app">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-panel-app text-texto-app">
                  <Icono className="h-5 w-5" />
                </span>
                {TIPO_PRODUCTO_LABEL[tipo]}
                <span className="text-sm font-normal text-texto-muted/45">
                  · {DESCRIPCION_TIPO[tipo]}
                </span>
              </h2>
              {delTipo.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-borde-app p-4 text-sm text-texto-muted/45">
                  Aún no hay {TIPO_PRODUCTO_LABEL[tipo].toLowerCase()}s creados.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {delTipo.map((p) => (
                    <TarjetaProducto
                      key={p.id}
                      id={p.id}
                      nombre={p.nombre}
                      precio={p.precio}
                      tipo={p.tipo}
                      activo={p.activo}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {/* Las categorías que el propio cliente creó, cada una con su sección
            y su icono; entran al menú del día como proteínas o ensaladas */}
        {categorias.map((categoria) => {
          const delTipo = productos
            .filter((p) => p.tipo === categoria.nombre)
            .sort((a, b) =>
              a.activo === b.activo
                ? a.nombre.localeCompare(b.nombre)
                : a.activo
                  ? -1
                  : 1,
            );
          const Icono = iconoDeCategoria(categoria.icono);
          return (
            <section key={categoria.nombre} id={`productos-${encodeURIComponent(categoria.nombre)}`} className="productos-category-section">
              <h2 className="mb-3 flex items-center gap-2.5 font-display text-xl text-texto-app">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-panel-app text-amber-brand ring-1 ring-borde-app">
                  <Icono className="h-5 w-5" />
                </span>
                {categoria.nombre}
                <span className="text-sm font-normal text-texto-muted/45">
                  · Categoría propia · entra al almuerzo del día
                </span>
              </h2>
              {delTipo.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-borde-app p-4 text-sm text-texto-muted/45">
                  Aún no hay productos en «{categoria.nombre}»: créalos arriba
                  con este tipo.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {delTipo.map((p) => (
                    <TarjetaProducto
                      key={p.id}
                      id={p.id}
                      nombre={p.nombre}
                      precio={p.precio}
                      tipo={p.tipo}
                      activo={p.activo}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-8 flex items-center gap-2 text-sm text-texto-muted/45">
        <Plus className="h-4 w-4" />
        «Desactivar» es temporal: el producto sale del catálogo y del salón y
        puedes reactivarlo. «Eliminar definitivamente» borra la fila de la
        base de datos; las ventas del historial conservan su nombre y precios
        congelados.
      </p>
      <p className="mt-2 text-xs text-texto-muted/35">
        El precio del almuerzo corriente lo fija la combinación (con/sin sopa ·
        mesa/llevar): completo $13.000, bandeja $12.000, llevar suma icopor
        $1.500. EXCEPCIÓN, los ESPECIALES: el precio de HOY se fija en «Menú
        del día» sobre la proteína (asado a $24.000 sin tocar la semana, que
        sigue a $13.000); si no se fija ahí, cuenta el precio propio de la
        proteína. Para bebidas y adicionales vale su precio de catálogo.
      </p>
    </div>
  );
}

