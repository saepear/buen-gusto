import {
  CalendarPlus,
  Drumstick,
  Salad,
  Soup,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { getCategoriasPersonalizadas } from "@/lib/config";
import { iconoDeCategoria } from "@/lib/iconos";
import { claveDia, formatFecha } from "@/lib/format";
import { TIPOS_MENU_DIA } from "@/lib/roles";
import {
  agregarAlMenu,
  crearMenuHoy,
} from "./actions";
import { FilaPorciones } from "./fila";
import { AgregarProducto, CategoriaMenu } from "./categoria";
import styles from "./menu.module.css";

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
        <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <CalendarPlus className="h-12 w-12 text-amber-brand" />
          <h2 className="mt-4 font-display text-2xl text-texto-app">
            Aún no has armado el menú de hoy
          </h2>
          <p className="mt-2 max-w-md text-texto-muted/70">
            Elige las proteínas, principios, ensaladas y sopas que se servirán
            y define cuántas porciones quedan disponibles. El stock se
            descontará en tiempo real al tomar pedidos.
          </p>
          <form action={crearMenuHoy} className="mt-6">
            <button
              type="submit"
              className="rounded-2xl bg-amber-brand px-6 py-3 font-display text-lg text-brown-950 transition hover:bg-orange-brand hover:text-texto-app"
            >
              Crear menú de hoy
            </button>
          </form>
          <p className="mt-3 text-xs text-texto-muted/45">
            Necesitas primero crear productos en la sección «Productos».
          </p>
        </div>
      </>
    );
  }

  const productoIncluidos = new Set(menu.items.map((i) => i.productoId));
  const categorias = await getCategoriasPersonalizadas();
  const catalogo = await db.producto.findMany({
    where: {
      activo: true,
      // Las secciones de hoy: los 4 tipos fijos + las categorías propias
      tipo: { in: [...TIPOS_MENU_DIA, ...categorias.map((c) => c.nombre)] },
    },
    orderBy: { nombre: "asc" },
  });

  // Cada sección del editor: los 4 tipos fijos del almuerzo y después las
  // categorías propias con su icono
  const secciones = [
    ...TIPOS_MENU_DIA.map((t) => ({
      clave: t,
      titulo: TITULO[t] ?? t,
      Icono: ICONO[t] ?? Wheat,
      propia: false,
    })),
    ...categorias.map((c) => ({
      clave: c.nombre,
      titulo: c.nombre,
      Icono: iconoDeCategoria(c.icono),
      propia: true,
    })),
  ];

  return (
    <div className={styles.shell}>
      <header className={styles.hero}>
        <span className={styles.heroIcon}><Soup aria-hidden /></span>
        <div><p className={styles.eyebrow}>COCINA · DISPONIBILIDAD</p><h1>Menú del día</h1><p className={styles.date}>{formatFecha(new Date())}</p></div>
        <span className={styles.date}>{menu.items.length} opciones en el menú</span>
      </header>
      <p className={styles.intro}>¿Qué vamos a servir hoy? <span>Abre una categoría para elegir productos y ajustar sus porciones.</span></p>
      <div id="categorias-menu" className={styles.categories}>
        {secciones.map((seccion) => {
          const tipo = seccion.clave;
          const { Icono } = seccion;
          const delTipo = menu.items
            .filter((i) => i.producto.tipo === tipo)
            .sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre));
          const faltantes = catalogo.filter(
            (p) => p.tipo === tipo && !productoIncluidos.has(p.id),
          );

          return (
            <CategoriaMenu key={tipo} titulo={seccion.titulo} icono={<Icono />} cantidad={delTipo.length} nombres={delTipo.map(i => i.producto.nombre)}>
              <section className={styles.selectedProducts}>
              <h3>En el menú <span>{delTipo.length}</span></h3>
              <p className={styles.help}>Ajusta porciones, visibilidad y precios. Usa ✓ para guardar cada ajuste.</p>
              {delTipo.length === 0 ? (
                <p className="mb-4 rounded-xl border-2 border-dashed border-borde-app p-3 text-center text-sm text-texto-muted/45">
                  Todavía no hay {seccion.titulo.toLowerCase()} en el menú.
                </p>
              ) : (
                <ul className="space-y-3.5">
                  {delTipo.map((item) => (
                    <FilaPorciones
                      key={item.id + "-" + (item.stockPorciones === null ? "inf" : item.stockPorciones)}
                      item={item}
                    />
                  ))}

                </ul>
              )}

              </section>
              <section className={styles.catalogProducts}>
                <h3>Agregar productos <span>{faltantes.length}</span></h3>
                <p className={styles.help}>Pulsa + para incluir una opción del catálogo.</p>
              {faltantes.length > 0 ? faltantes.map(p => (
                <form key={p.id} action={agregarAlMenu}>
                  <input type="hidden" name="menuId" value={menu.id} />
                  <input type="hidden" name="productoId" value={p.id} />
                  <AgregarProducto nombre={p.nombre} />
                </form>
              )) : (
                <p className="mt-4 rounded-xl bg-panel-app p-2 text-center text-xs text-texto-muted/45">
                  Todo el catálogo de esta categoría ya está en el menú.
                </p>
              )}
              </section>
            </CategoriaMenu>
          );
        })}
      </div>

    </div>
  );
}

