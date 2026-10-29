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
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <CalendarPlus className="h-12 w-12 text-amber-brand" />
          <h2 className="mt-4 font-display text-2xl text-white">
            Aún no has armado el menú de hoy
          </h2>
          <p className="mt-2 max-w-md text-cream-200/70">
            Elige las proteínas, principios, ensaladas y sopas que se servirán
            y define cuántas porciones quedan disponibles. El stock se
            descontará en tiempo real al tomar pedidos.
          </p>
          <form action={crearMenuHoy} className="mt-6">
            <button
              type="submit"
              className="rounded-2xl bg-amber-brand px-6 py-3 font-display text-lg text-brown-950 transition hover:bg-orange-brand hover:text-white"
            >
              Crear menú de hoy
            </button>
          </form>
          <p className="mt-3 text-xs text-cream-200/45">
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
        <span className="rounded-full bg-success/10 px-4 py-1.5 text-sm font-bold text-[#a7dd83] ring-1 ring-success/20">
          Activo · {menu.items.length} opciones
        </span>
        <span className="text-sm text-cream-200/45">
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
              className="rounded-[2rem] bg-white/[0.02] p-5 ring-1 ring-white/10"
            >
              <h2 className="mb-4 flex items-center gap-2.5 font-display text-lg text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-orange-brand ring-1 ring-white/10">
                  <Icono className="h-5 w-5" />
                </span>
                {TITULO[tipo]}
              </h2>

              {delTipo.length === 0 ? (
                <p className="mb-4 rounded-xl border-2 border-dashed border-white/10 p-3 text-center text-sm text-cream-200/45">
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
                    className="min-w-0 flex-1 rounded-xl border-0 bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 placeholder:text-cream-200/25 focus:ring-amber-brand/60"
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
                    className="shrink-0 rounded-xl bg-white/5 px-3 py-2 text-cream-100 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                  >
                    <span className="font-bold">+</span>
                  </button>
                </form>
              ) : (
                <p className="mt-4 rounded-xl bg-white/5 p-2 text-center text-xs text-cream-200/45">
                  Todo el catálogo de esta categoría ya está en el menú.
                </p>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-cream-200/45">
        <Trash2 className="h-4 w-4" />
        Tu catálogo nunca se borra: quitar un ítem del menú solo lo deja fuera de HOY.
      </p>
    </>
  );
}
