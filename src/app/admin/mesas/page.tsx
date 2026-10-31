import { LayoutGrid } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatHora } from "@/lib/format";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { precioUnitarioItem } from "@/lib/precios";
import { TableroMesas, type MesaDetalle } from "./tablero";

export default async function PaginaMesas() {
  const mesas = await db.mesa.findMany({
    // La mesa virtual de domicilios se gestiona en su propio tablero
    where: { activa: true, esDomicilio: false },
    orderBy: { nombre: "asc" },
  });

  const ids = mesas.map((mesa) => mesa.id);
  const pedidos =
    ids.length === 0
      ? []
      : await db.pedido.findMany({
          where: {
            mesaId: { in: ids },
            estado: { in: ESTADOS_ACTIVOS_PEDIDO },
            createdAt: { gte: inicioDeHoy() },
          },
          include: { items: { include: { producto: true } } },
          orderBy: { createdAt: "asc" },
        });

  const tablero: MesaDetalle[] = mesas.map((mesa) => {
    const propios = pedidos.filter((p) => p.mesaId === mesa.id);
    const items = propios.flatMap((p) => p.items);
    const primero = propios[0];
    return {
      id: mesa.id,
      nombre: mesa.nombre,
      estado: mesa.estado,
      total: items.reduce(
        (suma, item) => suma + precioUnitarioItem(item) * item.cantidad,
        0,
      ),
      // Platos = almuerzos de la mesa (su línea de PROTEINA), no todas las
      // líneas de la comanda: sopa, principio y extras no son platos extra.
      platos: items
        .filter((item) => item.tipo === "PROTEINA")
        .reduce((suma, item) => suma + item.cantidad, 0),
      // Marca de tiempo del primer pedido activo (el cliente calcula los minutos en vivo)
      desde: primero ? primero.createdAt.getTime() : null,
      comandas: propios.map((pedido) => ({
        id: pedido.id,
        hora: formatHora(pedido.createdAt),
        estado: pedido.estado,
        paraLlevar: pedido.paraLlevar,
        observaciones: pedido.observaciones,
        items: pedido.items.map((item) => ({
          nombre: item.producto.nombre,
          cantidad: item.cantidad,
          tipo: item.tipo,
          conSopa: item.conSopa,
          precio: precioUnitarioItem(item),
        })),
      })),
    };
  });

  // Hora de la solicitud: el reloj del tablero nace sincronizado desde el
  // primer pintado, sin estado «null» ni contenido que arranca después
  const ahoraServidor = Date.now();

  return (
    <>
      <EncabezadoPagina
        titulo="Mesas"
        subtitulo="Filtra por estado, busca por nombre y abre una mesa para ver su cuenta en vivo"
      />

      <TableroMesas mesas={tablero} ahoraServidor={ahoraServidor} />

      <p className="mt-6 flex items-center gap-2 text-sm text-texto-muted/45">
        <LayoutGrid className="h-4 w-4" />
        Al cobrar una mesa (caja) volverá a quedar «Libre» automáticamente.
      </p>
    </>
  );
}
