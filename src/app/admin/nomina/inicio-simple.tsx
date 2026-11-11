import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { fechaColombia } from "@/lib/nomina/resumen";
import { proximaFechaPendiente } from "@/lib/nomina/calendario-pago";
import { seleccionPago, serializarPago } from "./pagos/datos-pago";
import { EquipoPagos } from "./equipo-pagos";

export async function InicioSimple() {
  await requerirRol("ADMIN");
  const hoy = fechaColombia(new Date());
  const [empleados, productos, pagos, creditos] = await Promise.all([
    db.empleado.findMany({ where: { estado: "ACTIVO" }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, apellidos: true, cargo: true, salarioMensual: true, periodicidadPago: true, remuneracion: true } }),
    db.producto.findMany({ where: { activo: true }, select: { id: true, nombre: true, precio: true }, orderBy: { nombre: "asc" } }),
    db.liquidacionNomina.findMany({ select: seleccionPago, orderBy: { periodo: { fechaDesde: "desc" } } }),
    db.creditoNomina.findMany({ include: { empleado: { select: { nombre: true, apellidos: true } }, cuotas: { orderBy: { fecha: "asc" } } }, orderBy: { id: "desc" } }),
  ]);
  return <EquipoPagos hoy={hoy} empleados={empleados.map(e => ({ ...e, nombre: `${e.nombre} ${e.apellidos}`, proximo: proximaFechaPendiente(hoy, e.periodicidadPago, pagos.filter(p => p.empleadoId === e.id)) }))} productos={productos} pagos={pagos.map(serializarPago)} creditos={creditos.map(c => ({ id: c.id, empleadoId: c.empleadoId, nombre: `${c.empleado.nombre} ${c.empleado.apellidos}`, monto: c.monto, motivo: c.motivo, cuotas: c.cuotas.map(q => ({ id: q.id, fecha: q.fecha, valor: q.valor ?? 0, aplicada: pagos.some(p => p.id === q.liquidacionId && p.estadoPago === "PAGADO") })) }))} />;
}
