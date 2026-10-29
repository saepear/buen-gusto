import {
  CalendarPlus,
  Drumstick,
  Infinity as IconoInfinito,
  Salad,
  Soup,
  Trash2,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { claveDia, formatFecha } from "@/lib/format";
import { TIPOS_MENU_DIA, type TipoProducto } from "@/lib/roles";
import {
  agregarAlMenu,
  crearMenuHoy,
} from "./actions";
import { FilaPorciones } from "./fila";

const ICONO: Record<string, LucideIcon> = {
  PROTEINA: Drumstick,
  PRINCIPIO: Wheat,
  ENSALADA: Salad,
  SOPA: Soup,
};

const TITULO: Record<string, string> = {
  PROTEINA: "Proteínas",
  PRINCIPIO: "Principios",
  ENSALADA: "Ensaladas",
  SOPA: "Sopas",
};

export default async function PaginaMenuDia() {
  const fecha = claveDia(new Date());
  const menu = await db.menuDia.findUnique({
    where: { fecha },
    include: { items: { include: { producto: true } } },
  });

  if (!menu) {
    return (
      <>
        <EncabezadoPagina
          titulo="Menú del día"
          subtitulo={formatFecha(new Date())}
        />
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brown-600/25 bg-cream-100 p-10 text-center">
          <CalendarPlus className="h-12 w-12 text-amber-brand" />
          <h2 className="mt-4 font-display text-2xl text-brown-800">
            Aún no has armado el menú de hoy
          </h2>
          <p className="mt-2 max-w-md text-brown-600">
            Elige las proteínas, principios, ensaladas y sopas que se servirán
            y define cuántas porciones quedan disponibles. El stock se
            descontará en tiempo real al tomar pedidos.
          </p>
          <form action={crearMenuHoy} className="mt-6">
            <button
              type="submit"
              className="rounded-2xl bg-orange-brand px-6 py-3 font-display text-lg text-white transition hover:bg-amber-brand"
            >
              Crear menú de hoy
            </button>
          </form>
          <p className="mt-3 text-xs text-brown-500">
            Necesitas primero crear productos en la sección «Productos».
          </p>
        </div>
      </>
    );
  }

  const productoIncluidos = new Set(menu.items.map((i) => i.productoId));
  const catalogo = await db.producto.findMany({
    where: { activo: true, tipo: { in: TIPOS_MENU_DIA } },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Menú del día"
        subtitulo={formatFecha(new Date())}
      />

      <div className="mb-6 flex items-center gap-3">
        <span className="rounded-full bg-success/15 px-4 py-1.5 text-sm font-bold text-success-dark">
          Activo · {menu.items.length} opciones
        </span>
        <span className="text-sm text-brown-500">
          Las porciones se agotan solo cuando le pones un límite
          <IconoInfinito className="ml-1 inline h-3.5 w-3.5" />
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-4">
        {TIPOS_MENU_DIA.map((tipo: TipoProducto) => {
          const Icono = ICONO[tipo];
          const delTipo = menu.items
            .filter((i) => i.producto.tipo === tipo)
            .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre));
          const faltantes = catalogo.filter(
            (p) => p.tipo === tipo && !productoIncluidos.has(p.id),
          );

          return (
            <section
              key={tipo}
              className="rounded-3xl bg-white p-5 ring-1 ring-cream-300"
            >
              <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg text-brown-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-brand/20 text-orange-brand">
                  <Icono className="h-5 w-5" />
                </span>
                {TITULO[tipo]}
              </h2>

              {delTipo.length === 0 ? (
                <p className="mb-4 rounded-xl border-2 border-dashed border-brown-600/20 p-3 text-center text-sm text-brown-500">
                  Todavía no hay {TITULO[tipo].toLowerCase()} en el menú.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {delTipo.map((item) => (
                    <FilaPorciones
                      key={item.id + "-" + (item.stockPorciones === null ? "inf" : item.stockPorciones)}
                      item={item}
                    />
                  ))}

                </ul>
              )}

              {faltantes.length > 0 ? (
                <form action={agregarAlMenu} className="mt-4 flex gap-2">
                  <input type="hidden" name="menuId" value={menu.id} />
                  <select
                    name="productoId"
                    className="min-w-0 flex-1 rounded-xl border-0 bg-cream-50 px-3 py-2 text-sm text-brown-800 ring-1 ring-cream-300 focus:ring-amber-brand"
                  >
                    {faltantes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    title="Agregar al menú"
                    className="shrink-0 rounded-xl bg-brown-800 px-3 py-2 text-cream-100 transition hover:bg-amber-brand hover:text-brown-950"
                  >
                    <span className="font-bold">+</span>
                  </button>
                </form>
              ) : (
                <p className="mt-4 rounded-xl bg-cream-50 p-2 text-center text-xs text-brown-500">
                  Todo el catálogo de esta categoría ya está en el menú.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-brown-500">
        <Trash2 className="h-4 w-4" />
        Tu catálogo nunca se borra: quitar un ítem del menú solo lo deja fuera de HOY.
      </p>
    </>
  );
}
