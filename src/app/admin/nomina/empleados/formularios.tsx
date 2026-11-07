"use client";

// ═════════ Formularios de empleados (client) ═════════
// Registrar (crea contrato inicial) · editar datos no contractuales ·
// actualizar contrato (nace versión nueva) · desactivar.
import { useState } from "react";
import { useActionState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import {
  actualizarContrato,
  crearEmpleado,
  desactivarEmpleado,
  editarEmpleado,
  type EstadoAccionPersona,
} from "./actions";

const INICIAL: EstadoAccionPersona = { error: null, ok: null };

const CAMPO =
  "w-full rounded-xl border-0 bg-fondo-app px-3 py-2.5 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/35 focus:ring-amber-brand/60";
const ETIQUETA = "text-xs font-bold tracking-wide text-texto-muted/60";

function Mensaje({ estado }: { estado: EstadoAccionPersona }) {
  if (estado.error)
    return (
      <p aria-live="polite" className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20">
        {estado.error}
      </p>
    );
  if (estado.ok)
    return (
      <p aria-live="polite" className="rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success-text ring-1 ring-success/20">
        {estado.ok}
      </p>
    );
  return null;
}

function SeccionPlegable({
  titulo,
  children,
  abiertaInicial = false,
  tono = "panel",
}: {
  titulo: string;
  children: (abierto: boolean) => React.ReactNode;
  abiertaInicial?: boolean;
  tono?: "panel" | "peligro";
}) {
  const [abierto, setAbierto] = useState(abiertaInicial);
  return (
    <section aria-label={titulo} className="w-full">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className={
          "flex items-center gap-2 rounded-2xl px-5 py-3 font-display text-md transition active:scale-95 " +
          (tono === "peligro"
            ? "bg-danger/15 text-danger-text ring-1 ring-danger/20 hover:bg-danger/25"
            : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-texto-app")
        }
      >
        <ChevronDown aria-hidden className={"h-4 w-4 transition-transform " + (abierto ? "rotate-180" : "")} />
        {titulo}
      </button>
      {abierto ? children(abierto) : null}
    </section>
  );
}

function CamposContrato({ inicial }: { inicial?:
  Partial<{
    modalidad: string;
    remuneracion: string;
    salarioMensual: number;
    salarioDiario: number;
    valorHora: number;
    jornadaSemanalMinutos: number;
    periodicidadPago: string;
    diaDescanso: number;
    metodoPago: string;
    arpClase: number;
  }> }) {
  return (
    <>
      <label className={ETIQUETA}>
        MODALIDAD *
        <select name="modalidad" defaultValue={inicial?.modalidad ?? "LABORAL"} className={CAMPO}>
          <option value="LABORAL">Contrato laboral</option>
          <option value="INDEPENDIENTE">Prestación de servicios</option>
        </select>
      </label>
      <label className={ETIQUETA}>
        REMUNERACIÓN *
        <select name="remuneracion" defaultValue={inicial?.remuneracion ?? "MENSUAL"} className={CAMPO}>
          <option value="MENSUAL">Mensual</option>
          <option value="DIARIO">Por día</option>
          <option value="HORARIO">Por hora</option>
        </select>
      </label>
      <label className={ETIQUETA}>
        SALARIO MENSUAL (COP)
        <input name="salarioMensual" inputMode="numeric" className={CAMPO} placeholder="$0" defaultValue={inicial?.salarioMensual ?? ""} />
      </label>
      <label className={ETIQUETA}>
        VALOR POR DÍA (si se paga por día)
        <input name="salarioDiario" inputMode="numeric" className={CAMPO} placeholder="$0" defaultValue={inicial?.salarioDiario ?? ""} />
      </label>
      <label className={ETIQUETA}>
        VALOR POR HORA (si se paga por hora)
        <input name="valorHora" inputMode="numeric" className={CAMPO} placeholder="$0" defaultValue={inicial?.valorHora ?? ""} />
      </label>
      <label className={ETIQUETA}>
        JORNADA SEMANAL (MINUTOS) *
        <input
          name="jornadaSemanalMinutos"
          inputMode="numeric"
          defaultValue={inicial?.jornadaSemanalMinutos ?? 2640}
          className={CAMPO}
        />
        <span className="mt-0.5 block font-normal text-texto-muted/55">
          2640 = 44 h vigente hasta 14 jul 2026 · 2520 = 42 h desde 15 jul 2026
        </span>
      </label>
      <label className={ETIQUETA}>
        PERIODICIDAD DE PAGO *
        <select name="periodicidadPago" defaultValue={inicial?.periodicidadPago ?? "QUINCENAL"} className={CAMPO}>
          <option value="QUINCENAL">Quincenal</option>
          <option value="MENSUAL">Mensual</option>
        </select>
      </label>
      <label className={ETIQUETA}>
        DÍA DE DESCANSO SEMANAL *
        <select name="diaDescanso" defaultValue={String(inicial?.diaDescanso ?? 0)} className={CAMPO}>
          <option value="0">Domingo</option>
          <option value="1">Lunes</option>
          <option value="2">Martes</option>
          <option value="3">Miércoles</option>
          <option value="4">Jueves</option>
          <option value="5">Viernes</option>
          <option value="6">Sábado</option>
        </select>
      </label>
      <label className={ETIQUETA}>
        MÉTODO HABITUAL DE PAGO *
        <select name="metodoPago" defaultValue={inicial?.metodoPago ?? "EFECTIVO"} className={CAMPO}>
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="OTRO">Otro</option>
        </select>
      </label>
      <label className={ETIQUETA}>
        CLASE DE RIESGO ARP *
        <select name="arpClase" defaultValue={String(inicial?.arpClase ?? 2)} className={CAMPO}>
          {[1, 2, 3, 4, 5, 6].map((c) => (
            <option key={c} value={c}>
              Clase {c}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function FormularioNuevoEmpleado() {
  const [estadoForm, accion, pendiente] = useActionState(crearEmpleado, INICIAL);

  return (
    <SeccionPlegable titulo="+ Registrar empleado">
      {() => (
        <form action={accion} className="mt-3 grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2">
          <h3 className="font-display text-lg text-texto-app sm:col-span-2">
            Nueva persona del restaurante
          </h3>
          <Mensaje estado={estadoForm} />

          <label className={ETIQUETA}>
            NOMBRES *
            <input name="nombre" required maxLength={60} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            APELLIDOS *
            <input name="apellidos" required maxLength={60} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            TIPO DE DOCUMENTO *
            <select name="documentoTipo" defaultValue="CC" className={CAMPO}>
              <option value="CC">Cédula</option>
              <option value="CE">Cédula de extranjería</option>
              <option value="TI">Tarjeta de identidad</option>
              <option value="PE">Permiso especial</option>
              <option value="OTRO">Otro</option>
            </select>
          </label>
          <label className={ETIQUETA}>
            NÚMERO DE DOCUMENTO *
            <input name="documentoNumero" required maxLength={30} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            TELÉFONO
            <input name="telefono" maxLength={20} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            DIRECCIÓN
            <input name="direccion" maxLength={120} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            CARGO *
            <input name="cargo" required maxLength={60} placeholder="Mesero, cocinero…" className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            FECHA DE INGRESO *
            <input type="date" name="fechaIngreso" required className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            EPS (informativo)
            <input name="epsNombre" maxLength={80} placeholder="Nueva EPS, Sura…" className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            FONDO DE PENSIÓN (informativo)
            <input name="fondoPensionName" maxLength={80} placeholder="Colfondos, Protección…" className={CAMPO} />
          </label>

          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-texto-muted/60">
              Contrato inicial (nace la primera versión con historial)
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <CamposContrato />
            </div>
          </div>

          <button
            type="submit"
            disabled={pendiente}
            className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50 sm:col-span-2"
          >
            {pendiente ? "Guardando…" : "Registrar empleado"}
          </button>
        </form>
      )}
    </SeccionPlegable>
  );
}

export function AccionEditarEmpleado({
  empleado,
}: {
  empleado: {
    id: number;
    nombre: string;
    apellidos: string;
    telefono: string | null;
    direccion: string | null;
    cargo: string;
    epsNombre: string | null;
    fondoPensionName: string | null;
    arpClase: number;
  };
}) {
  const [estadoForm, accion, pendiente] = useActionState(editarEmpleado, INICIAL);

  return (
    <SeccionPlegable titulo="Editar datos de contacto">
      {() => (
        <form action={accion} className="mt-3 grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2">
          <h3 className="font-display text-lg text-texto-app sm:col-span-2">
            Datos no contractuales
          </h3>
          <Mensaje estado={estadoForm} />
          <input type="hidden" name="empleadoId" value={empleado.id} />
          <label className={ETIQUETA}>
            NOMBRES
            <input name="nombre" defaultValue={empleado.nombre} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            APELLIDOS
            <input name="apellidos" defaultValue={empleado.apellidos} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            TELÉFONO
            <input name="telefono" defaultValue={empleado.telefono ?? ""} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            DIRECCIÓN
            <input name="direccion" defaultValue={empleado.direccion ?? ""} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            CARGO
            <input name="cargo" defaultValue={empleado.cargo} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            CLASE ARP
            <input name="arpClase" inputMode="numeric" defaultValue={empleado.arpClase} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            EPS
            <input name="epsNombre" defaultValue={empleado.epsNombre ?? ""} className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            FONDO DE PENSIÓN
            <input name="fondoPensionName" defaultValue={empleado.fondoPensionName ?? ""} className={CAMPO} />
          </label>
          <button type="submit" disabled={pendiente} className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50 sm:col-span-2">
            {pendiente ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>
      )}
    </SeccionPlegable>
  );
}

export function AccionActualizarContrato({
  empleado,
}: {
  empleado: {
    id: number;
    modalidad: string;
    remuneracion: string;
    salarioMensual: number;
    salarioDiario: number;
    valorHora: number;
    jornadaSemanalMinutos: number;
    periodicidadPago: string;
    diaDescanso: number;
    metodoPago: string;
  };
}) {
  const [estadoForm, accion, pendiente] = useActionState(actualizarContrato, INICIAL);

  return (
    <SeccionPlegable titulo="Actualizar contrato (aumento o cambio)">
      {() => (
        <form action={accion} className="mt-3 grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2">
          <h3 className="font-display text-lg text-texto-app sm:col-span-2">
            La versión actual se cierra y nace una nueva: la nómina pagada va intacta
          </h3>
          <Mensaje estado={estadoForm} />
          <input type="hidden" name="empleadoId" value={empleado.id} />
          <label className={ETIQUETA}>
            ¿DESDE CUÁNDO APLICA? *
            <input type="date" name="desde" required className={CAMPO} />
          </label>
          <label className={ETIQUETA}>
            MOTIVO *
            <input name="motivo" required maxLength={140} placeholder="aumento, cambio de jornada…" className={CAMPO} />
          </label>
          <div className="sm:col-span-2">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <CamposContrato inicial={empleado} />
            </div>
          </div>
          <button type="submit" disabled={pendiente} className="rounded-xl bg-amber-brand px-4 py-3 font-display text-sm text-brown-950 transition hover:bg-orange-brand disabled:opacity-50 sm:col-span-2">
            {pendiente ? "Guardando…" : "Crear versión nueva de contrato"}
          </button>
        </form>
      )}
    </SeccionPlegable>
  );
}

export function AccionDesactivarEmpleado({ empleadoId, nombre }: { empleadoId: number; nombre: string }) {
  const [estadoForm, accion, pendiente] = useActionState(desactivarEmpleado, INICIAL);
  const [abierto, setAbierto] = useState(false);

  if (abierto) {
    return (
      <form action={accion} className="mt-3 grid gap-2.5 rounded-2xl bg-glass-app p-4 ring-1 ring-borde-app sm:grid-cols-2">
        <h3 className="font-display text-lg text-texto-app sm:col-span-2">
          Desactivar a {nombre} (se conserva todo el historial)
        </h3>
        <Mensaje estado={estadoForm} />
        <input type="hidden" name="empleadoId" value={empleadoId} />
        <label className={ETIQUETA}>
          MOTIVO *
          <input name="motivo" required maxLength={200} placeholder="renuncia, retiro…" className={CAMPO} />
        </label>
        <label className={ETIQUETA}>
          FECHA DE RETIRO
          <input type="date" name="fechaRetiro" className={CAMPO} />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pendiente} className="rounded-xl bg-danger/20 px-4 py-3 text-sm font-bold text-danger-text ring-1 ring-danger/30 disabled:opacity-50">
            {pendiente ? "Guardando…" : "Confirmar desactivación"}
          </button>
          <button type="button" onClick={() => setAbierto(false)} className="rounded-xl bg-panel-app px-4 py-3 text-sm font-bold text-texto-app ring-1 ring-borde-app">
            Cancelar
          </button>
        </div>
      </form>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setAbierto(true)}
      className="rounded-xl bg-danger/10 px-3 py-2 text-xs font-bold text-danger-text ring-1 ring-danger/20 transition hover:bg-danger/20"
    >
      Desactivar
    </button>
  );
}
