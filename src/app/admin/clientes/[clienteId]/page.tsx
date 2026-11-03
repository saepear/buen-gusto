import { ArrowLeft, PackageOpen, Phone, MapPin, Truck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP, formatHora } from "@/lib/format";
import {
  ESTADO_APARTADO_LABEL,
  ESTADO_CUENTA,
  ESTADO_CUENTA_LABEL,
  ESTADO_DOMICILIO_LABEL,
  type EstadoApartado,
  type EstadoCuenta,
  type EstadoDomicilio,
} from "@/lib/roles";
import { requerirRol } from "@/lib/session";
import { ETIQUETA_METODO } from "@/app/admin/reportes/datos-reporte";
import {
  FormularioAbono,
  FormularioAnularCuenta,
  FormularioNuevaCuenta,
} from "@/app/admin/cuentas/formularios";
import { FormularioEditarCliente } from "./editar";

export const metadata = { title: "Ficha cliente · El Buen Gusto" };

const CHIP_ESTADO_CUENTA: Record<EstadoCuenta, string> = {
  PENDIENTE: "bg-danger/10 text-danger-text ring-1 ring-danger/25",
  PAGADA: "bg-success/10 text-success-text ring-1 ring-success/25",
  ANULADA: "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app",
};

const CHIP_ESTADO_APARTADO: Record<EstadoApartado, string> = {
  PENDIENTE: "bg-info/10 text-info-text ring-1 ring-info/25",
  ENTREGADO: "bg-success/10 text-success-text ring-1 ring-success/25",
  CANCELADO: "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app",
};

const CHIP_ESTADO_DOMICILIO: Record<string, string> = {
  ENTREGADO: "bg-success/10 text-success-text ring-1 ring-success/25",
  CANCELADO: "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app",
  NO_ENTREGADO: "bg-danger/10 text-danger-text ring-1 ring-danger/25",
};

