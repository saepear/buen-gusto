"use client";
import { useActionState, useRef, useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Ticket, HandCoins, X, ArrowUpRight, Search, CalendarDays } from "lucide-react";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { formatCOP } from "@/lib/format";
import { abrirPagoEmpleado, registrarCredito } from "./pago-directo-actions";
import { ContenidoPago } from "./pagos/contenido-pago";
import { ContenidoEmpleadoPagos } from "./pagos/contenido-empleado";
import { FormularioRegistroVale } from "./vales/formularios";
import { NavegacionNomina } from "./navegacion";
import type { DatosPago } from "./pagos/datos-pago";
import "./operaciones.css";

type Empleado = { id: number; nombre: string; cargo: string; salarioMensual: number; periodicidadPago: string; remuneracion: string; proximo: string };
type Credito = { id: number; empleadoId: number; nombre: string; monto: number; motivo: string; cuotas: { id: number; fecha: string; valor: number; aplicada: boolean }[] };
const frecuencia = (valor: string) => valor === "MENSUAL" ? "Mensual" : valor === "QUINCENAL" ? "Quincenal" : "Semanal";

export function EquipoPagos({ empleados, productos, pagos, creditos, hoy }: { empleados: Empleado[]; productos: { id: number; nombre: string; precio: number }[]; pagos: DatosPago[]; creditos: Credito[]; hoy: string }) {
  const router = useRouter();
  const [buscar, setBuscar] = useState("");
  const [modal, setModal] = useState<{ tipo: "empleado" | "vale" | "credito"; empleadoId?: number; origen: OrigenModal } | null>(null);
  const [pago, setPago] = useState<DatosPago | null>(null);
  const [error, setError] = useState("");
  const [cargando, iniciar] = useTransition();
  const [historial, setHistorial] = useState(false);
  const solicitudPago = useRef(0);
  const elegido = empleados.find(e => e.id === modal?.empleadoId);
  function abrir(tipo: "empleado" | "vale" | "credito", event: MouseEvent<HTMLButtonElement>, empleadoId?: number) {
    const r = event.currentTarget.getBoundingClientRect();
    setModal({ tipo, empleadoId, origen: { x: r.x, y: r.y, w: r.width, h: r.height } });
    setPago(null); setError(""); setHistorial(false);
    if (tipo === "empleado" && empleadoId) cargarPago(empleadoId);
  }
  function cargarPago(empleadoId = elegido?.id) {
    if (!empleadoId) return;
    const solicitud = ++solicitudPago.current;
    iniciar(async () => {
      try {
        setError("");
        const resultado = await abrirPagoEmpleado(empleadoId);
        if (solicitud === solicitudPago.current) setPago(resultado);
      } catch (e) {
        if (solicitud === solicitudPago.current) setError(e instanceof Error ? e.message : "No se pudo abrir el pago.");
      }
    });
  }
  const actualizado = pago && pago.empleadoId === elegido?.id ? pagos.find(p => p.id === pago.id) ?? pago : null;
  return <div className="nomina-operations">
    <header className="nomina-operationHero"><div className="nomina-operationTitle"><span className="nomina-operationIcon"><Wallet /></span><div><p className="nomina-operationEyebrow">EL BUEN GUSTO · EQUIPO</p><h1>Nómina, sin vueltas</h1><p>Elige una persona, revisa sus descuentos y registra la entrega.</p></div></div><div className="flex flex-wrap gap-2"><button className="nomina-operationSecondary" onClick={e => abrir("vale", e)}><Ticket size={17} /> Registrar vale</button><button className="nomina-operationPrimary" onClick={e => abrir("credito", e)}><HandCoins size={17} /> Nuevo crédito</button></div></header>
    <NavegacionNomina actual="/admin/nomina" />
    <section className="nomina-operationBox mb-5"><h3><CalendarDays size={18} className="inline mr-2" />Fechas de pago</h3><p>Semanal: 7, 14, 21 y fin de mes · Quincenal: 15 y fin de mes · Mensual: fin de mes.</p><p>La frecuencia se elige en el perfil del empleado. Puedes registrar el pago antes o después de la fecha prevista.</p></section>
    <div className="nomina-operationToolbar"><label><Search size={18} /><input aria-label="Buscar empleado" placeholder="Buscar por nombre o cargo…" value={buscar} onChange={e => setBuscar(e.target.value)} /></label></div>
    <div className="nomina-operationGrid">{empleados.filter(e => `${e.nombre} ${e.cargo}`.toLowerCase().includes(buscar.toLowerCase())).map(e => {
      const fecha = e.proximo;
      return <button className="nomina-operationTile" key={e.id} onClick={event => abrir("empleado", event, e.id)}><div className="nomina-tileHeading"><span className="nomina-operationAvatar">{e.nombre.split(" ").slice(0,2).map(n => n[0]).join("")}</span><span className="nomina-operationBadge">{frecuencia(e.periodicidadPago)}</span><ArrowUpRight size={18} /></div><h2>{e.nombre}</h2><p>{e.cargo}</p><p className="nomina-tilePeriod">{fecha <= hoy ? "Pago por revisar" : "Fecha prevista"} · {fecha}</p><footer><span>Salario mensual<strong>{formatCOP(e.salarioMensual)}</strong></span><span>Pagar / ver historial →</span></footer></button>;
    })}</div>
    {!empleados.length && <div className="nomina-operationEmpty">Agrega una persona desde Empleados para registrar su primer pago.</div>}
    <section className="mt-8"><h2 className="text-xl mb-4">Créditos y cuotas acordadas</h2><div className="nomina-operationGrid">{creditos.map(c => <article key={c.id} className="nomina-operationBox"><h3>{c.nombre}</h3><p>{c.motivo}</p><div className="nomina-moneyPair"><strong>{formatCOP(c.monto - c.cuotas.filter(q => q.aplicada).reduce((s,q) => s + q.valor,0))}</strong><span>Por descontar</span></div><details><summary className="cursor-pointer">Ver {c.cuotas.length} cuotas · préstamo {formatCOP(c.monto)}</summary>{c.cuotas.map(q => <div className="nomina-delivery" key={q.id}><span>{q.fecha} · {q.aplicada ? "Descontada" : "Programada"}</span><b>{formatCOP(q.valor)}</b></div>)}</details></article>)}</div>{!creditos.length && <p className="text-sm text-texto-muted">No hay créditos registrados. Los vales se descuentan completos; los créditos se reparten en las fechas elegidas.</p>}</section>
    {modal && <ModalFlip origen={modal.origen} onClose={() => setModal(null)} animacion="suave" ariaLabel={elegido?.nombre ?? "Registrar movimiento"} panelClassName={modal.tipo === "empleado" ? "nomina-operationModal nomina-paymentModal" : "nomina-operationModal"}>{cerrar => <><header className="nomina-operationModalHeader"><div><p className="nomina-operationEyebrow">NÓMINA · {modal.tipo === "empleado" ? "PAGO E HISTORIAL" : modal.tipo.toUpperCase()}</p><h2>{elegido?.nombre ?? (modal.tipo === "vale" ? "Registrar vale" : "Crédito en cuotas")}</h2></div><button aria-label="Cerrar" onClick={cerrar}><X /></button></header><div className="nomina-operationModalBody">
      {modal.tipo === "vale" && <FormularioRegistroVale empleados={empleados} productos={productos} ciclos={[]} hoy={hoy} onSuccess={() => { router.refresh(); cerrar(); }} />}
      {modal.tipo === "credito" && <FormularioCredito empleados={empleados} hoy={hoy} alGuardar={() => { router.refresh(); cerrar(); }} />}
      {modal.tipo === "empleado" && elegido && <><div className="nomina-operationFilters mb-5"><button disabled={cargando} onClick={() => { setHistorial(false); cargarPago(); }}>{cargando ? "Calculando…" : "Pagar ahora"}</button><button onClick={() => setHistorial(true)}>Historial y comprobantes</button></div>{error && <p role="alert" className="text-danger-text">{error}</p>}{historial ? <ContenidoEmpleadoPagos pagos={pagos.filter(p => p.empleadoId === elegido.id)} /> : actualizado ? <ContenidoPago pago={actualizado} /> : <section className="nomina-operationBox"><h3>{frecuencia(elegido.periodicidadPago)} · próximo pago {elegido.proximo}</h3><p>Al pulsar Pagar ahora aparecerán el sueldo, los extras, los vales y las cuotas que corresponden. Revisa el total antes de registrar la entrega.</p></section>}</>}
    </div></>}</ModalFlip>}
  </div>;
}

