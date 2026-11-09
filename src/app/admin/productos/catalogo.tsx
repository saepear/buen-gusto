"use client";

import {
  ArrowUpRight,
  Boxes,
  Check,
  CircleDollarSign,
  CupSoda,
  Drumstick,
  PackagePlus,
  Plus,
  Salad,
  Settings2,
  Soup,
  Star,
  Wheat,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import type { CategoriaPropia } from "@/lib/config";
import { iconoDeCategoria } from "@/lib/iconos";
import { TIPO_PRODUCTO } from "@/lib/roles";
import { formatCOP } from "@/lib/format";
import { FormularioNuevoProducto, PanelCategorias, TarjetaProducto } from "./tarjetas";

type ProductoCatalogo = {
  id: number;
  nombre: string;
  precio: number;
  tipo: string;
  activo: boolean;
};

type SeccionCatalogo = {
  clave: string;
  titulo: string;
  descripcion: string;
  Icono: LucideIcon;
  propia: boolean;
};

const SECCIONES_BASE: SeccionCatalogo[] = [
  { clave: TIPO_PRODUCTO.PROTEINA, titulo: "Proteínas", descripcion: "Carnes y especiales del día", Icono: Drumstick, propia: false },
  { clave: TIPO_PRODUCTO.PRINCIPIO, titulo: "Principios", descripcion: "Acompañantes del almuerzo", Icono: Wheat, propia: false },
  { clave: TIPO_PRODUCTO.ENSALADA, titulo: "Ensaladas", descripcion: "Opciones frescas para completar", Icono: Salad, propia: false },
  { clave: TIPO_PRODUCTO.SOPA, titulo: "Sopas", descripcion: "Sopas y entradas calientes", Icono: Soup, propia: false },
  { clave: TIPO_PRODUCTO.BEBIDA, titulo: "Bebidas", descripcion: "Bebidas del catálogo", Icono: CupSoda, propia: false },
  { clave: TIPO_PRODUCTO.ADICIONAL, titulo: "Adicionales", descripcion: "Extras para personalizar", Icono: Star, propia: false },
];

export function ExploradorProductos({
  productos,
  categorias,
}: {
  productos: ProductoCatalogo[];
  categorias: CategoriaPropia[];
}) {
  const [nuevoOrigen, setNuevoOrigen] = useState<OrigenModal | null>(null);
  const nuevoRef = useRef<HTMLButtonElement>(null);
  const secciones = [
    ...SECCIONES_BASE,
    ...categorias.map((categoria) => ({
      clave: categoria.nombre,
      titulo: categoria.nombre,
      descripcion: "Categoría propia del restaurante",
      Icono: iconoDeCategoria(categoria.icono),
      propia: true,
    })),
  ];
  const activos = productos.filter((producto) => producto.activo).length;
  const conPrecio = productos.filter((producto) => producto.precio > 0).length;

  function abrirNuevo() {
    const rect = nuevoRef.current?.getBoundingClientRect();
    if (rect) setNuevoOrigen({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  }

  return (
    <div className="productos-catalog">
      <section className="productos-catalog-hero">
        <div className="productos-catalog-hero-copy">
          <div className="productos-catalog-kicker"><Boxes aria-hidden size={15} /> CATÁLOGO CENTRAL</div>
          <h2>Todo lo que puedes vender</h2>
          <p>Organiza el catálogo por categorías y abre cada grupo para editar sus productos sin perder el contexto.</p>
        </div>
        <div className="productos-catalog-stats" aria-label="Resumen del catálogo">
          <div><strong>{productos.length}</strong><span>productos</span></div>
          <div><strong>{activos}</strong><span>activos</span></div>
          <div><strong>{conPrecio}</strong><span>con precio propio</span></div>
        </div>
      </section>

      <div className="productos-catalog-toolbar">
        <div>
          <p className="productos-section-kicker">EXPLORA POR CATEGORÍA</p>
          <h2>Elige un grupo para administrarlo</h2>
        </div>
        <button ref={nuevoRef} type="button" className="productos-new-button" onClick={abrirNuevo}>
          <Plus aria-hidden size={18} /> Nuevo producto
        </button>
      </div>

      <div className="productos-category-grid" aria-label="Categorías de productos">
        {secciones.map((seccion) => {
          const delTipo = productos
            .filter((producto) => producto.tipo === seccion.clave)
            .sort((a, b) => a.activo === b.activo ? a.nombre.localeCompare(b.nombre) : a.activo ? -1 : 1);
          return <CategoriaProducto key={seccion.clave} seccion={seccion} productos={delTipo} />;
        })}
      </div>

      <section className="productos-management-row">
        <div className="productos-management-copy">
          <span className="productos-management-icon"><Settings2 aria-hidden size={19} /></span>
          <div><p className="productos-section-kicker">CONFIGURACIÓN</p><h2>Categorías propias</h2><p>Crea secciones como Especiales, Postres o lo que necesite tu restaurante.</p></div>
        </div>
        <PanelCategorias categorias={categorias} />
      </section>

      {nuevoOrigen ? <ModalFlip origen={nuevoOrigen} ariaLabel="Crear nuevo producto" onClose={() => { setNuevoOrigen(null); nuevoRef.current?.focus(); }}>
        {cerrar => <>
          <header className="productos-modal-header" data-anim>
            <span className="productos-modal-icon"><PackagePlus aria-hidden size={24} /></span>
            <div><p className="productos-section-kicker">CATÁLOGO</p><h2>Nuevo producto</h2><p>Agrega una opción al catálogo del restaurante.</p></div>
            <button type="button" className="productos-modal-close" aria-label="Cerrar nuevo producto" onClick={cerrar}><X aria-hidden size={19} /></button>
          </header>
          <div className="productos-modal-body productos-modal-form" data-anim><FormularioNuevoProducto categorias={categorias} /></div>
          <footer className="productos-modal-footer" data-anim><span>El producto quedará disponible para la categoría elegida.</span><button type="button" onClick={cerrar}>Listo <Check aria-hidden size={16} /></button></footer>
        </>}
      </ModalFlip> : null}
    </div>
  );
}

function CategoriaProducto({ seccion, productos }: { seccion: SeccionCatalogo; productos: ProductoCatalogo[] }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [origen, setOrigen] = useState<OrigenModal | null>(null);
  const { Icono } = seccion;
  const activos = productos.filter((producto) => producto.activo).length;
  const nombres = productos.slice(0, 3).map((producto) => producto.nombre).join(" · ");
  const precios = productos.filter((producto) => producto.precio > 0);
  const precioMedio = precios.length > 0 ? formatCOP(Math.round(precios.reduce((sum, producto) => sum + producto.precio, 0) / precios.length)) : "Incluido en almuerzo";

  function abrir() {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) setOrigen({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  }

  return <>
    <button ref={trigger} type="button" className="productos-category-tile" aria-haspopup="dialog" onClick={abrir}>
      <span className="productos-category-tile-top"><span className="productos-category-icon"><Icono aria-hidden size={25} /></span><ArrowUpRight aria-hidden size={19} /></span>
      <span className="productos-category-label">{seccion.propia ? "CATEGORÍA PROPIA" : "CATÁLOGO"}</span>
      <strong>{seccion.titulo}</strong>
      <span className="productos-category-description">{seccion.descripcion}</span>
      <span className="productos-category-preview">{nombres || "Aún no hay productos en este grupo"}{productos.length > 3 ? "…" : ""}</span>
      <span className="productos-category-footer"><span><Check aria-hidden size={14} /> {activos} activos <em>·</em> {productos.length} total</span><span>{precioMedio}</span></span>
    </button>
    {origen ? <ModalFlip origen={origen} ariaLabel={`Administrar ${seccion.titulo}`} onClose={() => { setOrigen(null); trigger.current?.focus(); }}>
      {cerrar => <>
        <header className="productos-modal-header" data-anim>
          <span className="productos-modal-icon"><Icono aria-hidden size={24} /></span>
          <div><p className="productos-section-kicker">{seccion.propia ? "CATEGORÍA PROPIA" : "CATÁLOGO"}</p><h2>{seccion.titulo}</h2><p>{seccion.descripcion} · {productos.length} productos registrados.</p></div>
          <button type="button" className="productos-modal-close" aria-label={`Cerrar ${seccion.titulo}`} onClick={cerrar}><X aria-hidden size={19} /></button>
        </header>
        <div className="productos-modal-body" data-anim>
          <div className="productos-modal-intro"><div><h3>Productos de la categoría <span>{productos.length}</span></h3><p>Actualiza nombre, precio o disponibilidad desde cada ficha.</p></div><div className="productos-modal-price"><CircleDollarSign aria-hidden size={17} /><span>{precioMedio}</span></div></div>
          {productos.length === 0 ? <div className="productos-empty-state"><PackagePlus aria-hidden size={31} /><h3>Esta categoría está lista para estrenar</h3><p>Cierra este modal y crea el primer producto con el botón «Nuevo producto».</p></div> : <div className="productos-modal-products">{productos.map((producto) => <TarjetaProducto key={producto.id} {...producto} />)}</div>}
        </div>
        <footer className="productos-modal-footer" data-anim><span>Los cambios se guardan con cada acción.</span><button type="button" onClick={cerrar}>Listo <Check aria-hidden size={16} /></button></footer>
      </>}
    </ModalFlip> : null}
  </>;
}

export type { ProductoCatalogo };