export default async function PaginaFichaCliente(
  props: PageProps<"/admin/clientes/[clienteId]">,
) {
  await requerirRol("ADMIN");
  const { clienteId: crudo } = await props.params;
  const id = Number.parseInt(crudo, 10);
  if (!Number.isInteger(id)) notFound();

  const cliente = await db.cliente.findUnique({
    where: { id },
    include: {
      domicilios: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { pedido: true, domiciliario: true },
      },
      apartados: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { items: true, pedido: true },
      },
      cuentas: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          abonos: { orderBy: { createdAt: "asc" } },
          creadoPor: true,
          anuladaPor: true,
        },
      },
    },
  });
  if (!cliente) notFound();

  const saldoFiado = cliente.cuentas
    .filter((c) => c.estado === ESTADO_CUENTA.PENDIENTE)
    .reduce((s, c) => s + Math.max(0, c.valorOriginal - c.pagado), 0);

  return (
    <>
      <Link
        href="/admin/clientes"
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-texto-muted/60 transition hover:text-amber-brand"
      >
        <ArrowLeft className="h-4 w-4" /> Todos los clientes
      </Link>

      <EncabezadoPagina titulo={cliente.nombre} subtitulo="Ficha del cliente: sus domicilios, apartados y fiados en un solo lugar" />

      <div className="mb-6 flex flex-wrap gap-2.5">
        <span className="rounded-2xl bg-success/10 px-4 py-2.5 text-sm font-bold text-success-text ring-1 ring-success/25">
          {cliente.domicilios.length}{" "}
          {cliente.domicilios.length === 1 ? "domicilio" : "domicilios"}
        </span>
        <span className="rounded-2xl bg-info/10 px-4 py-2.5 text-sm font-bold text-info-text ring-1 ring-info/25">
          {cliente.apartados.length}{" "}
          {cliente.apartados.length === 1 ? "apartado" : "apartados"}
        </span>
        <span
          className={
            "rounded-2xl px-4 py-2.5 text-sm font-bold ring-1 " +
            (saldoFiado > 0
              ? "bg-danger/10 text-danger-text ring-1 ring-danger/25"
              : "bg-panel-app text-texto-muted/60 ring-borde-app")
          }
        >
          Fiado pendiente: {formatCOP(saldoFiado)}
        </span>
      </div>

      {/* Datos de contacto + edición */}
      <section className="mb-8 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-sm text-texto-muted/80">
            {cliente.telefono ? (
              <p className="flex items-center gap-2">
                <Phone aria-hidden className="h-4 w-4 text-texto-muted/40" />
                {cliente.telefono}
              </p>
            ) : (
              <p className="text-xs text-texto-muted/45 italic">
                Sin teléfono (cliente «solo el nombre»)
              </p>
            )}
            {cliente.direccion ? (
              <p className="flex items-center gap-2">
                <MapPin aria-hidden className="h-4 w-4 text-texto-muted/40" />
                {cliente.direccion}
                {cliente.barrio ? ` · ${cliente.barrio}` : ""}
              </p>
            ) : null}
            {cliente.observaciones ? (
              <p className="text-xs italic text-texto-muted/60">
                «{cliente.observaciones}»
              </p>
            ) : null}
          </div>
          <FormularioEditarCliente
            cliente={{
              id: cliente.id,
              nombre: cliente.nombre,
              telefono: cliente.telefono,
              direccion: cliente.direccion,
              barrio: cliente.barrio,
              observaciones: cliente.observaciones,
            }}
          />
        </div>
      </section>

      {/* ════ Fiados ════ */}
      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl text-texto-app">Fiados</h2>
        <FormularioNuevaCuenta
          clienteFijo={{
            id: cliente.id,
            etiqueta: cliente.telefono
              ? `${cliente.nombre} · ${cliente.telefono}`
              : cliente.nombre,
          }}
        />

        {cliente.cuentas.length === 0 ? (
          <p className="mt-4 rounded-2xl border-2 border-dashed border-borde-app bg-panel-app p-6 text-center text-sm text-texto-muted/60">
            Este cliente no tiene deudas registradas.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {cliente.cuentas.map((cuenta) => {
              const saldo = Math.max(0, cuenta.valorOriginal - cuenta.pagado);
              return (
                <article
                  key={cuenta.id}
                  className={
                    "rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app " +
                    (cuenta.estado === ESTADO_CUENTA.ANULADA ? "opacity-60" : "")
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="min-w-0 text-sm text-texto-muted/85">
                      {cuenta.concepto}
                      <span className="ml-2 text-xs text-texto-muted/45">
                        por {cuenta.creadoPor.nombre}
                      </span>
                    </p>
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                        CHIP_ESTADO_CUENTA[cuenta.estado as EstadoCuenta]
                      }
                    >
                      {ESTADO_CUENTA_LABEL[cuenta.estado as EstadoCuenta]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-texto-muted/60">
                    Deuda {formatCOP(cuenta.valorOriginal)} · abonado{" "}
                    <span className="text-success-text">
                      {formatCOP(cuenta.pagado)}
                    </span>
                    {cuenta.estado === ESTADO_CUENTA.PENDIENTE && saldo > 0 ? (
                      <>
                        {" "}· saldo{" "}
                        <span className="font-bold text-danger-text">
                          {formatCOP(saldo)}
                        </span>
                      </>
                    ) : null}
                  </p>

                  {cuenta.abonos.length > 0 ? (
                    <ul className="mt-2.5 space-y-1">
                      {cuenta.abonos.map((a) => (
                        <li
                          key={a.id}
                          className="flex flex-wrap items-center gap-x-3 rounded-xl bg-fondo-app px-3 py-1.5 text-xs text-texto-muted/70"
                        >
                          <strong className="text-success-text">
                            {formatCOP(a.monto)}
                          </strong>
                          <span>{ETIQUETA_METODO[a.metodo] ?? a.metodo}</span>
                          <span className="text-texto-muted/45">
                            {new Date(a.createdAt).toLocaleDateString("es-CO")}{" "}
                            {formatHora(a.createdAt)}
                          </span>
                          {a.nota ? <span className="italic">«{a.nota}»</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {cuenta.estado === ESTADO_CUENTA.PENDIENTE ? (
                    <div className="mt-3 border-t border-borde-app/60 pt-3">
                      <FormularioAbono cuentaId={cuenta.id} saldo={saldo} />
                      <div className="mt-2">
                        <FormularioAnularCuenta cuentaId={cuenta.id} />
                      </div>
                    </div>
                  ) : null}

                  {cuenta.estado === ESTADO_CUENTA.ANULADA ? (
                    <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger-text ring-1 ring-danger/20">
                      Anulada por {cuenta.anuladaPor?.nombre ?? "—"}
                      {cuenta.anuladaMotivo ? ` · «${cuenta.anuladaMotivo}»` : ""}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ════ Apartados ════ */}
      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl text-texto-app">Apartados</h2>
        {cliente.apartados.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-borde-app bg-panel-app p-6 text-center text-sm text-texto-muted/60">
            Este cliente no ha apartado almuerzos todavía.
          </p>
        ) : (
          <div className="space-y-2.5">
            {cliente.apartados.map((ap) => (
              <article
                key={ap.id}
                className="rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-texto-app">
                      #{ap.id} · {formatCOP(ap.total)}
                    </p>
                    <p className="text-xs text-texto-muted/60">
                      {ap.fechaEntrega ? `Para el ${ap.fechaEntrega}` : ""}
                      {ap.horaEntrega ? ` · ${ap.horaEntrega}` : ""}
                      {ap.observaciones ? ` · «${ap.observaciones}»` : ""}
                    </p>
                    <ul className="mt-1.5 space-y-0.5 text-xs text-texto-muted/75">
                      {ap.items.map((it) => (
                        <li key={it.id}>
                          {it.cantidad > 1 ? `${it.cantidad}× ` : ""}
                          {it.nombre}
                          {it.conSopa === false ? " (sin sopa)" : ""}
                          {it.conSopa === true ? " (con sopa)" : ""} —{" "}
                          {formatCOP(it.precio)}
                        </li>
                      ))}
                    </ul>
                    {ap.pedidoId ? (
                      <Link
                        href={`/ordenes/comanda/${ap.pedidoId}`}
                        className="mt-2 inline-block text-xs font-bold text-amber-brand hover:underline"
                      >
                        Ver comanda de la entrega
                      </Link>
                    ) : null}
                  </div>
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      CHIP_ESTADO_APARTADO[ap.estado as EstadoApartado]
                    }
                  >
                    {ESTADO_APARTADO_LABEL[ap.estado as EstadoApartado]}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ════ Domicilios ════ */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-texto-app">
          <Truck className="h-5 w-5 text-amber-brand" /> Domicilios
        </h2>
        {cliente.domicilios.length === 0 ? (
          <p className="flex flex-col items-center rounded-2xl border-2 border-dashed border-borde-app bg-panel-app p-6 text-center text-sm text-texto-muted/60">
            <PackageOpen className="mb-2 h-8 w-8 text-texto-muted/35" />
            Este cliente no tiene domicilios registrado todavía.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl ring-1 ring-borde-app">
            <table className="w-full text-sm">
              <thead className="bg-panel-app text-left text-[11px] uppercase tracking-wide text-texto-muted/50">
                <tr>
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Detalle</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5 text-right">Cobro</th>
                </tr>
              </thead>
              <tbody className="bg-panel-app/60">
                {cliente.domicilios.map((dom) => (
                  <tr key={dom.id} className="border-t border-borde-app/50">
                    <td className="px-4 py-2.5 text-xs text-texto-muted/60">
                      {new Date(dom.createdAt).toLocaleDateString("es-CO")}
                      <br />
                      {formatHora(dom.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs text-texto-muted/80">
                        {dom.direccion}
                        {dom.barrio ? ` · ${dom.barrio}` : ""}
                      </p>
                      {dom.cobradoMetodo ? (
                        <p className="text-xs font-bold text-texto-app">
                          {ETIQUETA_METODO[dom.cobradoMetodo] ?? dom.cobradoMetodo}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          "rounded-full px-2 py-0.5 text-[10px] font-bold " +
                          (CHIP_ESTADO_DOMICILIO[dom.estado] ??
                            "bg-info/10 text-info-text ring-1 ring-info/25")
                        }
                      >
                        {ESTADO_DOMICILIO_LABEL[dom.estado as EstadoDomicilio] ??
                          dom.estado}
                      </span>
                      {dom.notaEntrega ? (
                        <p className="mt-1 text-[10px] italic text-texto-muted/50">
                          {dom.notaEntrega}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-texto-app">
                      {dom.cobradoMonto !== null ? formatCOP(dom.cobradoMonto) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
