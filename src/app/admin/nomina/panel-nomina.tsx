"use client";

import { useState, useActionState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  UsersRound,
  CalendarDays,
  Ticket,
  Search,
  ChevronRight,
  BriefcaseBusiness,
  Clock3,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  CircleCheck,
  AlertTriangle,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import { formatCOP } from "@/lib/format";
import { salarioDelCiclo } from "@/lib/nomina/salario-ciclo";
import { NavegacionNomina } from "./navegacion";
import { crearPeriodo } from "./periodos/actions";
import { BotonLiquidarEmpleado } from "./periodos/formularios";
import "./panel-nomina.css";
const s = {
  createCycle: "nomina-createCycle",
  primary: "nomina-primary",
  dashboard: "nomina-dashboard",
  header: "nomina-header",
  titleGroup: "nomina-titleGroup",
  titleIcon: "nomina-titleIcon",
  eyebrow: "nomina-eyebrow",
  subtitle: "nomina-subtitle",
  headerActions: "nomina-headerActions",
  secondary: "nomina-secondary",
  cycleSection: "nomina-cycleSection",
  month: "nomina-month",
  cycleOptions: "nomina-cycleOptions",
  cycle: "nomina-cycle",
  cycleContext: "nomina-cycleContext",
  stats: "nomina-stats",
  stat: "nomina-stat",
  statIcon: "nomina-statIcon",
  paymentSummary: "nomina-paymentSummary",
  warning: "nomina-warning",
  workspace: "nomina-workspace",
  panel: "nomina-panel",
  panelHeading: "nomina-panelHeading",
  muted: "nomina-muted",
  filters: "nomina-filters",
  search: "nomina-search",
  filter: "nomina-filter",
  employeeList: "nomina-employeeList",
  employee: "nomina-employee",
  avatar: "nomina-avatar",
  employeeText: "nomina-employeeText",
  active: "nomina-active",
  inactive: "nomina-inactive",
  empty: "nomina-empty",
  detailColumn: "nomina-detailColumn",
  profile: "nomina-profile",
  bigAvatar: "nomina-bigAvatar",
  profileTitle: "nomina-profileTitle",
  detailTabs: "nomina-detailTabs",
  profileGrid: "nomina-profileGrid",
  facts: "nomina-facts",
  amountCard: "nomina-amountCard",
  amountLine: "nomina-amountLine",
  voucher: "nomina-voucher",
  footnote: "nomina-footnote",
  textLink: "nomina-textLink",
  notice: "nomina-notice",
  actions: "nomina-actions",
  bottomGrid: "nomina-bottomGrid",
  paymentDate: "nomina-paymentDate",
  quickActions: "nomina-quickActions",
  legal: "nomina-legal",
};

type Vale = {
  id: number;
  productoNombre: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  fecha: string;
  estado: string;
};
type Empleado = {
  id: number;
  nombre: string;
  apellidos: string;
  cargo: string;
  estado: string;
  documentoTipo: string;
  documentoNumero: string;
  fechaIngreso: string;
  remuneracion: string;
  salarioMensual: number;
  salarioDiario: number;
  valorHora: number;
  diaDescanso: number;
  metodoPago: string;
  minutos: number;
  vales: Vale[];
  valesPendientes: number;
  valesAutorizados: number;
  valesDescontados: number;
  netoEstimado: number | null;
  saldoEstimado: number | null;
  requiereRecalculo: boolean;
  liquidacion: null | {
    id: number;
    estado: string;
    estadoPago: string;
    salarioBase: number;
    totalDevengado: number;
    totalDeducciones: number;
    netoAPagar: number;
    pagado: number;
  };
};
type Datos = {
  hoy: string;
  mes: string;
  corte: number;
  rango: { desde: string; hasta: string };
  cortes: { desde: string; hasta: string; periodoId: number | null }[];
  periodo: { id: number; estado: string; fechaPago: string; tipo: string } | null;
  periodos: { id: number; desde: string; hasta: string }[];
  empleados: Empleado[];
  parametrosPendientes: number;
  parametrosTotal: number;
  empleadoInicial: number | null;
};

const fecha = (v: string) =>
  new Date(v.length === 10 ? `${v}T12:00:00Z` : v).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Bogota",
  });
