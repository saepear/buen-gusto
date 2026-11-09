import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { seleccionPago, serializarPago } from "./datos-pago";
import { PanelPagos } from "./panel-pagos";
import { prepararPeriodoAutomaticamente } from "@/lib/nomina/preparar-liquidacion";
export const metadata = { title: "Pagos · Nómina · El Buen Gusto" };
export default async function PaginaPagos() {
  const sesion = await requerirRol("ADMIN");
  const periodosAbiertos = await db.periodoNomina.findMany({ where: { estado: "ABIERTO" }, select: { id: true } });
  await Promise.all(periodosAbiertos.map((periodo) => prepararPeriodoAutomaticamente(periodo.id, sesion.id)));
  const pagos = await db.liquidacionNomina.findMany({
    select: seleccionPago,
    orderBy: [{ periodo: { fechaDesde: "desc" } }, { id: "desc" }],
  });
  return <PanelPagos pagos={pagos.map(serializarPago)} />;
}
