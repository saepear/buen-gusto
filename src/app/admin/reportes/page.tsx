import {
  Bike,
  CalendarDays,
  Clock,
  Coins,
  Receipt,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { claveDia, formatCOP, formatFecha, formatHora } from "@/lib/format";
import { precioUnitarioItem } from "@/lib/precios";
import { inicioDeHoy } from "@/lib/pedido";
import {
  ESTADO_DOMICILIO,
  ESTADOS_ACTIVOS_DOMICILIO,
  METODOS_PAGO,
} from "@/lib/roles";
import { FormularioCierre } from "./boton-cierre";
import { BarraUnidades, GraficoDinero } from "./graficos";

export const metadata = { title: "Reportes" };

const METODO_TXT: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

const CHIP_METODO: Record<string, string> = {
  EFECTIVO: "bg-success/10 text-success-text ring-1 ring-success/20",
  TARJETA: "bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20",
  TRANSFERENCIA: "bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20",
};

export default async function PaginaReportes() {
  const fecha = inicioDeHoy();
  const desdeSemana = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return d;
  })();

  const [pagosHoy, pedidosHoy, pagosSemana, cierres, domiciliosHoy] =
    await Promise.all([
      db.pago.findMany({
        where: { createdAt: { gte: fecha } },
        orderBy: { createdAt: "asc" },
      }),
      db.pedido.findMany({
        where: { createdAt: { gte: fecha } },
        include: { items: { include: { producto: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.pago.findMany({
        where: { createdAt: { gte: desdeSemana } },
        orderBy: { createdAt: "asc" },
      }),
      db.cierreCaja.findMany({
        orderBy: { fecha: "desc" },
        take: 7,
        include: { cerradoPor: true },
      }),
      db.domicilio.findMany({
        where: { createdAt: { gte: fecha } },
        include: { domiciliario: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  // ---- Resumen de hoy ----
  const totalPagos = pagosHoy.reduce((s, p) => s + p.total, 0);
  const propinasHoy = pagosHoy.reduce((s, p) => s + p.propina, 0);
  const pagadoHoy = totalPagos + propinasHoy;
  const porMetodo = new Map<string, number>();
  for (const m of METODOS_PAGO) porMetodo.set(m, 0);
  for (const p of pagosHoy) {
    porMetodo.set(p.metodo, (porMetodo.get(p.metodo) ?? 0) + p.total);
  }
  const ticketPromedio =
    pagosHoy.length > 0 ? Math.round(pagadoHoy / pagosHoy.length) : 0;

  // ---- Comandas de hoy ----
  const servidas = pedidosHoy.filter(
    (p) => p.estado === "SERVIDO" || p.estado === "COBRADO",
  );
  const enCocina = pedidosHoy.filter((p) =>
    ["ENVIADO", "EN_PREPARACION", "PARCIAL_SERVIDO", "POR_PAGAR"].includes(
      p.estado,
    ),
  );
  const canceladas = pedidosHoy.filter((p) => p.estado === "CANCELADO");

  // ---- Almuerzos por proteína (solo lo que llegó a la mesa) ----
  const porProteina = new Map<string, { unidades: number; sinSopa: number }>();
  const extras = new Map<string, { unidades: number; recaudo: number }>();
  for (const pedido of servidas) {
    for (const item of pedido.items) {
      if (item.tipo === "PROTEINA") {
        const fila = porProteina.get(item.producto.nombre) ?? {
          unidades: 0,
          sinSopa: 0,
        };
        fila.unidades += item.cantidad;
        if (item.conSopa === false) fila.sinSopa += item.cantidad;
        porProteina.set(item.producto.nombre, fila);
      } else if (precioUnitarioItem(item) > 0) {
        const fila = extras.get(item.producto.nombre) ?? {
          unidades: 0,
          recaudo: 0,
        };
        fila.unidades += item.cantidad;
        fila.recaudo += precioUnitarioItem(item) * item.cantidad;
        extras.set(item.producto.nombre, fila);
      }
    }
  }
  const proteinasLista = [...porProteina.entries()].sort(
    (a, b) => b[1].unidades - a[1].unidades,
  );
  const extrasLista = [...extras.entries()].sort(
    (a, b) => b[1].recaudo - a[1].recaudo,
  );

  // ---- Ingresos por hora (de los pagos) ----
  const porHora = new Map<number, number>();
  for (const pago of pagosHoy) {
    const h = pago.createdAt.getHours();
    porHora.set(h, (porHora.get(h) ?? 0) + pago.total + pago.propina);
  }
  const horasLista = [...porHora.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, valor]) => ({
      etiqueta: `${h} h`,
      valor,
    }));

  // ---- Últimos 7 días ----
  const claveHoy = claveDia(new Date());
  const porDia = new Map<string, number>();
  for (const pago of pagosSemana) {
    const k = claveDia(pago.createdAt);
    porDia.set(k, (porDia.get(k) ?? 0) + pago.total + pago.propina);
  }
  const dias = [...Array(7).keys()].map((i) => {
    const d = new Date(desdeSemana);
    d.setDate(d.getDate() + i);
    const k = claveDia(d);
    return {
      etiqueta: d.toLocaleDateString("es-CO", { weekday: "short" }),
      valor: porDia.get(k) ?? 0,
      resaltar: k === claveHoy,
    };
  });

  // ---- Cierre de caja ----
  const cierreHoy = cierres.find((c) => c.fecha === claveHoy);

  // ---- Domicilios de hoy ----
  const domActivos = new Set<string>(ESTADOS_ACTIVOS_DOMICILIO);
  const domEntregados = domiciliosHoy.filter(
    (d) => d.estado === ESTADO_DOMICILIO.ENTREGADO,
  );
  const domEnCurso = domiciliosHoy.filter((d) => domActivos.has(d.estado));
  const domFallidos = domiciliosHoy.filter(
    (d) =>
      d.estado === ESTADO_DOMICILIO.NO_ENTREGADO ||
      d.estado === ESTADO_DOMICILIO.CANCELADO,
  );
  const recaudoDomicilios = domEntregados.reduce(
    (s, d) => s + (d.cobradoMonto ?? 0),
    0,
  );
  const porRepartidor = new Map<string, { entregas: number; recaudo: number }>();
  for (const d of domEntregados) {
    const nombre = d.domiciliario?.nombre ?? "Sin asignar";
    const fila = porRepartidor.get(nombre) ?? { entregas: 0, recaudo: 0 };
    fila.entregas += 1;
    fila.recaudo += d.cobradoMonto ?? 0;
    porRepartidor.set(nombre, fila);
  }
  const repartidoresLista = [...porRepartidor.entries()].sort(
    (a, b) => b[1].entregas - a[1].entregas,
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Reportes"
        subtitulo={`El pulso del negocio · ${formatFecha(new Date())}`}
      />

      {/* Tiles de hoy */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            nombre: "Cobrado hoy",
            valor: formatCOP(pagadoHoy),
            Icono: Wallet,
          },
          {
            nombre: "Pagos",
            valor: String(pagosHoy.length),
            Icono: Receipt,
          },
          {
            nombre: "Propinas",
            valor: formatCOP(propinasHoy),
            Icono: Coins,
          },
          {
            nombre: "Ticket promedio",
            valor: formatCOP(ticketPromedio),
            Icono: TrendingUp,
          },
        ].map((tile) => (
          <div
            key={tile.nombre}
            className="flex items-center gap-4 rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-panel-app text-texto-app">
              <tile.Icono className="h-5.5 w-5.5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/40">
                {tile.nombre}
              </p>
              <p className="font-display text-2xl text-texto-app">
                {tile.valor}
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
            {METODO_TXT[m] ?? m}: {formatCOP(valor)}
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
                Entregados: {domEntregados.length} · {formatCOP(recaudoDomicilios)}
              </span>
              {domEnCurso.length > 0 ? (
                <span className="rounded-full bg-warning/10 px-3 py-1.5 text-xs font-bold text-warning-text ring-1 ring-warning/20">
                  En curso: {domEnCurso.length}
                </span>
              ) : null}
              {domFallidos.length > 0 ? (
                <span className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger-text ring-1 ring-danger/20">
                  No entregados / cancelados: {domFallidos.length}
                </span>
              ) : null}
            </div>

            {repartidoresLista.length > 0 ? (
              <div className="mt-4 space-y-3">
                {repartidoresLista.map(([nombre, f]) => (
                  <BarraUnidades
                    key={nombre}
                    etiqueta={nombre}
                    unidades={f.entregas}
                    max={Math.max(...repartidoresLista.map(([, x]) => x.entregas))}
                    detalle={formatCOP(f.recaudo)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-texto-muted/45">
                Aún no se ha entregado ningún domicilio hoy.
              </p>
            )}
          </>
        )}
      </section>

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
                <span>Total pagos (sin propinas)</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalPagos)}</span>
              </p>
              <p className="flex justify-between">
                <span>Propinas</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalPropinas)}</span>
              </p>
              <p className="flex justify-between">
                <span>Efectivo</span>
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
                <span>…de los cuales, domicilios</span>
                <span className="font-bold">{formatCOP(cierreHoy.totalDomicilios)}</span>
              </p>
              <p className="flex justify-between">
                <span>Pagos / comandas servidas</span>
                <span className="font-bold">
                  {cierreHoy.numeroPagos} / {cierreHoy.numeroComandas}
                </span>
              </p>
              {cierreHoy.efectivoContado !== null ? (
                <p className="flex justify-between sm:col-span-2">
                  <span>Efectivo contado en caja</span>
                  <span className="font-bold">
                    {formatCOP(cierreHoy.efectivoContado)},{" "}
                    {cierreHoy.efectivoContado - cierreHoy.totalEfectivo >= 0
                      ? `sobra ${formatCOP(cierreHoy.efectivoContado - cierreHoy.totalEfectivo)}`
                      : `faltan ${formatCOP(cierreHoy.totalEfectivo - cierreHoy.efectivoContado)}`}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-x-8 gap-y-2 rounded-2xl bg-panel-app p-5 text-sm text-texto-app ring-1 ring-borde-app">
            <p className="flex justify-between">
              <span>Efectivo</span>
              <span className="font-bold">
                {formatCOP(porMetodo.get("EFECTIVO") ?? 0)}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Tarjeta</span>
              <span className="font-bold">
                {formatCOP(porMetodo.get("TARJETA") ?? 0)}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Transferencia</span>
              <span className="font-bold">
                {formatCOP(porMetodo.get("TRANSFERENCIA") ?? 0)}
              </span>
            </p>
            <p className="flex justify-between border-t border-dashed border-borde-app pt-2">
              <span>Total con propinas</span>
              <span className="font-bold">{formatCOP(pagadoHoy)}</span>
            </p>
            <FormularioCierre conPagos={pagosHoy.length > 0} />
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
                  : c.efectivoContado - c.totalEfectivo;
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

