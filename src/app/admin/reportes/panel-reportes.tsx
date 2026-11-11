"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Bike,
  CalendarClock,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coins,
  CreditCard,
  FileSpreadsheet,
  HandCoins,
  PackageCheck,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Soup,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { formatCOP, formatHora } from "@/lib/format";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { FormularioCierre } from "./boton-cierre";
import { GraficoDinero, BarraUnidades } from "./graficos";
import "../nomina/operaciones.css";
import "./reportes.css";

type Reporte = {
  fecha: string;
  esHistorico: boolean;
  resumen: {
    ventas: number; abonos: number; gastosCaja: number; gastosCajaEfectivo: number;
    gastosExternos: number; gastosTotal: number; efectivo: number; propinas: number;
    ticket: number; pagos: number; fiadoPendiente: number; fiadoNuevo: number;
    cuentasNuevas: number; servidas: number; cocina: number; canceladas: number;
    domicilios: number; domCobrados: number; domPendientes: number; domCancelados: number;
    recaudoDomicilios: number; apartados: number; apartadosEntregados: number;
  };
  metodos: { nombre: string; valor: number }[];
  abonosMetodos: { nombre: string; valor: number }[];
  proteinas: { nombre: string; unidades: number; sinSopa: number }[];
  extras: { nombre: string; unidades: number; recaudo: number }[];
  horas: { etiqueta: string; valor: number }[];
  dias: { etiqueta: string; valor: number; resaltar?: boolean }[];
  domicilios: { id: number; numero: number; hora: string; cliente: string; telefono: string; barrio: string | null; direccion: string; estado: string; cobrado: number | null; metodo: string | null }[];
  fiados: { id: number; cliente: string; concepto: string; valor: number; origen: string; items: { nombre: string; cantidad: number }[]; estado: string }[];
  abonos: { id: number; hora: string; cliente: string; concepto: string; monto: number; metodo: string; usuario: string }[];
  gastos: { id: number; hora: string; descripcion: string; categoria: string; valor: number; metodo: string; origen: string; usuario: string; anulado: boolean }[];
  condonaciones: { id: number; cliente: string; concepto: string; valor: number; usuario: string; motivo: string | null }[];
  cierres: { id: number; fecha: string; total: number; pagos: number; comandas: number; efectivoContado: number | null; efectivoEsperado: number; cerradoPor: string }[];
  cierreHoy: { fecha: string; total: number; pagos: number; comandas: number; efectivoContado: number | null; efectivoEsperado: number; cerradoPor: string } | null;
};

type ModalTipo = "ventas" | "operacion" | "domicilios" | "finanzas" | "gastos" | "cierre" | null;
const etiquetaMetodo: Record<string, string> = { EFECTIVO: "Efectivo", TARJETA: "Tarjeta", TRANSFERENCIA: "Transferencia", FIADO: "Fiado" };

function abrirDesde(event: MouseEvent<HTMLButtonElement>, tipo: Exclude<ModalTipo, null>, abrir: (m: { tipo: Exclude<ModalTipo, null>; origen: OrigenModal }) => void) {
  const r = event.currentTarget.getBoundingClientRect();
  abrir({ tipo, origen: { x: r.x, y: r.y, w: r.width, h: r.height } });
}

function Linea({ nombre, valor, tono }: { nombre: string; valor: string; tono?: "success" | "warning" | "danger" }) {
  return <div className="report-line"><span>{nombre}</span><b className={tono ? `is-${tono}` : ""}>{valor}</b></div>;
}

