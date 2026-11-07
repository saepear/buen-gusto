import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";
export const metadata = { title: "Configuración · Nómina · El Buen Gusto" };
export default async function PaginaConfiguracion() {
  await requerirRol("ADMIN");
  return (
    <>
      <EncabezadoPagina
        titulo="Configuración de nómina"
        subtitulo="Salarios, cortes y ajustes de los pagos del restaurante"
      />
      <NavegacionNomina actual="/admin/nomina/configuracion" />
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            titulo: "Ciclos de pago",
            texto:
              "Cortes 1–7, 8–14, 15–21 y 22–fin. La fecha prevista de pago se puede definir al crear el período. Se conservan los períodos históricos.",
            href: "/admin/nomina/periodos",
            accion: "Gestionar ciclos",
          },
          {
            titulo: "Salarios y descanso semanal",
            texto:
              "Los contratos conservan salario, modalidad de remuneración y día de descanso por empleado, con historial de cambios.",
            href: "/admin/nomina/empleados",
            accion: "Gestionar empleados",
          },
          {
            titulo: "Reportes",
            texto:
              "Pagos y deducciones por empleado o rango de fechas, con exportación a Excel.",
            href: "/admin/nomina/reportes",
            accion: "Consultar reportes",
          },
        ].map((c) => (
          <section
            key={c.href}
            className="rounded-2xl bg-panel-app p-5 ring-1 ring-borde-app"
          >
            <h2 className="font-display text-xl">{c.titulo}</h2>
            <p className="mt-2 text-sm leading-relaxed text-texto-muted">
              {c.texto}
            </p>
            <Link
              href={c.href}
              className="mt-4 inline-block rounded-xl bg-amber-brand px-4 py-2 text-sm font-bold text-brown-950"
            >
              {c.accion} →
            </Link>
          </section>
        ))}
      </div>
    </>
  );
}
