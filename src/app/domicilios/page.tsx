import { db } from "@/lib/db";
import { formatCOP, formatHora } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import { precioUnitarioItem } from "@/lib/precios";
import { ESTADO_DOMICILIO, ESTADOS_ACTIVOS_DOMICILIO } from "@/lib/roles";
import { requerirRol } from "@/lib/session";
import { EncabezadoMesero } from "@/app/mesero/encabezado";
import { ListaDomiciliario, type EntregaVista } from "./lista";

export const metadata = { title: "Mis domicilios · El Buen Gusto" };

export default async function PaginaMisDomicilios() {
  const sesion = await requerirRol("DOMICILIARIO");

  const domicilios = await db.domicilio.findMany({
    where: {
      domiciliarioId: sesion.id,
      OR: [
        { estado: { in: ESTADOS_ACTIVOS_DOMICILIO } },
        { createdAt: { gte: inicioDeHoy() } },
      ],
    },
    include: {
      pedido: { include: { items: { include: { producto: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const vistas: EntregaVista[] = domicilios.map((d) => {
    const items = d.pedido.items.filter((i) => i.cantidad > 0);
    const total =
      d.cobradoMonto ??
      items.reduce((suma, i) => suma + precioUnitarioItem(i) * i.cantidad, 0);
    const resumen =
      items
        .map((i) =>
          i.cantidad > 1 ? `${i.cantidad}× ${i.producto.nombre}` : i.producto.nombre,
        )
        .join(" · ") || "Sin ítems";
    return {
      id: d.id,
      estado: d.estado,
      cliente: d.cliente,
      telefono: d.telefono,
      direccion: d.direccion,
      barrio: d.barrio,
      referencia: d.referencia,
      horaEntrega: d.horaEntrega,
      observaciones: d.pedido.observaciones,
      notaEntrega: d.notaEntrega,
      total,
      creadoEn: formatHora(d.createdAt),
      resumen,
    };
  });

  const porSalir = vistas.filter((d) => d.estado === ESTADO_DOMICILIO.ASIGNADO);
  const enCamino = vistas.filter((d) => d.estado === ESTADO_DOMICILIO.EN_CAMINO);
  const historial = vistas.filter((d) => d.estado === ESTADO_DOMICILIO.ENTREGADO);

  const totalCobrado = historial.reduce((suma, d) => suma + d.total, 0);

  return (
    <div className="min-h-screen bg-fondo-app">
      <EncabezadoMesero usuario={sesion.nombre} etiqueta="Domiciliario" />

      <main className="mx-auto max-w-lg space-y-3.5 p-4 pb-24 sm:max-w-2xl sm:p-6">
        <div className="flex items-center justify-between rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <span className="text-sm text-texto-muted/60">
            Cobrado hoy · {historial.length}{" "}
            {historial.length === 1 ? "entrega" : "entregas"}
          </span>
          <span className="font-display text-xl text-success-text">
            {formatCOP(totalCobrado)}
          </span>
        </div>

        <ListaDomiciliario
          enCamino={enCamino}
          porSalir={porSalir}
          historial={historial}
        />
      </main>
    </div>
  );
}
