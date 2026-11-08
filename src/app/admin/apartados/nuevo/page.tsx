import { ArrowLeft, CalendarClock, Sparkles } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { inicioDeHoy } from "@/lib/pedido";
import { requerirRol } from "@/lib/session";
import { menuDeFechaApartado } from "../actions";
import { FormularioApartado } from "../formularios";
import "../apartados.css";

export const metadata = { title: "Nuevo apartado · El Buen Gusto" };

export default async function PaginaNuevoApartado() {
  await requerirRol("ADMIN");
  const hoy = inicioDeHoy();
  const fechaHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  // La semilla de HOY pasa por la MISMA acción que recarga al cambiar la
  // fecha: un solo punto de disponibilidad (stock − vendidos − reservados)
  const [semilla, catalogoExtras, clientes] = await Promise.all([
    menuDeFechaApartado(fechaHoy),
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

  return (
    <div className="apartados-shell apartados-new-shell">
      <header className="apartados-hero apartados-new-hero">
        <span className="apartados-hero-icon" aria-hidden><CalendarClock /></span>
        <div className="min-w-0 flex-1">
          <p className="apartados-eyebrow">NUEVA RESERVA</p>
          <h1>Nuevo apartado</h1>
          <p>Elige el cliente, arma el pedido y deja lista su entrega.</p>
        </div>
        <span className="apartados-guide-chip"><Sparkles aria-hidden /> Precio protegido</span>
        <Link href="/admin/apartados" className="apartados-secondary-action">
          <ArrowLeft aria-hidden /> Volver
        </Link>
      </header>
      <FormularioApartado
        menu={semilla.existeMenu ? semilla.componentes : null}
        fechaHoy={fechaHoy}
        extras={catalogoExtras.map((p) => ({
          productoId: p.id,
          nombre: p.nombre,
          precio: p.precio,
          tipo: p.tipo,
        }))}
        clientes={clientes}
      />
    </div>
  );
}
