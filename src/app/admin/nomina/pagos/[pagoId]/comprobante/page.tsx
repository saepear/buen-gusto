import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { formatCOP } from "@/lib/format";
import { FichaPago } from "../../ficha-pago";
import { ImprimirPago } from "../../imprimir";
export const metadata = { title: "Comprobante de pago · El Buen Gusto" };
export default async function Comprobante({ params }: { params: Promise<{ pagoId: string }> }) {
  await requerirRol("ADMIN");
  const id = Number((await params).pagoId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const pago = await db.liquidacionNomina.findUnique({ where: { id }, include: { empleado: true, periodo: true, conceptos: { orderBy: { id: "asc" } } } });
  if (!pago) notFound();
  return <div className="mx-auto max-w-3xl"><div className="mb-5 flex items-center justify-between gap-3"><Link href={`/admin/nomina/pagos/${id}`}>← Volver al pago</Link><ImprimirPago /></div>
    <div data-print-pago><FichaPago pago={pago} /><div className="p-5 text-sm"><p>Estado: {pago.estado === "BORRADOR" ? "En preparación" : pago.estadoPago === "PAGADO" ? "Pagado" : "Confirmado · pendiente de entrega"}.</p><p>Entregado: {formatCOP(pago.pagado)} · Pendiente: {formatCOP(Math.max(pago.netoAPagar - pago.pagado, 0))}</p><p className="mt-4 text-xs">Comprobante interno de pago · El Buen Gusto</p></div></div>
  </div>;
}
