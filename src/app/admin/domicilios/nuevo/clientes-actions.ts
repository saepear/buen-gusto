"use server";

import { db } from "@/lib/db";
import { buscarClientesPagina } from "@/lib/clientes";
import { exigirAdmin } from "@/lib/session";

export type ClienteDomicilio = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  barrio: string;
  referencia: string;
};

export async function buscarClientesDomicilio(termino: string): Promise<ClienteDomicilio[]> {
  await exigirAdmin();
  const { filas } = await buscarClientesPagina(termino.slice(0, 100), 1, 12);
  const fichas = await db.cliente.findMany({
    where: { id: { in: filas.map(f => f.id) } },
    include: {
      domicilios: {
        where: { estado: { not: "CANCELADO" }, pedido: { estado: { not: "CANCELADO" } } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { direccion: true, barrio: true, referencia: true },
      },
    },
  });
  return filas.map(f => {
    const ultima = fichas.find(c => c.id === f.id)?.domicilios[0];
    return {
      id: f.id, nombre: f.nombre, telefono: f.telefono,
      direccion: f.direccion || ultima?.direccion || "",
      barrio: f.barrio || ultima?.barrio || "",
      referencia: ultima?.referencia || "",
    };
  });
}
