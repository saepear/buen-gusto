import { db } from "@/lib/db";
import { ESTADOS_ACTIVOS_PEDIDO } from "@/lib/pedido";
import { type EstadoMesa } from "@/lib/roles";
import { ordenMesasPorNombre } from "@/lib/mesas";
import { requerirRol } from "@/lib/session";
import { EncabezadoMesero } from "./encabezado";
import { TableroMesero } from "./tablero-mesero";

export const metadata = { title: "Mesero · El Buen Gusto" };

export default async function PaginaMesero() {
  const sesion = await requerirRol("MESERO");
  const [mesasBrutas, comandas] = await Promise.all([
    db.mesa.findMany({
      // La mesa virtual de domicilios no es una mesa del salón
      where: { activa: true, esDomicilio: false, esApartado: false },
    }),
    db.pedido.findMany({
      where: {
        estado: { in: ESTADOS_ACTIVOS_PEDIDO },
      },
      select: { mesaId: true, estado: true },
    }),
  ]);

  // Orden natural: "Mesa 2" antes que "Mesa 10" (la BD ordena como texto)
  const mesas = ordenMesasPorNombre(mesasBrutas);

  const vivasPorMesa = new Map<number, number>();
  for (const c of comandas) {
    vivasPorMesa.set(c.mesaId, (vivasPorMesa.get(c.mesaId) ?? 0) + 1);
  }

  return (
    <div className="min-h-screen bg-fondo-app">
      <EncabezadoMesero usuario={sesion.nombre} titulo="Mis mesas" />
      <TableroMesero
        usuario={sesion.nombre}
        mesas={mesas.map((mesa) => ({
          id: mesa.id,
          nombre: mesa.nombre,
          estado: mesa.estado as EstadoMesa,
          comandas: vivasPorMesa.get(mesa.id) ?? 0,
        }))}
      />
    </div>
  );
}

