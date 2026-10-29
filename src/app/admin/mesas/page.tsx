import { LayoutGrid } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { ESTADO_MESA, type EstadoMesa } from "@/lib/roles";

const ESTILO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "bg-success/15 text-success-dark",
  OCUPADA: "bg-orange-brand/15 text-orange-brand",
  POR_PAGAR: "bg-warning/15 text-amber-700",
};

export default async function PaginaMesas() {
  const mesas = await db.mesa.findMany({
    where: { activa: true },
    orderBy: { numero: "asc" },
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Mesas"
        subtitulo="Estado en vivo de las mesas del restaurante"
      />

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {mesas.map((mesa) => {
          const estado = mesa.estado as EstadoMesa;
          return (
            <div
              key={mesa.id}
              className="rounded-2xl bg-white p-5 ring-1 ring-cream-300"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-4xl text-brown-800">
                  #{mesa.numero}
                </span>
                <span
                  className={
                    "rounded-full px-3 py-1 text-xs font-bold " +
                    ESTILO_ESTADO[estado]
                  }
                >
                  {estado === ESTADO_MESA.LIBRE
                    ? "Libre"
                    : estado === ESTADO_MESA.OCUPADA
                      ? "Ocupada"
                      : "Por pagar"}
                </span>
              </div>
              <p className="mt-3 text-sm text-brown-500">
                {estado === ESTADO_MESA.LIBRE
                  ? "Disponible para clientes"
                  : "Revisa la cuenta en la caja"}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-brown-500">
        <LayoutGrid className="h-4 w-4" />
        Al cobrar una mesa (caja) volverá a quedar «Libre» automáticamente.
      </p>
    </>
  );
}
