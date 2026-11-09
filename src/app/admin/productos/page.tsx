import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { getCategoriasPersonalizadas } from "@/lib/config";
import { ExploradorProductos } from "./catalogo";
import "./productos.css";

export default async function PaginaProductos() {
  const productos = await db.producto.findMany();
  const categorias = await getCategoriasPersonalizadas();

  return (
    <div className="productos-shell">
      <EncabezadoPagina
        titulo="Productos"
        subtitulo="Catálogo del restaurante: lo que va al menú del día y lo que se vende aparte"
      />
      <ExploradorProductos
        categorias={categorias}
        productos={productos.map(({ id, nombre, precio, tipo, activo }) => ({ id, nombre, precio, tipo, activo }))}
      />
    </div>
  );
}