function FormularioCredito({ empleados, hoy, alGuardar }: { empleados: Empleado[]; hoy: string; alGuardar: () => void }) {
  const [monto, setMonto] = useState("");
  const [cuotas, setCuotas] = useState([{ fecha: hoy, valor: 0 }]);
  const [numero, setNumero] = useState(5);
  const [primera, setPrimera] = useState(hoy);
  const [estado, accion, pendiente] = useActionState(async (prev: { error: string | null; ok: string | null }, form: FormData) => { const res = await registrarCredito(prev, form); if (res.ok) alGuardar(); return res; }, { error: null, ok: null });
  return <form action={accion} className="nomina-shortForm">{estado.error && <p role="alert" className="text-danger-text">{estado.error}</p>}<label>Empleado<select name="empleadoId" required><option value="">Selecciona una persona</option>{empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label><label>Dinero prestado (COP)<input name="monto" type="number" min="1" max="50000000" required value={monto} onChange={e => setMonto(e.target.value)} /></label><label>Motivo<input name="motivo" required maxLength={200} placeholder="Ej. Compra de escritorio" /></label><p>Elige cuándo descontar cada cuota. Se aplicará al pago que cubra esa fecha o al siguiente disponible.</p>
    <label>Cómo entregas el dinero<select name="metodo" required><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo de caja</option><option value="OTRO">Otro</option></select></label>
    <p>Si entregas efectivo, se registrará su salida de caja al guardar el crédito.</p>
    <div className="nomina-shortFormRow"><label>Número de cuotas<input type="number" min="1" max="60" value={numero} onChange={e => setNumero(Number(e.target.value))} /></label><label>Primera fecha de descuento<input type="date" min={hoy} value={primera} onChange={e => setPrimera(e.target.value)} /></label></div>
    <button type="button" className="nomina-operationSecondary" disabled={!monto || !primera || !Number.isInteger(numero) || numero < 1 || numero > 60} onClick={() => {
      const [ano, mes, dia] = primera.split("-").map(Number);
      const esFin = dia === new Date(Date.UTC(ano, mes, 0)).getUTCDate();
      const base = Math.floor(Number(monto) / numero);
      setCuotas(Array.from({ length: numero }, (_, i) => {
        const fin = new Date(Date.UTC(ano, mes + i, 0)).getUTCDate();
        return { fecha: new Date(Date.UTC(ano, mes - 1 + i, esFin ? fin : Math.min(dia, fin))).toISOString().slice(0,10), valor: base + (i === numero - 1 ? Number(monto) % numero : 0) };
      }));
    }}>Proponer cuotas mensuales iguales</button>
    <p>Puedes cambiar cualquier fecha e importe de la propuesta antes de guardar.</p>
    <input type="hidden" name="cuotas" value={JSON.stringify(cuotas)} />
    {cuotas.map((c,i) => <div className="nomina-shortFormRow" key={i}><label>Fecha · cuota {i+1}<input type="date" required min={hoy} value={c.fecha} onChange={e => setCuotas(cuotas.map((q,j) => j === i ? { ...q, fecha: e.target.value } : q))} /></label><label>Valor<input type="number" min="1" required value={c.valor || ""} onChange={e => setCuotas(cuotas.map((q,j) => j === i ? { ...q, valor: Number(e.target.value) } : q))} /></label><button type="button" className="nomina-operationSecondary" disabled={cuotas.length === 1} onClick={() => setCuotas(cuotas.filter((_,j) => j !== i))}>Quitar</button></div>)}
    <div className="flex flex-wrap gap-2"><button type="button" className="nomina-operationSecondary" disabled={cuotas.length >= 60} onClick={() => setCuotas([...cuotas, { fecha: hoy, valor: 0 }])}>Añadir cuota</button><button type="button" className="nomina-operationSecondary" onClick={() => { const base = Math.floor(Number(monto) / cuotas.length); setCuotas(cuotas.map((c,i) => ({ ...c, valor: base + (i === cuotas.length-1 ? Number(monto) % cuotas.length : 0) }))); }}>Repartir importe por igual</button></div><div className="nomina-shortFormTotal"><span>Suma de cuotas</span><strong>{formatCOP(cuotas.reduce((s,c) => s+c.valor,0))} / {formatCOP(Number(monto))}</strong></div><button className="nomina-operationPrimary" disabled={pendiente}>{pendiente ? "Guardando…" : "Registrar crédito y cuotas"}</button>
  </form>;
}
