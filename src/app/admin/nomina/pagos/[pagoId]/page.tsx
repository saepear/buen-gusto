import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../../navegacion";
import { seleccionPago, serializarPago } from "../datos-pago";
import { ContenidoPago } from "../contenido-pago";
export const metadata = { title: "Pago del empleado · El Buen Gusto" };
export default async function PaginaPago({ params }: { params: Promise<{ pagoId: string }> }) {
  await requerirRol("ADMIN");
  const id = Number((await params).pagoId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const pago = await db.liquidacionNomina.findUnique({ where: { id }, select: seleccionPago });
  if (!pago) notFound();
  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Pago del empleado</h1><Link className="nomina-operationSecondary" href="/admin/nomina/pagos">← Todos los pagos</Link></div>
    <NavegacionNomina actual="/admin/nomina/pagos" />
    <ContenidoPago pago={serializarPago(pago)} />
  </>;
}
