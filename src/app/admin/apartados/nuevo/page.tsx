import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { inicioDeHoy } from "@/lib/pedido";
import { requerirRol } from "@/lib/session";
import type { ComponenteMenuApartado } from "../actions";
import { FormularioApartado } from "../formularios";

export const metadata = { title: "Nuevo apartado · El Buen Gusto" };

export default async function PaginaNuevoApartado() {
  await requerirRol("ADMIN");
  const hoy = inicioDeHoy();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const [menu, catalogoExtras, clientes] = await Promise.all([
    db.menuDia.findUnique({
      where: { fecha: fechaHoy },
      include: { items: { include: { producto: true } } },
    }),
    db.producto.findMany({
      where: { activo: true, tipo: { in: ["BEBIDA", "ADICIONAL"] }, precio: { gt: 0 } },
      orderBy: { nombre: "asc" },
    }),
    // Semilla del picker: los 12 más recientes; al escribir, la búsqueda va
    // EN BASE (buscarClientesApartado) sin el límite de 300 fichas.
    db.cliente.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: { id: true, nombre: true, telefono: true },
    }),
  ]);

  // El menú completo de hoy (no solo proteínas): cada componente del plato se
  // arma aquí al abrir y se recarga por fecha con menuDeFechaApartado
  const menuHoy: ComponenteMenuApartado[] = (menu?.items ?? [])
    .filter(
      (i) =>
        i.producto.activo &&
        i.visible &&
        ["PROTEINA", "PRINCIPIO", "ENSALADA", "SOPA"].includes(i.producto.tipo),
    )
    .map((i) => ({
      itemId: i.id,
      productoId: i.productoId,
      nombre: i.producto.nombre,
      tipo: i.producto.tipo,
      // Precio especial de HOY (asados del domingo…) o el propio del catálogo;
      // 0 = rige el precio del almuerzo corriente para llevar
      precioPropio:
        i.precioEspecial ?? (i.producto.precio > 0 ? i.producto.precio : 0),
      disponibles:
        i.stockPorciones === null
          ? null
          : Math.max(0, i.stockPorciones - i.vendidos),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <>
      <Link
        href="/admin/apartados"
        className="mb-4 inline-block text-sm font-bold text-texto-muted/60 transition hover:text-amber-brand"
      >
        ← Volver a los apartados
      </Link>
      <EncabezadoPagina
        titulo="Nuevo apartado"
        subtitulo="Reserva lo que el cliente pedirá después: el precio queda congelado al apartar"
      />
      <FormularioApartado
        menu={menu ? menuHoy : null}
        fechaHoy={fechaHoy}
        extras={catalogoExtras.map((p) => ({
          productoId: p.id,
          nombre: p.nombre,
          precio: p.precio,
          tipo: p.tipo,
        }))}
        clientes={clientes}
      />
    </>
  );
}
