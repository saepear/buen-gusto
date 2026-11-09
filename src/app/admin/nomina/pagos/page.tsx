import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { seleccionPago, serializarPago } from "./datos-pago";
import { PanelPagos } from "./panel-pagos";
export const metadata = { title: "Pagos · Nómina · El Buen Gusto" };
export default async function PaginaPagos() {
  await requerirRol("ADMIN");
  const pagos = await db.liquidacionNomina.findMany({
    select: seleccionPago,
    orderBy: [{ periodo: { fechaDesde: "desc" } }, { id: "desc" }],
  });
  return <PanelPagos pagos={pagos.map(serializarPago)} />;
}
