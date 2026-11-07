import {
  Banknote,
  Bike,
  CalendarClock,
  CalendarDays,
  Clock,
  Coins,
  FileSpreadsheet,
  HandCoins,
  Receipt,
  ShoppingCart,
  Tag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { claveDia, formatCOP, formatFecha, formatHora } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import { datosReporte, ETIQUETA_METODO } from "./datos-reporte";
import { FormularioCierre } from "./boton-cierre";
import { BarraUnidades, GraficoDinero } from "./graficos";

export const metadata = { title: "Reportes" };

const CHIP_METODO: Record<string, string> = {
  EFECTIVO: "bg-success/10 text-success-text ring-1 ring-success/20",
  TARJETA: "bg-info-text/10 text-info-text ring-1 ring-info-text/20",
  TRANSFERENCIA: "bg-violeta-text/10 text-violeta-text ring-1 ring-violeta-text/20",
  FIADO: "bg-warning/10 text-warning-text ring-1 ring-warning/20",
};

export default async function PaginaReportes(
  props: PageProps<"/admin/reportes">,
) {
  // Día a reportar: hoy por defecto; `?fecha=YYYY-MM-DD` pinta un día pasado.
  const { fecha: fechaCruda } = await props.searchParams;
  const hoyClave = claveDia(new Date());
  let fechaFila = inicioDeHoy();
  if (typeof fechaCruda === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaCruda)) {
    const [y, m, d] = fechaCruda.split("-").map(Number);
    fechaFila = new Date(y, m - 1, d);
  }
  const esOtroDia = claveDia(fechaFila) !== hoyClave;

  const {
    pagosHoy,
    propinasHoy,
    pagadoHoy,
    ticketPromedio,
    porMetodo,
    servidas,
    enCocina,
    canceladas,
    proteinasLista,
    extrasLista,
    horasLista,
    dias,
    cierreHoy,
    cierres,
    domiciliosHoy,
    domCobrados,
    domEnCurso,
    domFallidos,
    recaudoDomicilios,
    filasDomicilios,
    // nuevos módulos financieros
    propinasPorMetodo,
    abonosTotal,
    abonosPorMetodo,
    numeroAbonos,
    filasAbonos,
    cuentasCreadasHoy,
    filasCuentasCreadas,
    cxcCreadasCantidad,
    cxcCreadasValor,
    cuentasPendientesLista,
    cxcPendienteTotal,
    // condonaciones del día
    filasCondonaciones,
    numeroCondonaciones,
    cxcCondonadoValorHoy,
    gastosTotal,
    gastosCaja,
    gastosCajaEfectivo,
    gastosExternos,
    filasGastos,
    apartadosCreados,
    apartadosEntregados,
    efectivoDisponible,
  } = await datosReporte(fechaFila);

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        subtitulo={`El pulso del negocio · ${formatFecha(esOtroDia ? fechaFila : new Date())}`}
        acciones={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Exporta EXACTAMENTE el día que se está mirando */}
            <Link
              prefetch={false}
              download
              href={`/admin/reportes/exportar?fecha=${claveDia(fechaFila)}`}
              className="flex items-center gap-2 rounded-2xl bg-success/10 px-4 py-2.5 text-sm font-bold text-success-text ring-1 ring-success/25 transition hover:bg-success/20"
            >
              <FileSpreadsheet aria-hidden className="h-4 w-4" />
              Descargar reporte Excel
            </Link>
            <form
              method="get"
              action="/admin/reportes"
              className="flex items-center gap-1.5"
            >
              <input
                type="date"
                name="fecha"
                defaultValue={claveDia(fechaFila)}
                max={hoyClave}
                aria-label="Día del reporte"
                className="rounded-2xl bg-panel-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app"
              />
              <button
                type="submit"
                title="Ver el reporte de ese día"
                className="rounded-2xl bg-panel-app px-3.5 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
              >
                Ver
              </button>
            </form>
          </div>
        }
      />

      {/* Tiles de hoy */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            nombre: "Ventas del día",
            valor: formatCOP(pagadoHoy),
            Icono: Wallet,
            pista: "Cobranzas de salón, llevar y domicilios",
          },
          {
            nombre: "Abonos recibidos",
            valor: formatCOP(abonosTotal),
            Icono: Coins,
            pista: `Pagos de deudas (${numeroAbonos}) — no son ventas`,
          },
          {
            nombre: "Gastos de caja",
            valor: formatCOP(gastosCaja),
            Icono: ShoppingCart,
            pista: `De ellos ${formatCOP(gastosCajaEfectivo)} en efectivo`,
          },
          {
            nombre: "Efectivo disponible",
            valor: formatCOP(efectivoDisponible),
            Icono: Banknote,
            pista: "Ventas + abonos − gastos en efectivo",
          },
          {
            nombre: "Tickets / pagos",
            valor: String(pagosHoy.length),
            Icono: Receipt,
            pista: `Ticket promedio ${formatCOP(ticketPromedio)}`,
          },
          {
            nombre: "Fiado por cobrar",
            valor: formatCOP(cxcPendienteTotal),
            Icono: HandCoins,
            pista: `Hoy quedaron ${formatCOP(cxcCreadasValor)} fiados nuevos`,
          },
          {
            nombre: "Gastos externos",
            valor: formatCOP(gastosExternos),
            Icono: Tag,
            pista: "Auditados, no tocan la caja",
          },
          {
            nombre: "Propinas",
            valor: formatCOP(propinasHoy),
            Icono: TrendingUp,
            pista: "Además de las ventas",
          },
        ].map((tile) => (
          <div
            key={tile.nombre}
            className="flex items-center gap-4 rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-app text-texto-app">
              <tile.Icono className="h-5.5 w-5.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                {tile.nombre}
              </p>
              <p className="font-display text-2xl text-texto-app">
                {tile.valor}
              </p>
              <p className="truncate text-[10px] text-texto-muted/40">
                {tile.pista}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Chips: métodos y comandas */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[...porMetodo.entries()].map(([m, valor]) => (
          <span
            key={m}
            className={
              "rounded-full px-3 py-1.5 text-xs font-bold " +
              (CHIP_METODO[m] ?? "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app")
            }
          >
            {ETIQUETA_METODO[m] ?? m}: {formatCOP(valor)}
          </span>
        ))}
        {abonosTotal > 0 ? (
          <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/20">
            Abonos de deudas:{" "}
            {[...abonosPorMetodo.entries()]
              .filter(([, v]) => v > 0)
              .map(([m, v]) => `${ETIQUETA_METODO[m] ?? m} ${formatCOP(v)}`)
              .join(" · ")}
          </span>
        ) : null}
        {[...abonosPorMetodo.entries()]
          .filter(([m]) => m === "FIADO")
          .map(([, v]) => (
            <span
              key={"fiado-" + v}
              className={
                "rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning-text ring-1 ring-warning/20"
              }
            >
              Fiado pagado: {formatCOP(v)}
            </span>
          ))}
        <span className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/20">
          <UtensilsCrossed className="h-3.5 w-3.5" /> Servidas: {servidas.length}
        </span>
        {enCocina.length > 0 ? (
          <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning-text ring-1 ring-warning/20">
            En cocina: {enCocina.length}
          </span>
        ) : null}
        {canceladas.length > 0 ? (
          <span className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
            Canceladas: {canceladas.length}
          </span>
        ) : null}
      </div>

      {/* Proteínas y extras */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
          <h2 className="font-display text-lg text-texto-app">
            Almuerzos servidos por proteína
          </h2>
          {proteinasLista.length === 0 ? (
            <p className="mt-3 text-sm text-texto-muted/45">
              Sin almuerzos servidos todavía hoy.
            </p>
          ) : (
            <>
              <div className="mt-4 space-y-3">
                {proteinasLista.map(([nombre, f]) => (
                  <BarraUnidades
                    key={nombre}
                    etiqueta={nombre}
                    unidades={f.unidades}
                    max={Math.max(...proteinasLista.map(([, x]) => x.unidades))}
                    detalle={f.sinSopa > 0 ? `${f.sinSopa} sin sopa` : undefined}
                  />
                ))}
              </div>
              <p className="mt-4 text-xs text-texto-muted/45">
                Cada almuerzo del día se cuenta por su proteína; las comandas
                canceladas no cuentan como ventas.
              </p>
            </>
          )}
        </section>

        <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
          <h2 className="font-display text-lg text-texto-app">
            Extras y bebidas vendidos
          </h2>
          {extrasLista.length === 0 ? (
            <p className="mt-3 text-sm text-texto-muted/45">
              Sin bebidas ni adicionales vendidos hoy.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {extrasLista.map(([nombre, f]) => (
                <BarraUnidades
                  key={nombre}
                  etiqueta={nombre}
                  unidades={f.unidades}
                  max={Math.max(...extrasLista.map(([, x]) => x.unidades))}
                  detalle={formatCOP(f.recaudo)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Gráficos de ventas */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
          <h2 className="flex items-center gap-2 font-display text-lg text-texto-app">
            <Clock className="h-5 w-5 text-texto-muted/70" /> Ingresos por hora
          </h2>
          {horasLista.length > 0 ? (
            <div className="mt-5">
              <GraficoDinero datos={horasLista} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-texto-muted/45">
              Sin pagos registrados hoy.
            </p>
          )}
        </section>

        <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
          <h2 className="flex items-center gap-2 font-display text-lg text-texto-app">
            <CalendarDays className="h-5 w-5 text-texto-muted/70" /> Últimos 7 días
          </h2>
          <div className="mt-5">
            <GraficoDinero datos={dias} />
          </div>
        </section>
      </div>

      {/* Domicilios */}
      <section className="mt-4 rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
        <h2 className="flex items-center gap-2 font-display text-lg text-texto-app">
          <Bike className="h-5 w-5 text-orange-brand" /> Domicilios de hoy
        </h2>

        {domiciliosHoy.length === 0 ? (
          <p className="mt-3 text-sm text-texto-muted/45">
            Todavía no se ha creado ningún domicilio hoy.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-orange-brand/10 px-3 py-1.5 text-xs font-bold text-orange-brand ring-1 ring-orange-brand/20">
                Creados: {domiciliosHoy.length}
              </span>
              <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/20">
                Cobrados: {domCobrados.length} · {formatCOP(recaudoDomicilios)}
              </span>
              {domEnCurso.length > 0 ? (
                <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning-text ring-1 ring-warning/20">
                  Pendientes de cobro: {domEnCurso.length}
                </span>
              ) : null}
              {domFallidos.length > 0 ? (
                <span className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
                  Cancelados: {domFallidos.length}
                </span>
              ) : null}
            </div>

            {/* El listado del día: lo cobrado muestra el dinero que entró */}
            <div className="mt-4 space-y-2">
              {filasDomicilios.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-campo-app px-3.5 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs text-texto-muted/55">
                    {formatHora(d.hora)}
                  </span>
                  <span className="font-bold text-texto-app">
                    #{d.id} · {d.cliente}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-texto-muted/60">
                    {d.direccion}
                    {d.barrio ? ` · ${d.barrio}` : ""}
                  </span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (d.cobradoMonto !== null
                        ? "bg-success/10 text-success-text ring-1 ring-success/20"
                        : d.estadoLabel === "Cancelado"
                          ? "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app"
                          : "bg-warning/10 text-warning-text ring-1 ring-warning/20")
                    }
                  >
                    {d.cobradoMonto !== null ? "Cobrado" : d.estadoLabel}
                  </span>
                  <span className="text-xs font-bold text-texto-app">
                    {d.cobradoMonto !== null ? formatCOP(d.cobradoMonto) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ——— Otros movimientos financieros del día ——— */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Fiados creados hoy (promesas, NO ingreso) */}
        <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
          <h2 className="flex items-center gap-2 font-display text-lg text-texto-app">
            <HandCoins className="h-5 w-5 text-danger-text" /> Fiados del día
          </h2>
          <p className="mt-1 text-xs text-texto-muted/55">
            Lo fiado hoy NO es ingreso de caja: entra el día en que se pague.
          </p>
          {filasCuentasCreadas.length === 0 ? (
            <p className="mt-3 text-sm text-texto-muted/45">
              {cuentasCreadasHoy.length === 0
                ? "Hoy no se fió nada (buena señal para el bolsillo)."
                : "Lo fiado de ese día ya se cobró: no queda nada por cobrar de este día."}
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
                  Deudas nuevas: {cxcCreadasCantidad}
                </span>
                <span className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
                  Valor: {formatCOP(cxcCreadasValor)}
                </span>
                {numeroCondonaciones > 0 ? (
                  <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning ring-1 ring-warning/25">
                    Condonadas: {numeroCondonaciones} · {formatCOP(cxcCondonadoValorHoy)} (no ingreso)
                  </span>
                ) : null}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {filasCuentasCreadas.slice(0, 6).map((c) => (
                  <li key={c.id} className="rounded-xl bg-panel-app px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-texto-app">
                          {c.cliente}
                        </span>
                        <span className="block truncate text-[11px] text-texto-muted/50">
                          {c.origenTipo}
                          {c.pedidoId !== null ? ` #${c.pedidoId}` : ""} · {c.concepto}
                        </span>
                      </span>
                      <strong className="shrink-0 text-danger-text">
                        {formatCOP(c.valorOriginal)}
                      </strong>
                    </div>
                    {c.items.length > 0 ? (
                      <p className="mt-1 text-[11px] text-texto-muted/60">
                        {c.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(" · ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
          {cuentasPendientesLista.length > 0 ? (
            <div className="mt-4 rounded-xl bg-fondo-app p-3">
              <p className="text-xs font-bold text-texto-muted/60">
                Deuda total por cobrar ahora mismo:{" "}
                <span className="font-display text-lg text-danger-text">
                  {formatCOP(cxcPendienteTotal)}
                </span>{" "}
                ({cuentasPendientesLista.length} cuentas)
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-texto-muted/70">
                {cuentasPendientesLista
                  .slice()
                  .sort((a, b) => b.saldo - a.saldo)
                  .slice(0, 5)
                  .map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {c.cliente} — {c.concepto}
                      </span>
                      <span className="shrink-0 font-bold">
                        {formatCOP(c.saldo)}
                      </span>
                    </li>
                  ))}
              </ul>
              <Link
                href="/admin/cuentas"
                className="mt-2 inline-block text-xs font-bold text-amber-brand hover:underline"
              >
                Abrir Cuentas por cobrar →
              </Link>
            </div>
          ) : null}
        </section>

        {/* Abonos + gastos del día */}
        <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
          <h2 className="flex items-center gap-2 font-display text-lg text-texto-app">
            <Coins className="h-5 w-5 text-success-text" /> Pagos de deudas recibidos
          </h2>
          {filasAbonos.length === 0 ? (
            <p className="mt-3 text-sm text-texto-muted/45">
              Hoy no llegó ningún abono de deudas.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {filasAbonos.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-panel-app px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-texto-app">
                      {a.cliente} · {a.metodoLabel}
                    </span>
                    <span className="block truncate text-[11px] text-texto-muted/50">
                      {a.concepto} — {formatHora(a.hora)}
                    </span>
                  </span>
                  <strong className="shrink-0 text-success-text">
                    +{formatCOP(a.monto)}
                  </strong>
                </li>
              ))}
            </ul>
          )}

          {/* Condonaciones del día: se listan aparte del dinero (no son
              ingreso) y de las anulaciones (eso no nace como deuda viva) */}
          {filasCondonaciones.length > 0 ? (
            <div className="mt-3 rounded-xl bg-warning/10 p-3 ring-1 ring-warning/20">
              <p className="text-xs font-bold text-warning">
                Condonaciones de hoy: {numeroCondonaciones} ·{" "}
                {formatCOP(cxcCondonadoValorHoy)} perdonados (no es ingreso ni
                pago)
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-texto-muted/75">
                {filasCondonaciones.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      #{c.id} · {c.cliente} — {c.concepto} · {c.condonadoPor}
                      {c.motivo ? ` · «${c.motivo}»` : ""}
                    </span>
                    <span className="shrink-0 font-bold text-warning">
                      −{formatCOP(c.condonado)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <h2 className="mt-6 flex items-center gap-2 font-display text-lg text-texto-app">
            <ShoppingCart className="h-5 w-5 text-warning-text" /> Gastos del día
          </h2>
          {filasGastos.filter((g) => !g.anulado).length === 0 ? (
            <p className="mt-3 text-sm text-texto-muted/45">
              Hoy no se registraron gastos.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-amber-brand ring-1 ring-warning/20">
                  Total {formatCOP(gastosTotal)} {gastosExternos > 0 ? `(caja: ${formatCOP(gastosCaja)}) (externo: ${formatCOP(gastosExternos)})` : ""}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {filasGastos
                  .filter((g) => !g.anulado)
                  .slice(0, 6)
                  .map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-panel-app px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-texto-app">
                          {g.descripcion}
                        </span>
                        <span className="block truncate text-[11px] text-texto-muted/50">
                          {g.categoriaLabel} · {g.metodoLabel} · {g.origenLabel}
                        </span>
                      </span>
                      <strong className="shrink-0 text-warning-text">
                        −{formatCOP(g.valor)}
                      </strong>
                    </li>
                  ))}
              </ul>
              <Link
                href="/admin/gastos"
                className="mt-2 inline-block text-xs font-bold text-amber-brand hover:underline"
              >
                Ver todos los gastos →
              </Link>
            </>
          )}
        </section>
      </div>

      {/* Apartados */}
      {apartadosCreados > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[2rem] bg-panel-app px-5 py-4 ring-1 ring-borde-app">
          <CalendarClock className="h-5 w-5 text-amber-brand" />
          <span className="text-sm font-bold text-texto-app">
            Apartados del día:
          </span>
          <span className="rounded-full bg-info/10 px-3 py-1.5 text-xs font-bold text-info-text ring-1 ring-info/20">
            Creados: {apartadosCreados}
          </span>
          <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success-text ring-1 ring-success/20">
            Entregados: {apartadosEntregados}
          </span>
          <Link href="/admin/apartados" className="ml-auto text-xs font-bold text-amber-brand hover:underline">
            Ver apartados →
          </Link>
        </div>
      ) : null}

      {/* Cierre de caja */}
      <section className="mt-8 rounded-[2rem] bg-panel-app p-6 ring-1 ring-borde-app">
        <h2 className="font-display text-2xl text-texto-app">Cierre de caja</h2>
        <p className="mt-1 text-sm text-texto-muted/70">
          Congela los totales del sistema de HOY en un comprobante único. Hazlo
          al final del día, cuando ya nadie vaya a cobrar más.
        </p>

        {cierreHoy ? (
          <div className="mt-5 rounded-2xl border border-success/30 bg-success/10 p-5">
            <p className="font-bold text-success-text">
              ✅ Cierre del {cierreHoy.fecha} registrado por{" "}
              {cierreHoy.cerradoPor.nombre} a las{" "}
              {formatHora(cierreHoy.createdAt)}.
            </p>
            <div className="mt-4 grid gap-x-8 gap-y-2 text-sm text-texto-app sm:grid-cols-2">
              <p className="flex justify-between">
                <span>Ventas del día (sin propinas)</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalPagos)}</span>
              </p>
              <p className="flex justify-between">
                <span>Propinas</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalPropinas)}</span>
              </p>
              <p className="flex justify-between">
                <span>Efectivo (ventas)</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalEfectivo)}</span>
              </p>
              <p className="flex justify-between">
                <span>Tarjeta</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalTarjeta)}</span>
              </p>
              <p className="flex justify-between">
                <span>Transferencia</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalTransfer)}</span>
              </p>
              <p className="flex justify-between">
                <span>…de las ventas, domicilios</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalDomicilios)}</span>
              </p>
              <p className="flex justify-between">
                <span>Pagos / comandas servidas</span>
                <span className="font-bold">
                  {cierreHoy.numeroPagos} / {cierreHoy.numeroComandas}
                </span>
              </p>
              {/* Fotografía financiera (cierres nuevos; null = cierre viejo) */}
              {cierreHoy.abonosTotal !== null ? (
                <p className="flex justify-between">
                  <span>Abonos de deudas recibidos</span>
                  <span className="font-bold text-success-text">
                    {formatCOP(cierreHoy.abonosTotal)}
                  </span>
                </p>
              ) : null}
              {cierreHoy.abonosEfectivo !== null && cierreHoy.abonosEfectivo > 0 ? (
                <p className="flex justify-between text-[11px] text-texto-muted/60">
                  <span>…de los abonos en efectivo</span>
                  <span className="font-bold">
                    {formatCOP(cierreHoy.abonosEfectivo)}
                  </span>
                </p>
              ) : null}
              {cierreHoy.totalGastosCaja !== null ? (
                <p className="flex justify-between">
                  <span>Gastos pagados desde caja</span>
                  <span className="font-bold text-warning-text">
                    −{formatCOP(cierreHoy.totalGastosCaja)}
                  </span>
                </p>
              ) : null}
              {cierreHoy.gastosCajaEfectivo !== null && cierreHoy.gastosCajaEfectivo > 0 ? (
                <p className="flex justify-between text-[11px] text-texto-muted/60">
                  <span>…en efectivo de caja</span>
                  <span className="font-bold">
                    {formatCOP(cierreHoy.gastosCajaEfectivo)}
                  </span>
                </p>
              ) : null}
              {cierreHoy.totalGastosExternos !== null && cierreHoy.totalGastosExternos > 0 ? (
                <p className="flex justify-between">
                  <span>Gastos con dinero externo (auditados)</span>
                  <span className="font-bold">
                    {formatCOP(cierreHoy.totalGastosExternos)}
                  </span>
                </p>
              ) : null}
              <p className="flex justify-between sm:col-span-2 border-t border-dashed border-success/30 pt-2">
                <span>Efectivo disponible al cierre</span>
                <span className="font-display text-lg text-texto-app">
                  {formatCOP(
                    cierreHoy.efectivoEsperado ?? Math.max(0, (cierreHoy.totalEfectivo + cierreHoy.totalPropinas + (cierreHoy.abonosEfectivo ?? 0)) - (cierreHoy.gastosCajaEfectivo ?? 0)),
                  )}
                </span>
              </p>
              {cierreHoy.abonosTotal !== null ? (
                <>
                  <p className="flex justify-between">
                    <span>Fiados creados hoy / valor</span>
                    <span className="font-bold text-danger-text">
                      {cierreHoy.cxcCreadasCantidad} /{" "}
                      {formatCOP(cierreHoy.cxcCreadasValor ?? 0)}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span>Deuda total por cobrar al cierre</span>
                    <span className="font-bold text-danger-text">
                      {formatCOP(cierreHoy.cxcTotalPendiente ?? 0)}
                    </span>
                  </p>
                  {cierreHoy.cxcCondonadasCantidad !== null &&
                  cierreHoy.cxcCondonadasCantidad > 0 ? (
                    <p className="flex justify-between">
                      <span>Condonadas hoy (no ingreso)</span>
                      <span className="font-bold text-warning">
                        {cierreHoy.cxcCondonadasCantidad} /{" "}
                        {formatCOP(cierreHoy.cxcCondonadasValor ?? 0)}
                      </span>
                    </p>
                  ) : null}
                  <p className="flex justify-between">
                    <span>Domicilios / apartados del día</span>
                    <span className="font-bold">
                      {cierreHoy.numeroDomicilios ?? 0} /{" "}
                      {cierreHoy.numeroApartados ?? 0} (
                      {cierreHoy.numeroApartadosEntrega ?? 0} entregados)
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span>Gastos registrados / abonos</span>
                    <span className="font-bold">
                      {cierreHoy.numeroGastos ?? 0} / {cierreHoy.numeroAbonos ?? 0}
                    </span>
                  </p>
                </>
              ) : null}
              {cierreHoy.efectivoContado !== null ? (
                <p className="flex justify-between sm:col-span-2">
                  <span>Efectivo contado en caja</span>
                  <span className="font-bold">
                    {formatCOP(cierreHoy.efectivoContado)},{" "}
                    {cierreHoy.efectivoContado - (cierreHoy.efectivoEsperado ?? cierreHoy.totalEfectivo) >= 0
                      ? `sobra ${formatCOP(cierreHoy.efectivoContado - (cierreHoy.efectivoEsperado ?? cierreHoy.totalEfectivo))}`
                      : `faltan ${formatCOP((cierreHoy.efectivoEsperado ?? cierreHoy.totalEfectivo) - cierreHoy.efectivoContado)}`}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-x-8 gap-y-2 rounded-2xl bg-panel-app p-5 text-sm text-texto-app ring-1 ring-borde-app">
            <p className="flex justify-between">
              <span>Ventas de hoy (con propinas)</span>
              <span className="font-bold">{formatCOP(pagadoHoy)}</span>
            </p>
            <p className="flex justify-between text-[11px] text-texto-muted/55">
              <span>…en efectivo</span>
              <span className="font-bold">
                {formatCOP(
                  (porMetodo.get("EFECTIVO") ?? 0) +
                    (propinasPorMetodo.get("EFECTIVO") ?? 0),
                )}
              </span>
            </p>
            <p className="flex justify-between text-[11px] text-texto-muted/55">
              <span>…en tarjeta</span>
              <span className="font-bold">
                {formatCOP(porMetodo.get("TARJETA") ?? 0)}
              </span>
            </p>
            <p className="flex justify-between text-[11px] text-texto-muted/55">
              <span>…en transferencia</span>
              <span className="font-bold">
                {formatCOP(porMetodo.get("TRANSFERENCIA") ?? 0)}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Abonos de deudas (no son ventas)</span>
              <span className="font-bold text-success-text">
                {formatCOP(abonosTotal)}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Gastos de caja (descuentan efectivo)</span>
              <span className="font-bold text-warning-text">
                −{formatCOP(gastosCajaEfectivo)}
              </span>
            </p>
            <p className="flex justify-between border-t border-dashed border-borde-app pt-2">
              <span>Efectivo disponible si cierras ya</span>
              <span className="font-display text-lg text-texto-app">
                {formatCOP(Math.max(0, efectivoDisponible))}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Fiado pendiente de cobro</span>
              <span className="font-bold text-danger-text">
                {formatCOP(cxcPendienteTotal)}
              </span>
            </p>
            <FormularioCierre
              conPagos={
                pagosHoy.length > 0 ||
                numeroAbonos > 0 ||
                filasGastos.length > 0 ||
                cxcCreadasValor > 0
              }
            />
          </div>
        )}
      </section>

      {/* Historial */}
      {cierres.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-3 font-display text-xl text-texto-app">
            Cierres anteriores
          </h2>
          <div className="space-y-2">
            {cierres.map((c) => {
              const diff =
                c.efectivoContado === null
                  ? null
                  : c.efectivoContado - (c.efectivoEsperado ?? c.totalEfectivo);
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-panel-app px-4 py-3 ring-1 ring-borde-app"
                >
                  <span className="text-sm font-bold text-texto-app">
                    {c.fecha}
                  </span>
                  <span className="text-xs text-texto-muted/45">
                    {c.numeroPagos} pagos · {c.numeroComandas} comandas
                  </span>
                  <span className="ml-auto text-sm font-bold text-texto-app">
                    {formatCOP(c.totalPagos + c.totalPropinas)}
                  </span>
                  {diff !== null ? (
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                        (diff >= 0
                          ? "bg-success/10 text-success-text ring-1 ring-success/20"
                          : "bg-danger/10 text-danger-text ring-1 ring-danger/20")
                      }
                    >
                      {diff >= 0 ? "sobra" : "faltan"} {formatCOP(Math.abs(diff))}
                    </span>
                  ) : null}
                  <span className="text-xs text-texto-muted/45">
                    cerró {c.cerradoPor.nombre}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}

