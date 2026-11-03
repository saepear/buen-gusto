import { db } from "@/lib/db";
import { claveDia } from "@/lib/format";
import { precioUnitarioItem } from "@/lib/precios";
import {
  CATEGORIA_GASTO_LABEL,
  ESTADO_CUENTA,
  ESTADO_DOMICILIO,
  ESTADO_DOMICILIO_LABEL,
  ESTADO_PEDIDO_LABEL,
  ESTADOS_ACTIVOS_DOMICILIO,
  METODOS_PAGO,
  ORIGEN_GASTO_LABEL,
  type EstadoDomicilio,
  type EstadoPedido,
} from "@/lib/roles";

/**
 * Línea de un pedido tal como va a la hoja «Pedidos» del Excel.
 */
export type FilaPedidoReporte = {
  id: number;
  hora: Date;
  /** nombre de la mesa, «Para llevar» o «Domicilio · cliente» */
  canal: string;
  estadoLabel: string;
  /** «Efectivo», «Efectivo + Tarjeta », … o null si aún no se cobra */
  metodos: string | null;
  /** suma de las líneas de la comanda (precio guardado al ordenar) */
  totalComanda: number;
  /** pagado en caja (pagos + propinas); 0 si no hay pagos */
  totalPagado: number;
};

/**
 * Línea de un domicilio para la hoja «Domicilios».
 */
export type FilaDomicilioReporte = {
  id: number;
  hora: Date;
  cliente: string;
  telefono: string;
  barrio: string | null;
  direccion: string;
  horaEntrega: string | null;
  estadoLabel: string;
  domiciliario: string;
  cobradoMonto: number | null;
  cobradoMetodo: string | null;
};

/** Abono/pago de una deuda recibido en el día (dinero SÍ entró hoy) */
export type FilaAbonoReporte = {
  id: number;
  hora: Date;
  cuentaId: number;
  cliente: string;
  concepto: string;
  monto: number;
  metodoLabel: string;
  usuario: string;
  nota: string | null;
};

/** Deuda (cuenta por cobrar) creada en el día (promesa de pago, no ingreso) */
export type FilaCuentaReporte = {
  id: number;
  hora: Date;
  cliente: string;
  telefono: string;
  concepto: string;
  valorOriginal: number;
  pedidoId: number | null;
  creadoPor: string;
};

/** Gasto del día (anulado o no; los anulados no suman) */
export type FilaGastoReporte = {
  id: number;
  hora: Date;
  descripcion: string;
  categoriaLabel: string;
  valor: number;
  metodoLabel: string;
  origenLabel: string;
  usuario: string;
  observaciones: string | null;
  anulado: boolean;
  anuladoMotivo: string | null;
  anuladoPor: string | null;
};

/** Apartado del día */
export type FilaApartadoReporte = {
  id: number;
  hora: Date;
  cliente: string;
  estadoLabel: string;
  fechaEntrega: string | null;
  horaEntrega: string | null;
  total: number;
  pedidoId: number | null;
  /** true = se fió en la entrega (nació como deuda) */
  fiado: boolean | null;
  usuario: string;
};

/** Estado de apartado en texto corto (sin importar roles en la plantilla) */
function apEstadoLabel(estado: string): string {
  switch (estado) {
    case "PENDIENTE":
      return "Por entregar";
    case "ENTREGADO":
      return "Entregado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return estado;
  }
}

/**
 * Resumen por repartidor (domicilios ENTREGADOS en el día).
 */
export type FilaRepartidor = {
  nombre: string;
  entregas: number;
  recaudo: number;
};

/**
 * TODO el cálculo del reporte de UN día. Lo consume la página de Reportes
 * (que pinta los mismos números) y la exportación a Excel: una sola fuente
 * de verdad, mismas consultas a la base, cero lógica duplicada.
 *
 * `fechaDia` debe ser la medianoche local del día a reportar.
 */
