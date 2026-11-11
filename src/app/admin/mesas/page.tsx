import { LayoutGrid } from "lucide-react";
import { db } from "@/lib/db";
import { formatHora } from "@/lib/format";
import { numeroVisible } from "@/lib/consecutivos";
import { ESTADOS_ACTIVOS_PEDIDO, inicioDeHoy } from "@/lib/pedido";
import { precioUnitarioItem, nombreDeItem } from "@/lib/precios";
import { ordenMesasPorNombre } from "@/lib/mesas";
import { ordenDeItem } from "@/lib/roles";
import { TableroMesas, type MesaDetalle } from "./tablero";

export default async function PaginaMesas() {
  const mesasBrutas = await db.mesa.findMany({
    // La mesa virtual de domicilios se gestiona en su propio tablero
    where: { activa: true, esDomicilio: false, esApartado: false },
  });
  // Orden natural: "Mesa 2" antes que "Mesa 10" (la BD ordena como texto)
  const mesas = ordenMesasPorNombre(mesasBrutas);

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
        numero: numeroVisible(pedido),
        hora: formatHora(pedido.createdAt),
        estado: pedido.estado,
        paraLlevar: pedido.paraLlevar,
        observaciones: pedido.observaciones,
        // Orden de lectura de la comanda: principio, proteína, ensalada
        // (si la hay) y sopa (si la hay); después adicionales y bebidas
        items: [...pedido.items]
          .sort((a, b) => ordenDeItem(a.tipo) - ordenDeItem(b.tipo) || a.id - b.id)
          .map((item) => ({
          nombre: nombreDeItem(item),
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
  // eslint-disable-next-line react-hooks/purity -- Server Component: fija la hora de esta solicitud para hidratar el reloj.
  const ahoraServidor = Date.now();

  return (
    <>
      <TableroMesas mesas={tablero} ahoraServidor={ahoraServidor} />

      <p className="mt-6 flex items-center gap-2 text-sm text-texto-muted/45">
        <LayoutGrid className="h-4 w-4" />
        Al cobrar una mesa (caja) volverá a quedar «Libre» automáticamente.
      </p>
    </>
  );
}
