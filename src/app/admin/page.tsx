import { ArrowUpRight, Banknote, Bike, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, LayoutDashboard, ReceiptText, ShoppingBag, Soup, UtensilsCrossed, WalletCards } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { claveDia, formatCOP, formatFecha } from "@/lib/format";
import { inicioDeHoy, reservasPorMenuItem } from "@/lib/pedido";
import { requerirRol } from "@/lib/session";
import "./inicio.css";

export const metadata = { title: "Panel de control · El Buen Gusto" };

export default async function AdminInicio() {
  const sesion = await requerirRol("ADMIN");
  const ahora = new Date();
  const hoy = inicioDeHoy();
  const fecha = claveDia(ahora);
  const [pagos, anticipos, mesasPorCobrar, pedidosDelDia, domicilios, domiciliosPendientesTotal, deudas, gastos, menu, cierre] = await Promise.all([
    db.pago.aggregate({ where: { createdAt: { gte: hoy } }, _sum: { total: true, propina: true }, _count: true }),
    db.anticipoCliente.aggregate({ where: { createdAt: { gte: hoy }, estado: { not: "ANULADO" } }, _sum: { valorOriginal: true } }),
    db.mesa.count({ where: { activa: true, esDomicilio: false, esApartado: false, estado: { in: ["OCUPADA", "POR_PAGAR"] } } }),
    db.pedido.count({ where: { createdAt: { gte: hoy }, estado: { not: "CANCELADO" } } }),
    db.domicilio.findMany({ where: { createdAt: { gte: hoy } }, select: { id: true, cliente: true, estado: true, cobradoMonto: true, horaEntrega: true, consecutivoDia: true }, orderBy: { createdAt: "asc" }, take: 5 }),
    db.domicilio.count({ where: { createdAt: { gte: hoy }, cobradoMonto: null, estado: { notIn: ["CANCELADO", "FIADO"] } } }),
    db.cuentaPorCobrar.aggregate({ where: { estado: "PENDIENTE" }, _sum: { valorOriginal: true, pagado: true, saldoCondonado: true }, _count: true }),
    db.gasto.aggregate({ where: { createdAt: { gte: hoy }, anulado: false }, _sum: { valor: true } }),
    db.menuDia.findUnique({ where: { fecha }, include: { items: { include: { producto: true }, orderBy: { id: "asc" } } } }),
    db.cierreCaja.findUnique({ where: { fecha }, select: { id: true } }),
  ]);

  const ventas = (pagos._sum.total ?? 0) + (pagos._sum.propina ?? 0);
  const anticiposHoy = anticipos._sum.valorOriginal ?? 0;
  const saldoFiados = Math.max(0, (deudas._sum.valorOriginal ?? 0) - (deudas._sum.pagado ?? 0) - (deudas._sum.saldoCondonado ?? 0));
  const reservas = await reservasPorMenuItem(menu?.items.map((item) => item.id) ?? []);
  const menuVisible = (menu?.items ?? []).filter((item) => item.visible && item.producto.activo);

  return <main className="admin-home">
    <header className="admin-home-hero">
      <div className="admin-home-title"><span className="admin-home-icon"><LayoutDashboard size={24} /></span><div><p>CONTROL DEL TURNO · {formatFecha(ahora)}</p><h1>Hola, {sesion.nombre}</h1><small>Todo lo importante del restaurante, sin pantallas de introducción.</small></div></div>
      <div className={cierre ? "admin-home-shift is-closed" : "admin-home-shift"}>{cierre ? <CheckCircle2 size={16} /> : <span className="admin-home-live" />}<span><b>{cierre ? "Caja cerrada" : "Caja abierta"}</b><small>{cierre ? "La jornada quedó guardada" : "Actualizado en tiempo real"}</small></span></div>
    </header>

    <section className="admin-home-metrics" aria-label="Resumen del turno">
      <Metric icon={WalletCards} label="Dinero recibido hoy" value={formatCOP(ventas + anticiposHoy)} note={`${pagos._count} pagos · ${formatCOP(anticiposHoy)} en anticipos`} tone="amber" href="/admin/caja" />
      <Metric icon={ShoppingBag} label="Comandas de hoy" value={String(pedidosDelDia)} note={pedidosDelDia === 1 ? "pedido registrado en el turno" : "pedidos registrados en el turno"} tone="orange" href="/ordenes" />
      <Metric icon={Bike} label="Domicilios activos" value={String(domiciliosPendientesTotal)} note={domiciliosPendientesTotal ? "requieren seguimiento" : "sin entregas pendientes"} tone="blue" href="/admin/domicilios" />
      <Metric icon={CircleDollarSign} label="Por cobrar" value={formatCOP(saldoFiados)} note={`${deudas._count} ${deudas._count === 1 ? "fiado abierto" : "fiados abiertos"}`} tone="violet" href="/admin/cuentas" />
    </section>

    <section className="admin-home-grid">
      <article className="admin-home-command">
        <div className="admin-home-sectionHead"><div><span>PRIORIDADES DEL TURNO</span><h2>¿Qué necesita atención?</h2></div><Clock3 size={21} /></div>
        <div className="admin-home-priorityList">
          <Priority icon={ShoppingBag} title="Mesas por cobrar" value={mesasPorCobrar} description={mesasPorCobrar ? "Hay mesas listas para pasar por caja." : "No hay mesas esperando cobro."} href="/admin/caja" accent="amber" />
          <Priority icon={Bike} title="Domicilios pendientes" value={domiciliosPendientesTotal} description={domiciliosPendientesTotal ? "Revisa el pedido o llévalo directo a caja." : "Todos los domicilios del día están resueltos."} href="/admin/domicilios" accent="blue" />
          <Priority icon={ReceiptText} title="Gastos registrados" value={formatCOP(gastos._sum.valor ?? 0)} description="Movimientos anotados durante esta jornada." href="/admin/gastos" accent="muted" />
        </div>
      </article>

      <article className="admin-home-menu">
        <div className="admin-home-sectionHead"><div><span>COCINA · DISPONIBILIDAD</span><h2>Menú de hoy</h2></div><Link href="/admin/menu-dia">Gestionar <ArrowUpRight size={15} /></Link></div>
        {menuVisible.length ? <div className="admin-home-menuList">{menuVisible.slice(0, 5).map((item) => { const total = item.stockPorciones; const usados = item.vendidos + (reservas.get(item.id) ?? 0); const porcentaje = total === null ? 0 : Math.min(100, Math.round(usados / total * 100)); return <div key={item.id} className="admin-home-menuItem"><div><b>{item.producto.nombre}</b><small>{total === null ? "Porciones ilimitadas" : `${Math.max(0, total - usados)} de ${total} disponibles`}</small></div>{total === null ? <span className="admin-home-unlimited">∞</span> : <span className="admin-home-stock"><i><em style={{ width: `${porcentaje}%` }} /></i>{Math.max(0, total - usados)}</span>}</div>; })}</div> : <div className="admin-home-empty"><Soup size={25} /><div><b>No hay menú configurado para hoy</b><span>Activa los productos que se van a servir antes de abrir comandas.</span></div><Link href="/admin/menu-dia">Configurar</Link></div>}
      </article>
    </section>

    <section className="admin-home-bottom">
      <article className="admin-home-deliveries"><div className="admin-home-sectionHead"><div><span>DOMICILIOS DE HOY</span><h2>Seguimiento rápido</h2></div><Link href="/admin/domicilios">Ver todos <ArrowUpRight size={15} /></Link></div>{domicilios.length ? <div className="admin-home-deliveryList">{domicilios.map((domicilio) => <Link href="/admin/domicilios" key={domicilio.id}><span className="admin-home-deliveryNumber">#{domicilio.consecutivoDia ?? domicilio.id}</span><span><b>{domicilio.cliente}</b><small>{domicilio.horaEntrega || "Hora por confirmar"}</small></span><em className={domicilio.cobradoMonto !== null ? "is-paid" : ""}>{domicilio.cobradoMonto !== null ? "Cobrado" : domicilio.estado === "FIADO" ? "Fiado" : "Pendiente"}</em></Link>)}</div> : <div className="admin-home-empty compact"><Bike size={23} /><div><b>Aún no hay domicilios</b><span>Los nuevos pedidos de entrega aparecerán aquí.</span></div></div>}</article>
      <article className="admin-home-actions"><span>ACCESOS RÁPIDOS</span><h2>Empieza con una acción</h2><div><Link href="/admin/mesas"><UtensilsCrossed size={18} /> Mesas <ArrowUpRight size={14} /></Link><Link href="/admin/domicilios/nuevo"><Bike size={18} /> Nuevo domicilio <ArrowUpRight size={14} /></Link><Link href="/admin/caja"><Banknote size={18} /> Abrir caja <ArrowUpRight size={14} /></Link><Link href="/admin/reportes"><CalendarDays size={18} /> Ver reportes <ArrowUpRight size={14} /></Link></div></article>
    </section>
  </main>;
}

function Metric({ icon: Icon, label, value, note, href, tone }: { icon: typeof WalletCards; label: string; value: string; note: string; href: string; tone: string }) {
  return <Link href={href} className={`admin-home-metric is-${tone}`}><span className="admin-home-metricIcon"><Icon size={20} /></span><span><small>{label}</small><strong>{value}</strong><em>{note}</em></span><ArrowUpRight size={17} /></Link>;
}

function Priority({ icon: Icon, title, value, description, href, accent }: { icon: typeof WalletCards; title: string; value: string | number; description: string; href: string; accent: string }) {
  return <Link href={href} className={`admin-home-priority is-${accent}`}><span className="admin-home-priorityIcon"><Icon size={18} /></span><span><b>{title}</b><small>{description}</small></span><strong>{value}</strong><ArrowUpRight size={16} /></Link>;
}