const dias = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const estadoVale: Record<string, string> = {
  PENDIENTE: "Por autorizar",
  AUTORIZADO: "Autorizado",
  DESCONTADO: "Incluido en liquidación",
  ANULADO: "Anulado",
};
const iniciales = (e: Empleado) =>
  `${e.nombre[0] ?? ""}${e.apellidos[0] ?? ""}`;

function CrearCiclo({ datos }: { datos: Datos }) {
  const [estado, accion, pendiente] = useActionState(crearPeriodo, {
    error: null,
    ok: null,
  });
  return (
    <form action={accion} className={s.createCycle}>
      <input type="hidden" name="tipo" value="CICLOS" />
      <input type="hidden" name="anio" value={datos.mes.slice(0, 4)} />
      <input type="hidden" name="mes" value={Number(datos.mes.slice(5))} />
      <input type="hidden" name="corte" value={datos.corte + 1} />
      <input type="hidden" name="fechaPagoPrevista" value={datos.rango.hasta} />
      <span>Este corte aún no está creado.</span>
      <button className={s.primary} disabled={pendiente}>
        <Plus size={16} />
        {pendiente ? "Creando…" : "Crear este ciclo"}
      </button>
      {estado.error || estado.ok ? (
        <p role="status">{estado.error ?? estado.ok}</p>
      ) : null}
    </form>
  );
}

