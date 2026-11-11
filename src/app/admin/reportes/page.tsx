import { claveDia } from "@/lib/format";
import { inicioDeHoy } from "@/lib/pedido";
import { datosReporte } from "./datos-reporte";
import { PanelReportes } from "./panel-reportes";

export const metadata = { title: "Reportes" };

export default async function PaginaReportes(props: PageProps<"/admin/reportes">) {
  const { fecha: fechaCruda } = await props.searchParams;
  const hoyClave = claveDia(new Date());
  let fechaFila = inicioDeHoy();
  if (typeof fechaCruda === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fechaCruda)) {
    const [ano, mes, dia] = fechaCruda.split("-").map(Number);
    fechaFila = new Date(ano, mes - 1, dia);
  }
  const datos = await datosReporte(fechaFila);
  const aIso = (fecha: Date) => fecha.toISOString();
  const cerrar = (c: (typeof datos.cierres)[number]) => ({
    id: c.id,
    fecha: c.fecha,
    total: c.totalPagos + c.totalPropinas,
    pagos: c.numeroPagos,
    comandas: c.numeroComandas,
    efectivoContado: c.efectivoContado,
    efectivoEsperado: c.efectivoEsperado ?? c.totalEfectivo,
    cerradoPor: c.cerradoPor.nombre,
  });

  return <PanelReportes reporte={{
    fecha: claveDia(fechaFila),
    esHistorico: claveDia(fechaFila) !== hoyClave,
    resumen: {
      ventas: datos.pagadoHoy, abonos: datos.abonosTotal, gastosCaja: datos.gastosCaja,
      gastosCajaEfectivo: datos.gastosCajaEfectivo, gastosExternos: datos.gastosExternos,
      gastosTotal: datos.gastosTotal, efectivo: datos.efectivoDisponible, propinas: datos.propinasHoy,
      ticket: datos.ticketPromedio, pagos: datos.numeroPagos, fiadoPendiente: datos.cxcPendienteTotal,
      fiadoNuevo: datos.cxcCreadasValor, cuentasNuevas: datos.cxcCreadasCantidad,
      servidas: datos.servidas.length, cocina: datos.enCocina.length, canceladas: datos.canceladas.length,
      domicilios: datos.domiciliosHoy.length, domCobrados: datos.domCobrados.length,
      domPendientes: datos.domEnCurso.length, domCancelados: datos.domFallidos.length,
      recaudoDomicilios: datos.recaudoDomicilios, apartados: datos.apartadosCreados,
      apartadosEntregados: datos.apartadosEntregados,
    },
    metodos: [...datos.porMetodo.entries()].map(([nombre, valor]) => ({ nombre, valor })),
    abonosMetodos: [...datos.abonosPorMetodo.entries()].map(([nombre, valor]) => ({ nombre, valor })),
    proteinas: datos.proteinasLista.map(([nombre, fila]) => ({ nombre, unidades: fila.unidades, sinSopa: fila.sinSopa })),
    extras: datos.extrasLista.map(([nombre, fila]) => ({ nombre, unidades: fila.unidades, recaudo: fila.recaudo })),
    horas: datos.horasLista.map(({ etiqueta, valor }) => ({ etiqueta, valor })),
    dias: datos.dias,
    domicilios: datos.filasDomicilios.map(d => ({ id: d.id, numero: d.numero, hora: aIso(d.hora), cliente: d.cliente, telefono: d.telefono, barrio: d.barrio, direccion: d.direccion, estado: d.estadoLabel, cobrado: d.cobradoMonto, metodo: d.cobradoMetodo })),
    fiados: datos.filasCuentasCreadas.map(c => ({ id: c.id, cliente: c.cliente, concepto: c.concepto, valor: c.valorOriginal, origen: c.origenTipo, items: c.items.map(i => ({ nombre: i.nombre, cantidad: i.cantidad })), estado: c.estadoLabel })),
    abonos: datos.filasAbonos.map(a => ({ id: a.id, hora: aIso(a.hora), cliente: a.cliente, concepto: a.concepto, monto: a.monto, metodo: a.metodoLabel, usuario: a.usuario })),
    gastos: datos.filasGastos.map(g => ({ id: g.id, hora: aIso(g.hora), descripcion: g.descripcion, categoria: g.categoriaLabel, valor: g.valor, metodo: g.metodoLabel, origen: g.origenLabel, usuario: g.usuario, anulado: g.anulado })),
    condonaciones: datos.filasCondonaciones.map(c => ({ id: c.id, cliente: c.cliente, concepto: c.concepto, valor: c.condonado, usuario: c.condonadoPor, motivo: c.motivo })),
    cierres: datos.cierres.map(cerrar),
    cierreHoy: datos.cierreHoy ? cerrar(datos.cierreHoy) : null,
  }} />;
}
