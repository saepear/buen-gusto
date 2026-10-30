import { LayoutGrid } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { ESTADO_MESA, type EstadoMesa } from "@/lib/roles";

const ESTILO_ESTADO: Record<EstadoMesa, string> = {
  LIBRE: "bg-success/10 text-success-text ring-1 ring-success/20",
  OCUPADA: "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20",
  POR_PAGAR: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
};

export default async function PaginaMesas() {
  const mesas = await db.mesa.findMany({
    // La mesa virtual de domicilios se gestiona en su propio tablero
    where: { activa: true, esDomicilio: false },
    orderBy: { nombre: "asc" },
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
              className="rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app"
            >
              <div className="flex items-center justify-between">
                <span className="truncate font-display text-2xl text-texto-app">
                  {mesa.nombre}
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
              <p className="mt-3 text-sm text-texto-muted/45">
                {estado === ESTADO_MESA.LIBRE
                  ? "Disponible para clientes"
                  : "Revisa la cuenta en la caja"}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm text-texto-muted/45">
        <LayoutGrid className="h-4 w-4" />
        Al cobrar una mesa (caja) volverá a quedar «Libre» automáticamente.
      </p>
    </>
  );
}