export async function datosReporte(fechaFila: Date) {
  const hastaDia = new Date(fechaFila);
  hastaDia.setDate(hastaDia.getDate() + 1); // exclusivo: cubre el día completo

  const desdeSemana = new Date(fechaFila);
  desdeSemana.setDate(desdeSemana.getDate() - 6); // ventanita de 7 días

  const [
    pagosHoy,
    pedidosHoy,
    pagosSemana,
    cierres,
    domiciliosHoy,
    abonosHoy,
    cuentasCreadasHoy,
    cuentasPendientes,
    gastosHoy,
    apartadosHoy,
  ] = await Promise.all([
    db.pago.findMany({
      where: { createdAt: { gte: fechaFila, lt: hastaDia } },
      orderBy: { createdAt: "asc" },
    }),
    db.pedido.findMany({
      where: { createdAt: { gte: fechaFila, lt: hastaDia } },
      include: {
        items: { include: { producto: true } },
        mesa: true,
        pagos: true,
        domicilio: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.pago.findMany({
      where: { createdAt: { gte: desdeSemana, lt: hastaDia } },
      orderBy: { createdAt: "asc" },
    }),
    db.cierreCaja.findMany({
      orderBy: { fecha: "desc" },
      take: 7,
      include: { cerradoPor: true },
    }),
    db.domicilio.findMany({
      where: { createdAt: { gte: fechaFila, lt: hastaDia } },
      include: { domiciliario: true },
      orderBy: { createdAt: "asc" },
    }),
    // ═══ Módulos financieros del día ═══
    // Dinero DEUDAS recibido hoy (¡no es venta: es cobro de algo fiado!)
    db.abonoCuenta.findMany({
      where: { createdAt: { gte: fechaFila, lt: hastaDia } },
      include: { cuenta: { include: { cliente: true } }, registradoPor: true },
      orderBy: { createdAt: "asc" },
    }),
    // Deudas creadas HOY (promesas: no tocan la caja)
    db.cuentaPorCobrar.findMany({
      where: { createdAt: { gte: fechaFila, lt: hastaDia } },
      include: { cliente: true, creadoPor: true },
      orderBy: { createdAt: "asc" },
    }),
    // Todo lo que sigue debiéndose AL MOMENTO de este reporte
    db.cuentaPorCobrar.findMany({
      where: { estado: ESTADO_CUENTA.PENDIENTE },
      include: { cliente: true, creadoPor: true },
      orderBy: { createdAt: "asc" },
    }),
    // Gastos del día (los anulados se listan pero no suman)
    db.gasto.findMany({
      where: { createdAt: { gte: fechaFila, lt: hastaDia } },
      include: { registradoPor: true, anuladoPor: true },
      orderBy: { createdAt: "asc" },
    }),
    // Apartados creados hoy (para la sección del día)
    db.apartado.findMany({
      where: { createdAt: { gte: fechaFila, lt: hastaDia } },
      include: { cliente: true, items: true, pedido: true, cuenta: true, creadoPor: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const claveDiaReporte = claveDia(fechaFila);

  // ---- Resumen del día ----
  const totalPagos = pagosHoy.reduce((s, p) => s + p.total, 0);
  const propinasHoy = pagosHoy.reduce((s, p) => s + p.propina, 0);
  const pagadoHoy = totalPagos + propinasHoy;
  const porMetodo = new Map<string, number>();
  const pagosPorMetodo = new Map<string, number>();
  for (const m of METODOS_PAGO) {
    porMetodo.set(m, 0);
    pagosPorMetodo.set(m, 0);
  }
  for (const p of pagosHoy) {
    porMetodo.set(p.metodo, (porMetodo.get(p.metodo) ?? 0) + p.total);
    pagosPorMetodo.set(
      p.metodo,
      (pagosPorMetodo.get(p.metodo) ?? 0) + 1,
    );
  }
  const propinasPorMetodo = new Map<string, number>(METODOS_PAGO.map((m) => [m, 0]));
  for (const p of pagosHoy) {
    propinasPorMetodo.set(
      p.metodo,
      (propinasPorMetodo.get(p.metodo) ?? 0) + p.propina,
    );
  }
  const ticketPromedio =
    pagosHoy.length > 0 ? Math.round(pagadoHoy / pagosHoy.length) : 0;

  // ---- Comandas del día ----
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
  const porProteina = new Map<
    string,
    { unidades: number; sinSopa: number; recaudo: number }
  >();
  const extras = new Map<
    string,
    { unidades: number; recaudo: number; tipo: string }
  >();
  for (const pedido of servidas) {
    for (const item of pedido.items) {
      if (item.tipo === "PROTEINA") {
        const fila = porProteina.get(item.producto.nombre) ?? {
          unidades: 0,
          sinSopa: 0,
          recaudo: 0,
        };
        fila.unidades += item.cantidad;
        fila.recaudo += precioUnitarioItem(item) * item.cantidad;
        if (item.conSopa === false) fila.sinSopa += item.cantidad;
        porProteina.set(item.producto.nombre, fila);
      } else if (precioUnitarioItem(item) > 0) {
        const fila = extras.get(item.producto.nombre) ?? {
          unidades: 0,
          recaudo: 0,
          tipo: item.tipo,
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

  // ---- Ingresos por hora (de los pagos: total + propina) ----
  const porHora = new Map<number, number>();
  for (const pago of pagosHoy) {
    const h = pago.createdAt.getHours();
    porHora.set(h, (porHora.get(h) ?? 0) + pago.total + pago.propina);
  }
  const horasLista = [...porHora.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([h, valor]) => ({
      /** etiqueta legible ya lista para pantalla y Excel: «7 h» */
      etiqueta: `${h} h`,
      hora: h,
      valor,
    }));

  // ---- Ventana de 7 días que TERMINA en el día reportado ----
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
      resaltar: k === claveDiaReporte,
    };
  });

  // ---- Detalle de pedidos para la hoja «Pedidos» ----
  const filasPedidos: FilaPedidoReporte[] = pedidosHoy.map((pedido) => {
    const canal = pedido.domicilio
      ? `Domicilio · ${pedido.domicilio.cliente}`
      : pedido.paraLlevar
        ? "Para llevar"
        : (pedido.mesa?.nombre ?? "—");
    const metodos =
      pedido.pagos.length > 0
        ? pedido.pagos
            .map((p) => ETIQUETA_METODO[p.metodo] ?? p.metodo)
            .join(" + ")
        : null;
    return {
      id: pedido.id,
      hora: pedido.createdAt,
      canal,
      estadoLabel: ESTADO_PEDIDO_LABEL[pedido.estado as EstadoPedido] ?? pedido.estado,
      metodos,
      totalComanda: pedido.items.reduce(
        (s, i) => s + precioUnitarioItem(i) * i.cantidad,
        0,
      ),
      totalPagado: pedido.pagos.reduce((s, p) => s + p.total + p.propina, 0),
    };
  });

  // ---- Domicilios del día ----
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
  const filasDomicilios: FilaDomicilioReporte[] = domiciliosHoy.map((d) => ({
    id: d.id,
    hora: d.createdAt,
    cliente: d.cliente,
    telefono: d.telefono,
    barrio: d.barrio,
    direccion: d.direccion,
    horaEntrega: d.horaEntrega,
    estadoLabel: ESTADO_DOMICILIO_LABEL[d.estado as EstadoDomicilio] ?? d.estado,
    domiciliario: d.domiciliario?.nombre ?? "Sin asignar",
    cobradoMonto: d.cobradoMonto,
    cobradoMetodo: d.cobradoMetodo,
  }));

  // ---- Cierre de caja del día (y últimos 7 cierres para el historial) ----
  const cierreHoy =
    cierres.find((c) => c.fecha === claveDiaReporte) ?? null;

  // ---- Dinero RECIBIDO por deudas (abonos): separado de las ventas ----
  const abonosTotal = abonosHoy.reduce((s, a) => s + a.monto, 0);
  const abonosPorMetodo = new Map<string, number>(
    METODOS_PAGO.map((m) => [m, 0]),
  );
  for (const a of abonosHoy) {
    abonosPorMetodo.set(a.metodo, (abonosPorMetodo.get(a.metodo) ?? 0) + a.monto);
  }
  const filasAbonos: FilaAbonoReporte[] = abonosHoy.map((a) => ({
    id: a.id,
    hora: a.createdAt,
    cuentaId: a.cuentaId,
    cliente: a.cuenta?.cliente?.nombre ?? "—",
    concepto: a.cuenta?.concepto ?? "—",
    monto: a.monto,
    metodoLabel: ETIQUETA_METODO[a.metodo] ?? a.metodo,
    usuario: a.registradoPor?.nombre ?? "—",
    nota: a.nota,
  }));

  // ---- Deudas creadas hoy (no son ingreso: quedan por cobrar) ----
  const cxcCreadasValor = cuentasCreadasHoy.reduce(
    (s, c) => s + c.valorOriginal,
    0,
  );
  const filasCuentasCreadas: FilaCuentaReporte[] = cuentasCreadasHoy.map((c) => ({
    id: c.id,
    hora: c.createdAt,
    cliente: c.cliente?.nombre ?? "—",
    telefono: c.cliente?.telefono ?? "",
    concepto: c.concepto,
    valorOriginal: c.valorOriginal,
    pedidoId: c.pedidoId,
    creadoPor: c.creadoPor?.nombre ?? "—",
  }));

  // ---- Fotografía de lo pendiente AL MOMENTO de este reporte ----
  const cxcPendienteTotal = cuentasPendientes.reduce(
    (s, c) => s + Math.max(0, c.valorOriginal - c.pagado),
    0,
  );
  const cuentasPendientesLista = cuentasPendientes.map((c) => ({
    id: c.id,
    cliente: c.cliente?.nombre ?? "—",
    telefono: c.cliente?.telefono ?? "",
    concepto: c.concepto,
    fecha: claveDia(c.createdAt),
    valor: c.valorOriginal,
    abonado: c.pagado,
    saldo: Math.max(0, c.valorOriginal - c.pagado),
  }));

  // ---- Gastos del día: con origen CAJA tocan el efectivo ----
  const gastosVivos = gastosHoy.filter((g) => !g.anulado);
  const gastosCaja = gastosVivos
    .filter((g) => g.origen === "CAJA")
    .reduce((s, g) => s + g.valor, 0);
  const gastosCajaEfectivo = gastosVivos
    .filter((g) => g.origen === "CAJA" && g.metodo === "EFECTIVO")
    .reduce((s, g) => s + g.valor, 0);
  const gastosExternos = gastosVivos
    .filter((g) => g.origen === "EXTERNO")
    .reduce((s, g) => s + g.valor, 0);
  const gastosTotal = gastosCaja + gastosExternos;
  const filasGastos: FilaGastoReporte[] = gastosHoy.map((g) => ({
    id: g.id,
    hora: g.createdAt,
    descripcion: g.descripcion,
    categoriaLabel:
      CATEGORIA_GASTO_LABEL[g.categoria as keyof typeof CATEGORIA_GASTO_LABEL] ??
      g.categoria,
    valor: g.valor,
    metodoLabel: ETIQUETA_METODO[g.metodo] ?? g.metodo,
    origenLabel:
      ORIGEN_GASTO_LABEL[g.origen as keyof typeof ORIGEN_GASTO_LABEL] ?? g.origen,
    usuario: g.registradoPor?.nombre ?? "—",
    observaciones: g.observaciones,
    anulado: g.anulado,
    anuladoMotivo: g.anuladoMotivo,
    anuladoPor: g.anuladoPor?.nombre ?? null,
  }));

  // ---- Apartados del día ----
  const apartadosCreados = apartadosHoy.length;
  const apartadosEntregados = apartadosHoy.filter(
    (a) => a.estado === "ENTREGADO",
  ).length;
  const filasApartados: FilaApartadoReporte[] = apartadosHoy.map((a) => ({
    id: a.id,
    hora: a.createdAt,
    cliente: a.cliente?.nombre ?? "—",
    estadoLabel: apEstadoLabel(a.estado),
    fechaEntrega: a.fechaEntrega,
    horaEntrega: a.horaEntrega,
    total: a.total,
    pedidoId: a.pedidoId,
    fiado: a.cuentaId ? true : null,
    usuario: a.creadoPor?.nombre ?? "—",
  }));

  // ---- Efectivo disponible al final del día (dinero físicamente en caja) ----
  // ventas en efectivo + abonos en efectivo − gastos pagados con efectivo de caja
  const efectivoVentas =
    (porMetodo.get("EFECTIVO") ?? 0) + (propinasPorMetodo.get("EFECTIVO") ?? 0);
  const efectivoAbonos = abonosPorMetodo.get("EFECTIVO") ?? 0;
  const efectivoDisponible = efectivoVentas + efectivoAbonos - gastosCajaEfectivo;

  return {
    fechaDia: fechaFila,
    claveDiaReporte,
    pagosHoy,
    totalPagos,
    propinasHoy,
    pagadoHoy,
    ticketPromedio,
    porMetodo,
    pagosPorMetodo,
    propinasPorMetodo,
    numeroPagos: pagosHoy.length,
    numeroComandas: servidas.length,
    servidas,
    enCocina,
    canceladas,
    proteinasLista,
    extrasLista,
    horasLista,
    dias,
    filasPedidos,
    domiciliosHoy,
    domEntregados,
    domEnCurso,
    domFallidos,
    recaudoDomicilios,
    repartidoresLista,
    filasDomicilios,
    cierres,
    cierreHoy,
    // —— Módulos financieros (abonos, deudas, gastos, apartados) ——
    abonosHoy,
    abonosTotal,
    abonosPorMetodo,
    numeroAbonos: abonosHoy.length,
    filasAbonos,
    cuentasCreadasHoy,
    cxcCreadasCantidad: cuentasCreadasHoy.length,
    cxcCreadasValor,
    filasCuentasCreadas,
    cuentasPendientes,
    cxcPendienteTotal,
    cuentasPendientesLista,
    gastosHoy,
    gastosTotal,
    gastosCaja,
    gastosCajaEfectivo,
    gastosExternos,
    filasGastos,
    apartadosHoy,
    apartadosCreados,
    apartadosEntregados,
    filasApartados,
    // —— Efectivo disponible (dinero físicamente en caja) ——
    efectivoVentas,
    efectivoAbonos,
    efectivoDisponible,
  };
}

/** Etiqueta legible del método de pago (la misma del módulo) */
export const ETIQUETA_METODO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

/** Todo el reporte de un día, listo para pintar o para exportar */
export type DatosReporte = Awaited<ReturnType<typeof datosReporte>>;
