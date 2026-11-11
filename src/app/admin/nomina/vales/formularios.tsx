"use client";
import { useActionState, useState } from "react";
import { formatCOP } from "@/lib/format";
import { registrarVale, type EstadoAccionVale } from "./actions";
import "../operaciones.css";

const INICIAL: EstadoAccionVale = { error: null, ok: null };
export type PropsRegistroVale = {
  empleados: { id: number; nombre: string }[];
  productos: { id: number; nombre: string; precio: number }[];
  ciclos: { id: number; etiqueta: string }[];
  hoy: string;
  empleadoInicial?: number;
  cicloInicial?: number;
  abiertoInicial?: boolean;
  onSuccess?: () => void;
};
export function FormularioRegistroVale({ empleados, productos, hoy, empleadoInicial, onSuccess }: PropsRegistroVale) {
  const [tipo, setTipo] = useState("DINERO");
  const [producto, setProducto] = useState("");
  const [precio, setPrecio] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [estado, accion, guardando] = useActionState(async (prev: EstadoAccionVale, form: FormData) => {
    const resultado = await registrarVale(prev, form);
    if (resultado.ok) onSuccess?.();
    return resultado;
  }, INICIAL);
  return <form action={accion} className="nomina-shortForm">
    {estado.error && <p role="alert" className="text-sm text-danger-text">{estado.error}</p>}
    {estado.ok && <p role="status" className="text-sm text-success-text">{estado.ok}</p>}
    <label>Empleado<select name="empleadoId" required defaultValue={empleadoInicial ?? ""}><option value="" disabled>Elige a quién se lo entregas</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>
    <div className="nomina-operationFilters" aria-label="Tipo de vale">{[["DINERO","Anticipo en dinero"],["PRODUCTO","Producto del catálogo"]].map(([v,t]) => <button type="button" key={v} aria-pressed={tipo === v} onClick={() => { setTipo(v); setPrecio(""); setProducto(""); setCantidad("1"); }}>{t}</button>)}</div>
    {tipo === "DINERO" ? <><input type="hidden" name="productoNombre" value="Anticipo en dinero" /><input type="hidden" name="cantidad" value="1" /><label>¿Cuánto le entregas? (COP)<input name="precioUnitario" inputMode="numeric" required value={precio} onChange={e => setPrecio(e.target.value.replace(/[^0-9]/g,""))} placeholder="Ej. 20000" /></label></> : <>
      <label>Producto<select name="productoId" required value={producto} onChange={e => { setProducto(e.target.value); const p = productos.find(p => String(p.id) === e.target.value); setPrecio(p?.precio ? String(p.precio) : ""); }}><option value="" disabled>Seleccionar producto…</option>{productos.map(p => <option value={p.id} key={p.id}>{p.nombre} · {formatCOP(p.precio)}</option>)}</select></label>
      <div className="nomina-shortFormRow"><label>Cantidad<input name="cantidad" type="number" min="1" max="99" required value={cantidad} onChange={e => setCantidad(e.target.value)} /></label><label>Precio por unidad (COP)<input name="precioUnitario" inputMode="numeric" required value={precio} onChange={e => setPrecio(e.target.value.replace(/[^0-9]/g,""))} placeholder="Precio del producto" /></label></div>
    </>}
    <details><summary>Fecha y nota (opcional)</summary><div><label>Fecha de entrega<input name="fecha" type="date" required defaultValue={hoy} /></label><label>Nota<input name="observaciones" maxLength={200} placeholder="Detalle del anticipo o consumo" /></label></div></details>
    <div className="nomina-shortFormTotal"><span>Total del vale</span><strong>{formatCOP(Number(precio || 0) * Number(cantidad || 0))}</strong></div>
    <p className="text-xs text-texto-muted">Se descontará automáticamente en el próximo pago disponible del empleado. Para préstamos en cuotas usa Créditos.</p>
    <button type="submit" className="nomina-operationPrimary" disabled={guardando || !empleados.length}>{guardando ? "Guardando…" : "Registrar vale"}</button>
  </form>;
}
