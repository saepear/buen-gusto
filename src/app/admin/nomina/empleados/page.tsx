import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { seleccionPago, serializarPago } from "../pagos/datos-pago";
import { PanelEmpleados } from "./panel-empleados";

export const metadata = { title: "Empleados · Nómina · El Buen Gusto" };

export default async function PaginaEmpleados() {
  await requerirRol("ADMIN");
  const empleados = await db.empleado.findMany({
    orderBy: [{ estado: "asc" }, { nombre: "asc" }],
    include: {
      contratoVersiones: { orderBy: { desde: "desc" } },
      liquidaciones: { select: seleccionPago, orderBy: { periodo: { fechaDesde: "desc" } } },
    },
  });
  return <PanelEmpleados empleados={empleados.map(e => ({
    id: e.id, nombre: `${e.nombre} ${e.apellidos}`, cargo: e.cargo, estado: e.estado,
    documento: `${e.documentoTipo} ${e.documentoNumero}`, ingreso: e.fechaIngreso.toISOString().slice(0, 10),
    retiro: e.fechaRetiro?.toISOString().slice(0, 10) ?? null, motivo: e.estadoMotivo,
    contacto: { id: e.id, nombre: e.nombre, apellidos: e.apellidos, telefono: e.telefono, direccion: e.direccion, cargo: e.cargo, epsNombre: e.epsNombre, fondoPensionName: e.fondoPensionName, arpClase: e.arpClase },
    contrato: { id: e.id, modalidad: e.modalidad, remuneracion: e.remuneracion, salarioMensual: e.salarioMensual, salarioDiario: e.salarioDiario, valorHora: e.valorHora, jornadaSemanalMinutos: e.jornadaSemanalMinutos, periodicidadPago: e.periodicidadPago, diaDescanso: e.diaDescanso, metodoPago: e.metodoPago },
    pagos: e.liquidaciones.map(serializarPago),
    versiones: e.contratoVersiones.map(v => ({ id: v.id, desde: v.desde.toISOString().slice(0, 10), hasta: v.hasta?.toISOString().slice(0, 10) ?? null, motivo: v.motivo, remuneracion: v.remuneracion, valor: v.remuneracion === "DIARIO" ? v.salarioDiario : v.remuneracion === "HORARIO" ? v.valorHora : v.salarioMensual })),
  }))} />;
}