export function PanelReportes({ reporte }: { reporte: Reporte }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [modal, setModal] = useState<{ tipo: Exclude<ModalTipo, null>; origen: OrigenModal } | null>(null);
  const [tab, setTab] = useState<"Resumen" | "Historial">("Resumen");
  const r = reporte.resumen;
  const exportar = `/admin/reportes/exportar?fecha=${reporte.fecha}`;
  const claseResultados = pendiente ? "report-workspace is-loading" : "report-workspace";
  const seleccionarFecha = (form: FormData) => {
    const fecha = String(form.get("fecha") ?? "");
    if (fecha) iniciar(() => router.push(`/admin/reportes?fecha=${fecha}`));
  };
  const tarjetas = [
    { tipo: "ventas" as const, titulo: "Lo que entró", valor: formatCOP(r.ventas), nota: `${r.pagos} cobros · ticket ${formatCOP(r.ticket)}`, Icono: Wallet, acento: "is-green" },
    { tipo: "operacion" as const, titulo: "Lo servido", valor: `${r.servidas}`, nota: `${r.cocina} en cocina · ${r.canceladas} canceladas`, Icono: Soup, acento: "is-amber" },
    { tipo: "domicilios" as const, titulo: "Domicilios", valor: `${r.domicilios}`, nota: `${r.domCobrados} cobrados · ${formatCOP(r.recaudoDomicilios)}`, Icono: Bike, acento: "is-blue" },
    { tipo: "finanzas" as const, titulo: "Por cobrar", valor: formatCOP(r.fiadoPendiente), nota: `${r.cuentasNuevas} fiados nuevos hoy`, Icono: HandCoins, acento: "is-violet" },
    { tipo: "gastos" as const, titulo: "Gastos de caja", valor: formatCOP(r.gastosCaja), nota: `${formatCOP(r.gastosCajaEfectivo)} salieron en efectivo`, Icono: ShoppingCart, acento: "is-red" },
    { tipo: "cierre" as const, titulo: "Efectivo real", valor: formatCOP(r.efectivo), nota: reporte.cierreHoy ? "Caja cerrada para este día" : "Disponible para el cierre", Icono: Banknote, acento: "is-amber" },
  ];

  return <div className="report-module">
    <header className="report-hero" data-anim>
      <div className="report-heroCopy"><span className="report-heroIcon"><ChartNoAxesCombined /></span><div><p>CONTROL DEL NEGOCIO · DÍA A DÍA</p><h1>Reportes</h1><strong>{reporte.esHistorico ? "Vista histórica" : "Turno de hoy"} · {reporte.fecha}</strong><small>Todo lo que entró, salió y quedó pendiente, sin mezclar la caja.</small></div></div>
      <div className="report-heroActions"><a href={exportar} download className="report-export"><FileSpreadsheet size={17} /> Excel del día</a><form action={seleccionarFecha} className="report-date"><CalendarDays size={16} /><input type="date" name="fecha" defaultValue={reporte.fecha} max={new Date().toISOString().slice(0, 10)} aria-label="Fecha del reporte" /><button disabled={pendiente}>{pendiente ? "…" : "Ver"}</button></form></div>
    </header>

    <nav className="report-tabs" aria-label="Secciones de reportes"><button aria-pressed={tab === "Resumen"} onClick={() => setTab("Resumen")}><ChartNoAxesCombined size={16} /> Resumen del día</button><button aria-pressed={tab === "Historial"} onClick={() => setTab("Historial")}><CalendarClock size={16} /> Cierres anteriores</button></nav>
    <div className={claseResultados} aria-busy={pendiente}>
      {tab === "Resumen" ? <>
        <section className="report-headline"><div><span>DINERO DISPONIBLE</span><strong>{formatCOP(r.efectivo)}</strong><p>Ventas en efectivo + abonos − gastos pagados desde caja.</p></div><div className="report-headlineBreakdown"><Linea nombre="Ventas" valor={formatCOP(r.ventas)} tono="success" /><Linea nombre="Abonos" valor={`+${formatCOP(r.abonos)}`} tono="success" /><Linea nombre="Gastos en efectivo" valor={`−${formatCOP(r.gastosCajaEfectivo)}`} tono="warning" /></div></section>
        <section className="report-cards" aria-label="Áreas del reporte">{tarjetas.map(({ tipo, titulo, valor, nota, Icono, acento }) => <button key={tipo} onClick={event => abrirDesde(event, tipo, setModal)} className={`report-card ${acento}`}><span className="report-cardIcon"><Icono size={21} /></span><ChevronRight className="report-cardArrow" size={18} /><p>{titulo}</p><strong>{valor}</strong><small>{nota}</small><footer>Ver detalle <ArrowUpRight size={14} /></footer></button>)}</section>
        <section className="report-quick"><div><span className="report-cardIcon"><CreditCard size={19} /></span><div><b>Cómo se cobró hoy</b><p>{reporte.metodos.filter(x => x.valor > 0).map(x => `${etiquetaMetodo[x.nombre] ?? x.nombre} ${formatCOP(x.valor)}`).join(" · ") || "Aún no hay cobros registrados"}</p></div></div><button onClick={event => abrirDesde(event, "ventas", setModal)}>Abrir resumen <ChevronRight size={16} /></button></section>
        {r.apartados > 0 ? <section className="report-apartados"><PackageCheck size={21} /><span><b>Apartados del día</b><p>{r.apartados} creados · {r.apartadosEntregados} entregados</p></span><Link href="/admin/apartados">Ver apartados <ArrowUpRight size={14} /></Link></section> : null}
      </> : <section className="report-history"><div className="report-sectionHeading"><div><span>EXPEDIENTE DE CAJA</span><h2>Últimos cierres</h2><p>Conserva una fotografía de cada jornada para cuadrar sin perder el historial.</p></div><button onClick={event => abrirDesde(event, "cierre", setModal)}>Ver cierre actual <ChevronRight size={16} /></button></div>{reporte.cierres.length ? <div className="report-historyList">{reporte.cierres.map(c => { const diferencia = c.efectivoContado === null ? null : c.efectivoContado - c.efectivoEsperado; return <article key={c.id}><span className="report-cardIcon"><CheckCircle2 size={19} /></span><div><b>{c.fecha}</b><p>{c.pagos} pagos · {c.comandas} comandas · cerró {c.cerradoPor}</p></div><strong>{formatCOP(c.total)}</strong>{diferencia !== null && <em className={diferencia >= 0 ? "is-good" : "is-bad"}>{diferencia >= 0 ? "Sobra" : "Falta"} {formatCOP(Math.abs(diferencia))}</em>}</article>; })}</div> : <div className="report-empty"><CalendarClock size={32} /><b>Aún no hay cierres guardados</b><p>Al finalizar el día podrás congelar aquí el resumen de caja.</p></div>}</section>}
    </div>
    {modal && <ModalFlip origen={modal.origen} onClose={() => setModal(null)} ariaLabel="Detalle del reporte" animacion="suave" panelClassName="report-modal">{cerrar => <><header className="report-modalHeader"><div><p>{modal.tipo === "cierre" ? "CIERRE DE CAJA" : "DETALLE DEL DÍA"}</p><h2>{tituloModal(modal.tipo)}</h2><span>{reporte.fecha}</span></div><button onClick={cerrar} aria-label="Cerrar detalle"><X size={20} /></button></header><div className="report-modalBody" data-anim>{modal.tipo === "ventas" && <Ventas reporte={reporte} />}{modal.tipo === "operacion" && <Operacion reporte={reporte} />}{modal.tipo === "domicilios" && <Domicilios reporte={reporte} />}{modal.tipo === "finanzas" && <Finanzas reporte={reporte} />}{modal.tipo === "gastos" && <Gastos reporte={reporte} />}{modal.tipo === "cierre" && <Cierre reporte={reporte} />}</div></>}</ModalFlip>}
  </div>;
}

