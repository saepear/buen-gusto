import { formatCOP } from "@/lib/format";
import { AjustePago } from "./ajustes";
import "./pago.css";

export function FichaPago({ pago, editable = false }: { editable?: boolean; pago: {
  id: number; salarioBase: number; totalDevengado: number; totalDeducciones: number; netoAPagar: number;
  empleado: { nombre: string; apellidos: string; cargo: string }; periodo: { fechaDesde: string; fechaHasta: string };
  conceptos: { id: number; clave: string; tipo: string; etiqueta: string; valor: number }[];
} }) {
  const extras = pago.conceptos.filter(c => c.tipo === "DEVENGADO" && c.clave !== "SALARIO" && c.valor !== 0);
  const deducciones = pago.conceptos.filter(c => c.tipo === "DEDUCCION" && c.valor !== 0);
  return <article className="pago-ficha">
    <header><p className="pago-eyebrow">EL BUEN GUSTO · COMPROBANTE DE PAGO</p><h2>{pago.empleado.nombre} {pago.empleado.apellidos}</h2>
      <p>{pago.empleado.cargo} · {pago.periodo.fechaDesde} — {pago.periodo.fechaHasta}</p></header>
    <div className="pago-linea"><span>Pago base</span><strong>{formatCOP(pago.salarioBase)}</strong></div>
    <h3>Extras e incentivos</h3>
    {extras.length ? extras.map(c => <div className="pago-linea" key={c.id}><div>{c.etiqueta}{editable && c.clave.startsWith("AJUSTE_") && <AjustePago pagoId={pago.id} quitar={c.id} />}</div><strong>{formatCOP(c.valor)}</strong></div>) : <p className="pago-vacio">Sin extras registrados</p>}
    <div className="pago-linea pago-subtotal"><span>Subtotal</span><strong>{formatCOP(pago.totalDevengado)}</strong></div>
    <h3>Deducciones</h3>
    {deducciones.length ? deducciones.map(c => <div className="pago-linea" key={c.id}><div>{c.etiqueta}{editable && c.clave.startsWith("AJUSTE_") && <AjustePago pagoId={pago.id} quitar={c.id} />}</div><strong>− {formatCOP(c.valor)}</strong></div>) : <p className="pago-vacio">Sin deducciones</p>}
    <div className="pago-linea pago-subtotal"><span>Total deducciones</span><strong>{formatCOP(pago.totalDeducciones)}</strong></div>
    <div className="pago-linea pago-total"><span>Total a entregar</span><strong>{formatCOP(pago.netoAPagar)}</strong></div>
  </article>;
}