export function PanelNomina({ datos }: { datos: Datos }) {
  const router = useRouter();
  const [navegando, iniciarNavegacion] = useTransition();
  const [seleccion, setSeleccion] = useState(
    datos.empleadoInicial ??
      datos.empleados.find((e) => e.estado === "ACTIVO")?.id ??
      datos.empleados[0]?.id,
  );
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [pestana, setPestana] = useState("Resumen");
  const empleado = datos.empleados.find((e) => e.id === seleccion);
  const participantes = datos.empleados.filter(
    (e) => e.estado === "ACTIVO" || e.liquidacion,
  );
  const calculados = participantes.filter((e) => e.liquidacion);
  const bruto = calculados.reduce(
    (v, e) => v + e.liquidacion!.totalDevengado,
    0,
  );
  const neto = calculados.reduce((v, e) => v + (e.netoEstimado ?? 0), 0);
  const pagado = calculados.reduce((v, e) => v + e.liquidacion!.pagado, 0);
  const vales = participantes.reduce((v, e) => v + e.valesAutorizados, 0);
  const valesPendientes = participantes.reduce(
    (v, e) => v + e.valesPendientes,
    0,
  );
  const empleadosVisibles = datos.empleados.filter(
    (e) =>
      `${e.nombre} ${e.apellidos} ${e.documentoNumero} ${e.cargo}`
        .toLocaleLowerCase("es")
        .includes(busqueda.toLocaleLowerCase("es")) &&
      (filtro === "TODOS" || e.estado === filtro),
  );
  const fechaPago = datos.periodo?.fechaPago ?? datos.rango.hasta;
  const enlaceVales = `/admin/nomina/vales?desde=${datos.rango.desde}&hasta=${datos.rango.hasta}${datos.periodo ? `&cicloId=${datos.periodo.id}` : ""}${empleado ? `&empleadoId=${empleado.id}` : ""}`;
  function navegar(url: string) {
    iniciarNavegacion(() => router.push(url));
  }

  return (
    <div className={s.dashboard} aria-busy={navegando}>
      <header className={s.header}>
        <div className={s.titleGroup}>
          <span className={s.titleIcon}>
            <BriefcaseBusiness />
          </span>
          <div>
            <p className={s.eyebrow}>EL BUEN GUSTO · EQUIPO</p>
            <h1>Nómina</h1>
            <p className={s.subtitle}>
              Gestiona tu personal, sus consumos y cada fecha de pago.
            </p>
          </div>
        </div>
        <div className={s.headerActions}>
          <Link className={s.secondary} href="/admin/nomina/reportes">
            <FileText size={16} />
            Reportes
          </Link>
          <Link className={s.primary} href="/admin/nomina/empleados">
            <Plus size={17} />
            Empleado
          </Link>
        </div>
      </header>
      <NavegacionNomina actual="/admin/nomina" />

      <section className={s.cycleSection} aria-label="Ciclos de pago">
        <label className={s.month}>
          <span>
            <CalendarDays size={15} />
            Mes de pago
          </span>
          <input
            aria-label="Mes de pago"
            type="month"
            min="2000-01"
            max="2099-12"
            value={datos.mes}
            onChange={(e) => {
              if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value))
                navegar(`/admin/nomina?mes=${e.target.value}&corte=1`);
            }}
          />
        </label>
        <div className={s.cycleOptions}>
          {datos.cortes.map((c, i) => (
            <Link
              key={c.desde}
              href={`/admin/nomina?mes=${datos.mes}&corte=${i + 1}`}
              aria-current={
                datos.rango.desde === c.desde && datos.rango.hasta === c.hasta
                  ? "date"
                  : undefined
              }
              className={s.cycle}
            >
              <span>
                {Number(c.desde.slice(8))}–{Number(c.hasta.slice(8))}
              </span>
              <small>
                Pago {Number(c.hasta.slice(8))} ·{" "}
                {c.periodoId ? "Creado" : "Por crear"}
              </small>
            </Link>
          ))}
        </div>
      </section>
      <div className={s.cycleContext}>
        <span>
          {fecha(datos.rango.desde)} — {fecha(datos.rango.hasta)}{" "}
          <b>
            ·{" "}
            {datos.periodo?.estado === "CERRADO"
              ? "Cerrado"
              : datos.periodo
                ? "Abierto"
                : "Corte previsto"}
          </b>
        </span>
        {datos.periodos.length > 0 && (
          <label>
            Otros períodos{" "}
            <select
              aria-label="Consultar período existente"
              value={datos.periodo?.id ?? ""}
              onChange={(e) =>
                navegar(
                  `/admin/nomina?mes=${datos.mes}&periodo=${e.target.value}`,
                )
              }
            >
              <option value="">Elegir…</option>
              {datos.periodos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.desde} → {p.hasta}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <section className={s.stats} aria-label="Resumen del ciclo">
        {[
          {
            icon: UsersRound,
            label: "Empleados activos",
            value: String(
              datos.empleados.filter((e) => e.estado === "ACTIVO").length,
            ),
            note: `${datos.empleados.filter((e) => e.estado !== "ACTIVO").length} inactivos · historial conservado`,
          },
          {
            icon: Banknote,
            label: "Bruto calculado",
            value: calculados.length ? formatCOP(bruto) : "Por liquidar",
            note: `${calculados.length} de ${participantes.length} empleados liquidados`,
          },
          {
            icon: Ticket,
            label: "Vales por descontar",
            value: formatCOP(vales),
            note: `${formatCOP(valesPendientes)} pendientes de autorización`,
          },
          {
            icon: CircleCheck,
            label: "Neto estimado",
            value: calculados.length ? formatCOP(neto) : "Por liquidar",
            note: "Según liquidaciones y vales autorizados",
          },
        ].map(({ icon: Icon, label, value, note }) => (
          <article className={s.stat} key={label}>
            <Icon className={s.statIcon} size={26} />
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
              <small>{note}</small>
            </div>
          </article>
        ))}
      </section>
      <div className={s.paymentSummary}>
        <span>
          Pagado <b>{formatCOP(pagado)}</b>
        </span>
        <span>
          Saldo estimado{" "}
          <b>{calculados.length ? formatCOP(neto - pagado) : "Por liquidar"}</b>
        </span>
        <span>
          Pagos completos{" "}
          <b>
            {
              calculados.filter((e) => e.liquidacion!.estadoPago === "PAGADO")
                .length
            }{" "}
            de {participantes.length}
          </b>
        </span>
        {calculados.length < participantes.length && (
          <span className={s.warning}>
            Proyección incompleta: faltan{" "}
            {participantes.length - calculados.length} por liquidar
          </span>
        )}
      </div>
      {!datos.periodo && <CrearCiclo datos={datos} />}

      <div className={s.workspace}>
        <section className={s.panel} aria-label="Lista de empleados">
          <div className={s.panelHeading}>
            <h2>Empleados</h2>
            <span className={s.muted}>{datos.empleados.length}</span>
          </div>
          <div className={s.filters}>
            <label className={s.search}>
              <Search size={17} />
              <input
                aria-label="Buscar empleado"
                placeholder="Buscar empleado…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </label>
            <label className={s.filter}>
              <SlidersHorizontal size={16} />
              <select
                aria-label="Filtrar empleados por estado"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                <option value="ACTIVO">Activos</option>
                <option value="INACTIVO">Inactivos</option>
              </select>
            </label>
          </div>
          <div className={s.employeeList}>
            {empleadosVisibles.map((e) => (
              <button
                key={e.id}
                type="button"
                className={s.employee}
                aria-pressed={e.id === seleccion}
                onClick={() => {
                  setSeleccion(e.id);
                  setPestana("Resumen");
                }}
              >
                <span className={s.avatar}>{iniciales(e)}</span>
                <span className={s.employeeText}>
                  <strong>
                    {e.nombre} {e.apellidos}
                  </strong>
                  <small>{e.cargo}</small>
                </span>
                <span className={e.estado === "ACTIVO" ? s.active : s.inactive}>
                  {e.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          {!empleadosVisibles.length && (
            <div className={s.empty}>
              <UsersRound size={30} />
              <p>
                {datos.empleados.length
                  ? "No hay empleados con estos filtros."
                  : "Tu equipo comienza aquí."}
              </p>
              {!datos.empleados.length && (
                <Link className={s.primary} href="/admin/nomina/empleados">
                  Registrar empleado
                </Link>
              )}
            </div>
          )}
        </section>

        <div className={s.detailColumn}>
          {empleado ? (
            <section
              className={s.panel}
              aria-label="Ficha del empleado seleccionado"
            >
              <div className={s.profile}>
                <span className={`${s.avatar} ${s.bigAvatar}`}>
                  {iniciales(empleado)}
                </span>
                <div className={s.profileTitle}>
                  <h2>
                    {empleado.nombre} {empleado.apellidos}
                  </h2>
                  <p>
                    {empleado.documentoTipo} {empleado.documentoNumero} ·{" "}
                    {empleado.cargo}
                  </p>
                </div>
                <Link
                  className={s.secondary}
                  href={`/admin/nomina/empleados/${empleado.id}`}
                >
                  Ver ficha
                  <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className={s.detailTabs} aria-label="Detalle del empleado">
                {["Resumen", "Vales y consumos", "Desglose"].map((t) => (
                  <button
                    type="button"
                    key={t}
                    aria-pressed={pestana === t}
                    onClick={() => setPestana(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div aria-live="polite">
                {pestana === "Resumen" && (
                  <>
                    <div className={s.profileGrid}>
                      <div className={s.facts}>
                        <p>
                          <CalendarDays size={18} />
                          <span>
                            Fecha de ingreso
                            <strong>{fecha(empleado.fechaIngreso)}</strong>
                          </span>
                        </p>
                        <p>
                          <Clock3 size={18} />
                          <span>
                            Trabajo registrado
                            <strong>
                              {Math.floor(empleado.minutos / 60)} h{" "}
                              {empleado.minutos % 60} min
                            </strong>
                          </span>
                        </p>
                        <p>
                          <ShieldCheck size={18} />
                          <span>
                            Descanso semanal
                            <strong>{dias[empleado.diaDescanso]}</strong>
                          </span>
                        </p>
                      </div>
                      <div className={s.amountCard}>
                        <p>Neto estimado del ciclo</p>
                        <strong>
                          {empleado.netoEstimado === null
                            ? "Por liquidar"
                            : formatCOP(empleado.netoEstimado)}
                        </strong>
                        <span>
                          {empleado.liquidacion?.estado === "APROBADA"
                            ? "Liquidación aprobada"
                            : empleado.liquidacion
                              ? "Borrador · pendiente de aprobación"
                              : "Aún no tiene liquidación"}
                        </span>
                      </div>
                    </div>
                    <div className={s.amountLine}>
                      <span>
                        Salario contractual{" "}
                        {empleado.remuneracion === "DIARIO"
                          ? "por día"
                          : empleado.remuneracion === "HORARIO"
                            ? "por hora"
                            : "mensual"}
                      </span>
                      <strong>
                        {formatCOP(
                          empleado.remuneracion === "DIARIO"
                            ? empleado.salarioDiario
                            : empleado.remuneracion === "HORARIO"
                              ? empleado.valorHora
                              : empleado.salarioMensual,
                        )}
                      </strong>
                    </div>
                    {empleado.remuneracion === "MENSUAL" && !empleado.liquidacion && (!datos.periodo || datos.periodo.tipo === "CICLOS") && (
                      <div className={s.amountLine}>
                        <span>Base prevista del corte · mensual ÷ 4<br /><small>Antes de novedades y descuentos; el último corte ajusta redondeos</small></span>
                        <strong>{formatCOP(salarioDelCiclo(empleado.salarioMensual, datos.rango.desde))}</strong>
                      </div>
                    )}
                    <div className={s.amountLine}>
                      <span>Vales autorizados por descontar</span>
                      <strong>{formatCOP(empleado.valesAutorizados)}</strong>
                    </div>
                    <div className={s.amountLine}>
                      <span>Pagado en este ciclo</span>
                      <strong>
                        {formatCOP(empleado.liquidacion?.pagado ?? 0)}
                      </strong>
                    </div>
                    <div className={s.amountLine}>
                      <span>Saldo estimado</span>
                      <strong>
                        {empleado.saldoEstimado === null
                          ? "Por liquidar"
                          : formatCOP(empleado.saldoEstimado)}
                      </strong>
                    </div>
                  </>
                )}
                {pestana === "Vales y consumos" && (
                  <>
                    <div className={s.panelHeading}>
                      <h3>Consumos de este ciclo</h3>
                      <Ticket size={18} />
                    </div>
                    {empleado.vales.length ? (
                      empleado.vales.map((v) => (
                        <article key={v.id} className={s.voucher}>
                          <div>
                            <strong>{v.productoNombre}</strong>
                            <small>
                              {v.cantidad} × {formatCOP(v.precioUnitario)} ·{" "}
                              {fecha(v.fecha)}
                            </small>
                          </div>
                          <div>
                            <strong>{formatCOP(v.total)}</strong>
                            <span
                              className={
                                v.estado === "PENDIENTE" ? s.inactive : s.active
                              }
                            >
                              {estadoVale[v.estado] ?? v.estado}
                            </span>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className={s.empty}>
                        No hay vales de este empleado en el ciclo.
                      </p>
                    )}
                    <p className={s.footnote}>
                      Los consumos pendientes de autorización no reducen el
                      neto. Los vales incluidos en una liquidación no se
                      descuentan otra vez.
                    </p>
                  </>
                )}
                {pestana === "Desglose" &&
                  (empleado.liquidacion ? (
                    <>
                      <div className={s.amountLine}>
                        <span>Total devengado</span>
                        <strong>
                          {formatCOP(empleado.liquidacion.totalDevengado)}
                        </strong>
                      </div>
                      <div className={s.amountLine}>
                        <span>Deducciones de la liquidación</span>
                        <strong>
                          − {formatCOP(empleado.liquidacion.totalDeducciones)}
                        </strong>
                      </div>
                      <div className={s.amountLine}>
                        <span>Neto guardado</span>
                        <strong>
                          {formatCOP(empleado.liquidacion.netoAPagar)}
                        </strong>
                      </div>
                      {empleado.requiereRecalculo && (
                        <div className={s.amountLine}>
                          <span>Nuevos vales autorizados (estimación)</span>
                          <strong>
                            − {formatCOP(empleado.valesAutorizados)}
                          </strong>
                        </div>
                      )}
                      <div className={s.amountLine}>
                        <span>Neto estimado</span>
                        <strong>{formatCOP(empleado.netoEstimado!)}</strong>
                      </div>
                      <Link
                        className={s.textLink}
                        href={`/admin/nomina/liquidaciones/${empleado.liquidacion.id}`}
                      >
                        Consultar conceptos y comprobante{" "}
                        <ArrowUpRight size={15} />
                      </Link>
                    </>
                  ) : (
                    <p className={s.empty}>
                      Crea el ciclo y liquida al empleado para consultar el
                      desglose real.
                    </p>
                  ))}
              </div>
              {empleado.requiereRecalculo && (
                <p className={s.notice}>
                  <AlertTriangle size={17} />
                  Hay nuevos vales autorizados. Actualiza el borrador para
                  incorporarlos antes de aprobar.
                </p>
              )}
              {empleado.liquidacion?.estado === "APROBADA" &&
                empleado.valesAutorizados > 0 && (
                  <p className={s.notice}>
                    La liquidación aprobada conserva su importe. Revisa los
                    vales nuevos antes de asignarlos a otro ciclo.
                  </p>
                )}
              <div className={s.actions}>
                <Link className={s.primary} href={enlaceVales}>
                  <Plus size={17} />
                  {empleado.estado === "ACTIVO"
                    ? "Registrar vale"
                    : "Consultar vales"}
                </Link>
                {datos.periodo?.estado === "ABIERTO" &&
                  empleado.estado === "ACTIVO" &&
                  empleado.liquidacion?.estado !== "APROBADA" && (
                    <BotonLiquidarEmpleado
                      periodoId={datos.periodo.id}
                      empleadoId={empleado.id}
                      nombre={empleado.nombre}
                    />
                  )}
                {empleado.liquidacion && (
                  <Link
                    className={s.secondary}
                    href={`/admin/nomina/liquidaciones/${empleado.liquidacion.id}`}
                  >
                    <Banknote size={17} />
                    {empleado.liquidacion.estado === "APROBADA"
                      ? "Registrar pago"
                      : "Ver liquidación"}
                  </Link>
                )}
              </div>
            </section>
          ) : (
            <section className={`${s.panel} ${s.empty}`}>
              <BriefcaseBusiness size={35} />
              <h2>Tu equipo, en un solo lugar</h2>
              <p>
                Registra el primer empleado para consultar aquí su ficha, sus
                vales y su pago.
              </p>
            </section>
          )}
          <div className={s.bottomGrid}>
            <section className={s.panel}>
              <h3>
                <CalendarDays size={18} />
                Fecha de pago del ciclo
              </h3>
              <p className={s.paymentDate}>{fecha(fechaPago)}</p>
              <p className={s.footnote}>
                {datos.periodo
                  ? "Fecha registrada en el período seleccionado."
                  : "Fecha prevista según el corte del restaurante."}
              </p>
              <Link
                className={s.textLink}
                href={
                  datos.periodo
                    ? `/admin/nomina/periodos/${datos.periodo.id}`
                    : "/admin/nomina/periodos"
                }
              >
                Ver ciclos
                <ChevronRight size={15} />
              </Link>
            </section>
            <section className={s.panel}>
              <h3>Acciones rápidas</h3>
              <div className={s.quickActions}>
                <Link href="/admin/nomina/asistencia">
                  <Clock3 size={17} />
                  Asistencia
                </Link>
                <Link href="/admin/nomina/novedades">
                  <Plus size={17} />
                  Novedad
                </Link>
                <Link href="/admin/nomina/pagos">
                  <Banknote size={17} />
                  Pagos
                </Link>
                <Link href="/admin/nomina/obligaciones">
                  <ShieldCheck size={17} />
                  Obligaciones
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
      <aside className={s.legal}>
        <ShieldCheck size={19} />
        <p>
          <strong>Configuración laboral y obligaciones</strong>
          <span>
            {!datos.parametrosTotal
              ? "No hay parámetros laborales instalados. Completa su configuración antes de liquidar."
              : datos.parametrosPendientes
                ? `${datos.parametrosPendientes} parámetros marcados para verificar. Revisa sus fuentes y vigencias antes de aprobar.`
                : "Consulta los parámetros, sus fuentes y vigencias antes de aprobar las liquidaciones."}{" "}
            Los importes pendientes de liquidar no se registran como gastos.
          </span>
        </p>
        <Link href="/admin/nomina/configuracion">
          Revisar
          <ArrowUpRight size={16} />
        </Link>
      </aside>
    </div>
  );
}