function tituloModal(tipo: Exclude<ModalTipo, null>) { return ({ ventas: "Ingresos y forma de pago", operacion: "Producción y productos", domicilios: "Domicilios del día", finanzas: "Fiados y abonos", gastos: "Gastos registrados", cierre: "Cierre de caja" })[tipo]; }

function Ventas({ reporte }: { reporte: Reporte }) { const r = reporte.resumen; return <><div className="report-modalStats"><article><Wallet /><span>Ventas</span><b>{formatCOP(r.ventas)}</b></article><article><TrendingUp /><span>Propinas</span><b>{formatCOP(r.propinas)}</b></article><article><Receipt /><span>Ticket promedio</span><b>{formatCOP(r.ticket)}</b></article></div><h3>Distribución de cobros</h3><div className="report-lines">{reporte.metodos.map(x => <Linea key={x.nombre} nombre={etiquetaMetodo[x.nombre] ?? x.nombre} valor={formatCOP(x.valor)} />)}</div><h3>Ingresos por hora</h3>{reporte.horas.length ? <GraficoDinero datos={reporte.horas} /> : <Vacio icono={Clock3} texto="No hubo pagos durante este día." />}<h3>Últimos 7 días</h3><GraficoDinero datos={reporte.dias} /></>; }
function Operacion({ reporte }: { reporte: Reporte }) { const maxP = Math.max(1, ...reporte.proteinas.map(x => x.unidades)); const maxE = Math.max(1, ...reporte.extras.map(x => x.unidades)); return <><div className="report-modalStats"><article><Soup /><span>Platos servidos</span><b>{reporte.resumen.servidas}</b></article><article><Clock3 /><span>En cocina</span><b>{reporte.resumen.cocina}</b></article><article><TrendingDown /><span>Canceladas</span><b>{reporte.resumen.canceladas}</b></article></div><h3>Almuerzos por proteína</h3>{reporte.proteinas.length ? <div className="report-bars">{reporte.proteinas.map(x => <BarraUnidades key={x.nombre} etiqueta={x.nombre} unidades={x.unidades} max={maxP} detalle={x.sinSopa ? `${x.sinSopa} sin sopa` : undefined} />)}</div> : <Vacio icono={Soup} texto="No hay almuerzos servidos para este día." />}<h3>Extras y bebidas</h3>{reporte.extras.length ? <div className="report-bars">{reporte.extras.map(x => <BarraUnidades key={x.nombre} etiqueta={x.nombre} unidades={x.unidades} max={maxE} detalle={formatCOP(x.recaudo)} />)}</div> : <Vacio icono={ShoppingBag} texto="No se vendieron extras ni bebidas." />}</>; }
function Domicilios({ reporte }: { reporte: Reporte }) { const r = reporte.resumen; return <><div className="report-modalStats"><article><Bike /><span>Creados</span><b>{r.domicilios}</b></article><article><CircleDollarSign /><span>Cobrados</span><b>{r.domCobrados}</b></article><article><Clock3 /><span>Pendientes</span><b>{r.domPendientes}</b></article></div>{reporte.domicilios.length ? <div className="report-list">{reporte.domicilios.map(d => <article key={d.id}><span className="report-listIcon"><Bike size={17} /></span><div><b>#{d.numero} · {d.cliente}</b><p>{formatHora(new Date(d.hora))} · {d.direccion}{d.barrio ? ` · ${d.barrio}` : ""}</p></div><em>{d.cobrado !== null ? "Cobrado" : d.estado}</em><strong>{d.cobrado !== null ? formatCOP(d.cobrado) : "—"}</strong></article>)}</div> : <Vacio icono={Bike} texto="Todavía no hay domicilios creados este día." />}</>; }
function Finanzas({ reporte }: { reporte: Reporte }) { const r = reporte.resumen; return <><div className="report-modalStats"><article><HandCoins /><span>Fiado nuevo</span><b>{formatCOP(r.fiadoNuevo)}</b></article><article><Coins /><span>Abonos recibidos</span><b>{formatCOP(r.abonos)}</b></article><article><CircleDollarSign /><span>Saldo por cobrar</span><b>{formatCOP(r.fiadoPendiente)}</b></article></div><h3>Fiados creados hoy</h3>{reporte.fiados.length ? <div className="report-list">{reporte.fiados.map(f => <article key={f.id}><span className="report-listIcon"><HandCoins size={17} /></span><div><b>{f.cliente}</b><p>{f.origen} · {f.concepto}{f.items.length ? ` · ${f.items.map(i => `${i.cantidad}× ${i.nombre}`).join(", ")}` : ""}</p></div><em>{f.estado}</em><strong>{formatCOP(f.valor)}</strong></article>)}</div> : <Vacio icono={HandCoins} texto="No se registraron fiados en este día." />}<h3>Abonos recibidos</h3>{reporte.abonos.length ? <div className="report-list">{reporte.abonos.map(a => <article key={a.id}><span className="report-listIcon"><Coins size={17} /></span><div><b>{a.cliente}</b><p>{formatHora(new Date(a.hora))} · {a.metodo} · {a.concepto}</p></div><strong className="is-success">+{formatCOP(a.monto)}</strong></article>)}</div> : <Vacio icono={Coins} texto="No entraron abonos de cuentas pendientes." />}</>; }
function Gastos({ reporte }: { reporte: Reporte }) { return <><div className="report-modalStats"><article><ShoppingCart /><span>Total gastos</span><b>{formatCOP(reporte.resumen.gastosTotal)}</b></article><article><Banknote /><span>Desde caja</span><b>{formatCOP(reporte.resumen.gastosCaja)}</b></article><article><ArrowLeftRight /><span>Externos</span><b>{formatCOP(reporte.resumen.gastosExternos)}</b></article></div>{reporte.gastos.length ? <div className="report-list">{reporte.gastos.map(g => <article key={g.id} className={g.anulado ? "is-cancelled" : ""}><span className="report-listIcon"><Tag size={17} /></span><div><b>{g.descripcion}</b><p>{formatHora(new Date(g.hora))} · {g.categoria} · {g.metodo} · {g.origen}</p></div><em>{g.anulado ? "Anulado" : g.usuario}</em><strong>−{formatCOP(g.valor)}</strong></article>)}</div> : <Vacio icono={ShoppingCart} texto="No se registraron gastos durante este día." />}{reporte.condonaciones.length ? <><h3>Condonaciones</h3>{reporte.condonaciones.map(c => <Linea key={c.id} nombre={`${c.cliente} · ${c.concepto}`} valor={`−${formatCOP(c.valor)}`} tono="warning" />)}</> : null}</>; }
function Cierre({ reporte }: { reporte: Reporte }) { const r = reporte.resumen; if (reporte.cierreHoy) { const c = reporte.cierreHoy; const diff = c.efectivoContado === null ? null : c.efectivoContado - c.efectivoEsperado; return <><div className="report-closed"><CheckCircle2 /><div><b>Caja cerrada</b><p>Registrada por {c.cerradoPor}. Esta fotografía ya no cambia.</p></div></div><div className="report-lines"><Linea nombre="Ventas + propinas" valor={formatCOP(c.total)} /><Linea nombre="Pagos / comandas" valor={`${c.pagos} / ${c.comandas}`} /><Linea nombre="Efectivo esperado" valor={formatCOP(c.efectivoEsperado)} />{c.efectivoContado !== null && <Linea nombre="Efectivo contado" valor={formatCOP(c.efectivoContado)} tono={diff !== null && diff < 0 ? "danger" : "success"} />}</div></>; } return <><div className="report-modalStats"><article><Wallet /><span>Ventas hoy</span><b>{formatCOP(r.ventas)}</b></article><article><Coins /><span>Abonos</span><b>{formatCOP(r.abonos)}</b></article><article><Banknote /><span>Esperado</span><b>{formatCOP(r.efectivo)}</b></article></div><p className="report-modalNote">Congela el resumen cuando termines los cobros del día. Puedes anotar el efectivo contado para cuadrar la caja.</p><FormularioCierre conPagos={r.pagos > 0 || r.abonos > 0 || reporte.gastos.length > 0 || r.fiadoNuevo > 0} /></>; }
function Vacio({ icono: Icono, texto }: { icono: typeof Clock3; texto: string }) { return <div className="report-empty"><Icono size={28} /><p>{texto}</p></div>; }
