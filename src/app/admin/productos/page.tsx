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
import {
  TIPO_PRODUCTO,
  TIPO_PRODUCTO_LABEL,
  type TipoProducto,
} from "@/lib/roles";
import { FormularioNuevoProducto, TarjetaProducto } from "./tarjetas";

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
  const ORDEN: TipoProducto[] = [
    TIPO_PRODUCTO.PROTEINA,
    TIPO_PRODUCTO.PRINCIPIO,
    TIPO_PRODUCTO.ENSALADA,
    TIPO_PRODUCTO.SOPA,
    TIPO_PRODUCTO.BEBIDA,
    TIPO_PRODUCTO.ADICIONAL,
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Productos"
        subtitulo="Catálogo del restaurante: lo que va al menú del día y lo que se vende aparte"
      />

      <FormularioNuevoProducto />

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
            <section key={tipo}>
              <h2 className="mb-3 flex items-center gap-2.5 font-display text-xl text-brown-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brown-800/10 text-brown-700">
                  <Icono className="h-5 w-5" />
                </span>
                {TIPO_PRODUCTO_LABEL[tipo]}
                <span className="text-sm font-normal text-brown-500">
                  · {DESCRIPCION_TIPO[tipo]}
                </span>
              </h2>
              {delTipo.length === 0 ? (
                <p className="rounded-2xl border-2 border-dashed border-brown-600/20 p-4 text-sm text-brown-500">
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
                      activo={p.activo}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-8 flex items-center gap-2 text-sm text-brown-500">
        <Plus className="h-4 w-4" />
        Los productos eliminados no aparecen al armar el menú del día ni en la
        app del mesero; se pueden reactivar con el botón verde de su tarjeta.
      </p>
      <p className="mt-2 text-xs text-brown-400">
        El precio del almuerzo lo fija la combinación (con/sin sopa · mesa/llevar):
        completo $13.000, bandeja $12.000, llevar suma icopor $1.500. El precio
        del producto no se usa para el menú del día, solo para bebidas y extras.
      </p>
    </>
  );
}
