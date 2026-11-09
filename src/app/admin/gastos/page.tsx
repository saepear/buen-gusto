import { History, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP, formatHora } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import {
  CATEGORIA_GASTO,
  CATEGORIA_GASTO_LABEL,
  ORIGEN_GASTO,
  ORIGEN_GASTO_LABEL,
} from "@/lib/roles";
import { requerirRol } from "@/lib/session";
import { AccionAnularGasto, FormularioNuevoGasto } from "./formularios";
import { TableroGastos } from "./tablero";
import "./gastos.css";

export const metadata = { title: "Gastos · El Buen Gusto" };

/** Chips de método para los gastos (mismos textos que la caja) */
const ETIQUETA_METODO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

export default async function PaginaGastos(
  props: PageProps<"/admin/gastos">,
) {
  await requerirRol("ADMIN");
  const { desde, hasta, categoria, estado } = await props.searchParams;

  const donde: {
    anulado?: boolean;
    categoria?: string;
    createdAt: { gte: Date; lt?: Date };
  } = { createdAt: { gte: new Date(2020, 0, 1) } };

  if (typeof desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    const [y, m, d] = desde.split("-").map(Number);
    const fechaDesde = new Date(y, m - 1, d);
    let fechaHasta: Date | null = null;
    if (typeof hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      const [yh, mh, dh] = hasta.split("-").map(Number);
      fechaHasta = new Date(yh, mh - 1, dh);
      fechaHasta.setDate(fechaHasta.getDate() + 1);
    }
    donde.createdAt = fechaHasta
      ? { gte: fechaDesde, lt: fechaHasta }
      : { gte: fechaDesde };
  }
  if (typeof categoria === "string" && categoria in CATEGORIA_GASTO) {
    donde.categoria = categoria;
  }
  // estado: "anulados" muestra solo los anulados; por defecto solo activos
  const verAnulados = estado === "anulados";
  donde.anulado = verAnulados;

  const hoy = inicioDeHoy();
  const fechaManana = new Date(hoy);
  fechaManana.setDate(fechaManana.getDate() + 1);

  const [gastos, hoyResumen] = await Promise.all([
    db.gasto.findMany({
      where: donde,
      orderBy: { createdAt: "desc" },
      take: 120,
      include: { registradoPor: true, anuladoPor: true },
    }),
    db.gasto.findMany({
      where: { createdAt: { gte: hoy, lt: fechaManana }, anulado: false },
      select: { valor: true, origen: true, metodo: true, categoria: true },
    }),
  ]);

  const suma = (lista: { valor: number }[]) =>
    lista.reduce((s, g) => s + g.valor, 0);

  const hoyTotal = suma(hoyResumen);
  const hoyCaja = suma(hoyResumen.filter((g) => g.origen === ORIGEN_GASTO.CAJA));
  const hoyCajaEfectivo = suma(
    hoyResumen.filter(
      (g) => g.origen === ORIGEN_GASTO.CAJA && g.metodo === "EFECTIVO",
    ),
  );
  const hoyExterno = suma(
    hoyResumen.filter((g) => g.origen === ORIGEN_GASTO.EXTERNO),
  );
  const totalFiltrado = suma(gastos.filter((g) => !g.anulado));

  return (
    <>
      <EncabezadoPagina
        titulo="Gastos"
        subtitulo="Lo que la casa gasta: desde caja descuenta del efectivo; externo queda auditado"
      />

      <div className="mb-5">
        <FormularioNuevoGasto
          opciones={{
            categorias: Object.values(CATEGORIA_GASTO).map((k) => ({
              valor: k,
              texto: CATEGORIA_GASTO_LABEL[k],
            })),
          }}
        />
      </div>

      {/* Resumen del día */}
      <div className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Gastos de hoy
          </p>
          <p className="font-display text-2xl text-texto-app">
            {formatCOP(hoyTotal)}
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Pagados desde caja
          </p>
          <p className="font-display text-2xl text-warning-text">
            {formatCOP(hoyCaja)}
          </p>
          <p className="text-[11px] text-texto-muted/55">
            de ellos {formatCOP(hoyCajaEfectivo)} en efectivo (descuentan caja)
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Con dinero externo
          </p>
          <p className="font-display text-2xl text-info-text">
            {formatCOP(hoyExterno)}
          </p>
        </div>
        <div className="rounded-2xl bg-panel-app px-4 py-3 ring-1 ring-borde-app">
          <p className="text-[11px] font-bold uppercase tracking-wide text-texto-muted/55">
            Del filtro actual
          </p>
          <p className="font-display text-2xl text-texto-app">
            {formatCOP(totalFiltrado)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <form
        method="get"
        className="mb-6 flex flex-wrap items-end gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app"
      >
        <Link
          href="/admin/gastos"
          className="rounded-xl bg-panel-app px-3 py-2.5 text-sm font-bold text-texto-muted/70 ring-1 ring-borde-app transition hover:bg-panel-hover"
        >
          Ver todo
        </Link>
        <label className="text-xs font-bold text-texto-muted/60">
          DESDE
          <input
            type="date"
            name="desde"
            defaultValue={typeof desde === "string" ? desde : ""}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app"
          />
        </label>
        <label className="text-xs font-bold text-texto-muted/60">
          HASTA
          <input
            type="date"
            name="hasta"
            defaultValue={typeof hasta === "string" ? hasta : ""}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2 text-sm text-texto-app ring-1 ring-borde-app"
          />
        </label>
        <label className="text-xs font-bold text-texto-muted/60">
          CATEGORÍA
          <select
            name="categoria"
            defaultValue={typeof categoria === "string" ? categoria : ""}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app"
          >
            <option value="">Todas</option>
            {Object.values(CATEGORIA_GASTO).map((k) => (
              <option key={k} value={k}>
                {CATEGORIA_GASTO_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-texto-muted/60">
          ESTADO
          <select
            name="estado"
            defaultValue={typeof estado === "string" ? estado : ""}
            className="ml-2 rounded-xl bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app"
          >
            <option value="">Activos (no anulados)</option>
            <option value="anulados">Solo anulados</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
        >
          Filtrar
        </button>
      </form>

      <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-texto-app">
        <ShoppingCart className="h-5 w-5 text-amber-brand" /> Gastos registrados
        ({gastos.length})
      </h2>

      {gastos.length === 0 ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <History className="h-9 w-9 text-texto-muted/40" />
          <p className="mt-4 font-display text-xl text-texto-app">
            Sin gastos por aquí
          </p>
          <p className="mt-1.5 max-w-md text-sm text-texto-muted/70">
            {verAnulados
              ? "Ningún gasto anulado coincide con este filtro."
              : "Registra lo que se compra del negocio con «Registrar gasto»."}
          </p>
        </div>
      ) : (
        <>
        <TableroGastos
          gastos={gastos.map((g) => ({
            id: g.id,
            descripcion: g.descripcion,
            categoria: g.categoria,
            categoriaLabel: CATEGORIA_GASTO_LABEL[g.categoria as keyof typeof CATEGORIA_GASTO] ?? g.categoria,
            metodo: g.metodo,
            metodoLabel: ETIQUETA_METODO[g.metodo] ?? g.metodo,
            origen: g.origen,
            origenLabel: ORIGEN_GASTO_LABEL[g.origen as keyof typeof ORIGEN_GASTO] ?? g.origen,
            valor: g.valor,
            observaciones: g.observaciones,
            anulado: g.anulado,
            anuladoAt: g.anuladoAt?.toISOString() ?? null,
            anuladoMotivo: g.anuladoMotivo,
            anuladoPor: g.anuladoPor?.nombre ?? null,
            createdAt: g.createdAt.toISOString(),
            registradoPor: g.registradoPor.nombre,
          }))}
        />
        <div className="hidden space-y-2" aria-hidden="true">
          {gastos.map((g) => (
            <article
              key={g.id}
              className={
                "rounded-2xl bg-panel-app p-3.5 ring-1 ring-borde-app " +
                (g.anulado ? "opacity-60" : "")
              }
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-texto-app">
                    {g.descripcion}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-texto-muted/60">
                    <span className="rounded-full bg-fondo-app px-2 py-0.5 font-bold text-texto-muted/70 ring-1 ring-borde-app">
                      {CATEGORIA_GASTO_LABEL[g.categoria as keyof typeof CATEGORIA_GASTO] ?? g.categoria}
                    </span>
                    <span>{ETIQUETA_METODO[g.metodo] ?? g.metodo}</span>
                    <span
                      className={
                        g.origen === ORIGEN_GASTO.CAJA
                          ? "font-bold text-warning-text"
                          : "text-info-text"
                      }
                    >
                      {ORIGEN_GASTO_LABEL[g.origen as keyof typeof ORIGEN_GASTO] ?? g.origen}
                    </span>
                    <span>
                      {new Date(g.createdAt).toLocaleDateString("es-CO")}{" "}
                      {formatHora(g.createdAt)} · {g.registradoPor.nombre}
                    </span>
                  </p>
                  {g.observaciones ? (
                    <p className="mt-1 text-[11px] italic text-texto-muted/55">
                      «{g.observaciones}»
                    </p>
                  ) : null}
                  {g.anulado ? (
                    <p className="mt-1 rounded-xl bg-danger/10 px-3 py-1.5 text-[11px] font-bold text-danger-text ring-1 ring-danger/20">
                      Anulado {g.anuladoAt ? new Date(g.anuladoAt).toLocaleDateString("es-CO") : ""}
                      {g.anuladoPor ? ` por ${g.anuladoPor.nombre}` : ""}
                      {g.anuladoMotivo ? ` · «${g.anuladoMotivo}»` : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <strong className="font-display text-lg text-texto-app">
                    {formatCOP(g.valor)}
                  </strong>
                  {g.anulado ? null : <AccionAnularGasto gastoId={g.id} />}
                </div>
              </div>
            </article>
          ))}
        </div>
        </>
      )}
    </>
  );
}
