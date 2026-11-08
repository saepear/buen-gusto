"use client";

import { CheckCircle2, Plus, Power, Trash2, TriangleAlert, UtensilsCrossed } from "lucide-react";
import gsap from "gsap";
import { useActionState, useEffect, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";
import type { CategoriaPropia } from "@/lib/config";
import {
  ICONO_CATEGORIA_DEFECTO,
  ICONOS_CATEGORIA,
  LISTA_ICONOS_CATEGORIA,
} from "@/lib/iconos";
import {
  TIPO_PRODUCTO,
  TIPO_PRODUCTO_LABEL,
  type TipoProducto,
} from "@/lib/roles";
import {
  crearProducto,
  crearCategoria,
  cambiarIconoCategoria,
  editarProducto,
  desactivarProducto,
  reactivarProducto,
  eliminarProductoDefinitivamente,
  eliminarCategoriaDefinitivamente,
  detallesEliminacionProducto,
  detallesEliminacionCategoria,
  type EstadoAccion,
  type DetalleEliminacionProducto,
  type DetalleEliminacionCategoria,
} from "./actions";

const ESTADO_INICIAL: EstadoAccion = { error: null };
const TIPOS: TipoProducto[] = [
  TIPO_PRODUCTO.PROTEINA,
  TIPO_PRODUCTO.PRINCIPIO,
  TIPO_PRODUCTO.ENSALADA,
  TIPO_PRODUCTO.SOPA,
  TIPO_PRODUCTO.BEBIDA,
  TIPO_PRODUCTO.ADICIONAL,
];

export function FormularioNuevoProducto({
  categorias,
}: {
  categorias: CategoriaPropia[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    crearProducto,
    ESTADO_INICIAL,
  );

  return (
    <form
      action={accion}
      className="productos-create rounded-[2rem] bg-glass-app p-6 text-texto-app ring-1 ring-borde-app"
    >
      <h2 className="font-display text-xl text-amber-brand">Nuevo producto</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="block text-sm">
          <span className="mb-1 block text-texto-muted/85">Nombre</span>
          <input
            name="nombre"
            required
            maxLength={40}
            placeholder="Ej: Costilla ahumada"
            className="w-full rounded-2xl border-0 bg-panel-app px-3 py-2.5 text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-texto-muted/85">Tipo</span>
          <select
            name="tipo"
            required
            className="rounded-2xl border-0 bg-panel-app px-3 py-2.5 text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_PRODUCTO_LABEL[t]}
              </option>
            ))}
            {categorias.length > 0 ? (
              <optgroup label="Categorías propias">
                {categorias.map((c) => (
                  <option key={c.nombre} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-texto-muted/85">Precio (COP)</span>
          <input
            name="precio"
            type="number"
            min={0}
            max={9999999}
            step={1}
            defaultValue={0}
            className="w-32 rounded-2xl border-0 bg-panel-app px-3 py-2.5 text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60"
          />
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="flex items-center justify-center gap-2 rounded-2xl bg-amber-brand px-4 py-2.5 font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Crear
        </button>
      </div>
      {estado.error && (
        <p className="mt-3 text-sm font-semibold text-danger-text">{estado.error}</p>
      )}
      {estado.ok && !estado.error && (
        <p className="mt-3 text-sm font-semibold text-success-text">{estado.ok}</p>
      )}
    </form>
  );
}

/** Fila de botones de cada tarjeta: Desactivar/Reactivar es lausal (temporal);
 *  «Eliminar definitivamente» abre el diálogo informado y borra la fila */
function AccionesTarjetaProducto({
  id,
  nombre,
  tipo,
  precio,
  activo,
}: {
  id: number;
  nombre: string;
  tipo: string;
  precio: number;
  activo: boolean;
}) {
  const [estadoDel, accionDel, pendienteDel] = useActionState<
    EstadoAccion,
    FormData
  >(eliminarProductoDefinitivamente, ESTADO_INICIAL);
  const [detalle, setDetalle] = useState<DetalleEliminacionProducto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [dialogo, setDialogo] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);

  // Al abrir: pide los contajes reales (referencias, menús, apartados)
  async function abrirDialogo() {
    setDialogo(true);
    setDetalle(null);
    setCargando(true);
    try {
      const d = await detallesEliminacionProducto(id);
      setDetalle(
        d ?? {
          id,
          nombre,
          tipo,
          precio,
          activo,
          referenciasHistoricas: 0,
          entradasMenu: 0,
          apartadosPendientes: [],
        },
      );
    } finally {
      setCargando(false);
    }
  }

  // Candy pop de la casa + focus en cancelar
  useEffect(() => {
    if (!dialogo || !cajaRef.current) return;
    const anim = gsap.fromTo(
      cajaRef.current,
      { opacity: 0, scale: 0.94, y: 12 },
      { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" },
    );
    cajaRef.current.querySelector<HTMLButtonElement>("button[data-cancelar]")?.focus();
    return () => {
      anim.kill();
    };
  }, [dialogo]);

  // Éxito: se cierra solito
  useEffect(() => {
    if (!dialogo) return;
    if (estadoDel.ok && !estadoDel.error) {
      const t = window.setTimeout(() => setDialogo(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [dialogo, estadoDel]);

  // Escape cierra el diálogo sin tocar el formulario
  useEffect(() => {
    if (!dialogo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogo(false);
    };
    window.addEventListener("keydown", onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
    };
  }, [dialogo]);

  const bloqueado = (detalle?.apartadosPendientes.length ?? 0) > 0;

  return (
    <>
      <div className="productos-card-actions mt-2 grid gap-1.5">
        <form action={activo ? desactivarProducto : reactivarProducto}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            aria-label={activo ? `Desactivar ${nombre}` : `Reactivar ${nombre}`}
            title={
              activo
                ? "Desactivar: sale del catálogo, del salón y del menú del día; puedes reactivarlo cuando quieras"
                : "Reactivar"
            }
            className={
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition " +
              (activo
                ? "bg-warning/20 text-warning ring-1 ring-warning/40 hover:bg-warning/30"
                : "bg-success/20 text-success-text ring-1 ring-success/45 hover:bg-success/35")
            }
          >
            {activo ? (
              <>
                <Power className="h-3.5 w-3.5" /> Desactivar
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5" /> Reactivar
              </>
            )}
          </button>
        </form>
        <button
          type="button"
          onClick={abrirDialogo}
          disabled={cargando}
          aria-label={`Eliminar definitivamente ${nombre}`}
          title="Eliminar definitivamente: borra la fila del catálogo; las ventas históricas conservan nombre y precios"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold bg-danger/25 text-danger-text ring-1 ring-danger/45 transition hover:bg-danger/40 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" /> Eliminar
        </button>
      </div>

      {estadoDel.error && !dialogo ? (
        <p className="mt-1 text-xs font-semibold text-danger-text">{estadoDel.error}</p>
      ) : null}

      {dialogo ? (
        <div
          role="dialog"
          aria-modal="true"
          className="productos-dialog fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogo(false);
          }}
        >
          <button
            type="button"
            aria-label="Cerrar"
            tabIndex={-1}
            onClick={() => setDialogo(false)}
            className="absolute inset-0 cursor-default bg-glass-app backdrop-blur-sm"
          />
          <div
            ref={cajaRef}
            className="relative w-full max-w-md rounded-[2rem] bg-panel-app p-6 text-texto-app ring-1 ring-borde-app shadow-pop"
          >
            <h3 className="font-display text-xl">
              ¿Eliminar definitivamente
              <br />«{nombre}»?
            </h3>
            <p className="mt-2 text-sm text-danger-text font-semibold">
              Esto borra la fila del catálogo para siempre: no se puede
              reactivar ni reaparece como producto inactivo.
            </p>

            {detalle ? (
              <dl className="mt-3 space-y-1 rounded-2xl bg-campo-app px-3.5 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-texto-muted/60">Categoría</dt>
                  <dd className="font-bold">{detalle.tipo}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texto-muted/60">Precio</dt>
                  <dd className="font-bold">
                    {detalle.precio > 0 ? `${formatCOP(detalle.precio)}` : "Incluido en el almuerzo"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texto-muted/60">Ventas históricas</dt>
                  <dd className="font-bold">
                    {detalle.referenciasHistoricas} línea
                    {detalle.referenciasHistoricas === 1 ? "" : "s"} (nombre y precios
                    quedan guardados)
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-texto-muted/60">Entradas en menús</dt>
                  <dd className="font-bold">
                    {detalle.entradasMenu} (se quitan de todas las fechas)
                  </dd>
                </div>
              </dl>
            ) : cargando ? (
              <p className="mt-3 text-sm text-texto-muted/60">Consultando dependencias…</p>
            ) : null}

                {detalle && detalle.apartadosPendientes.length > 0 ? (
                  <div className="mt-3 rounded-2xl bg-danger/25 px-3.5 py-3 ring-1 ring-danger/45">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-danger-text">
                      <TriangleAlert className="h-4 w-4" /> Apartados pendientes que lo
                      necesitan
                    </p>
                <ul className="mt-1.5 space-y-1 text-sm text-danger-text/90">
                  {detalle.apartadosPendientes.map((a) => (
                    <li key={a.id}>
                      <b>#{a.id}</b> · {a.cliente} · entrega {a.fechaEntrega} — {a.motivos}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-danger-text/80">
                  Entrega, edita o cancela esos apartados antes de borrar el
                  producto.
                </p>
              </div>
            ) : null}

            {estadoDel.error ? (
              <p className="mt-3 rounded-xl bg-danger/25 px-3 py-2 text-sm font-semibold text-danger-text ring-1 ring-danger/45">
                {estadoDel.error}
              </p>
            ) : null}
            {estadoDel.ok && !estadoDel.error ? (
              <p className="mt-3 rounded-xl bg-success/20 px-3 py-2 text-sm font-semibold text-success-text ring-1 ring-success/45">
                {estadoDel.ok}
              </p>
            ) : null}

            {detalle && !bloqueado ? (
              <form action={accionDel} className="mt-4 flex items-center gap-2">
                <input type="hidden" name="id" value={id} />
                <button
                  type="button"
                  data-cancelar
                  onClick={() => setDialogo(false)}
                  disabled={pendienteDel}
                  className="flex-1 rounded-xl bg-campo-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pendienteDel}
                  className="flex-1 rounded-xl bg-danger/30 px-4 py-2.5 text-sm font-bold text-danger-text ring-1 ring-danger/50 transition hover:bg-danger/45 disabled:opacity-50"
                >
                  {pendienteDel ? "Eliminando…" : "Borrar para siempre"}
                </button>
              </form>
            ) : detalle && bloqueado ? (
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  data-cancelar
                  onClick={() => setDialogo(false)}
                  className="flex-1 rounded-xl bg-campo-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setDialogo(false)}
                  className="rounded-xl bg-campo-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function TarjetaProducto({
  id,
  nombre,
  precio,
  tipo,
  activo,
}: {
  id: number;
  nombre: string;
  precio: number;
  tipo: string;
  activo: boolean;
}) {
  /** La proteína con precio propio es el ESPECIAL (asados del domingo):
   *  ese precio reemplaza al del almuerzo corriente siempre que el producto
   *  esté en el menú del día. */
  const esProteina = tipo === "PROTEINA";
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    editarProducto,
    ESTADO_INICIAL,
  );

  return (
    <div
      className={
        "productos-card rounded-2xl bg-panel-app p-4 ring-1 transition " +
        (activo ? "ring-borde-app" : "ring-warning/45")
      }
    >
      <form
        action={accion}
        className="grid grid-cols-[1fr_auto] items-end gap-2"
      >
        <input type="hidden" name="id" value={id} />
        <label className="block">
          <span className="productos-field-label">Nombre</span>
          <input
            name="nombre"
            defaultValue={nombre}
            maxLength={40}
            className="w-full rounded-lg border-0 bg-panel-app px-2.5 py-1.5 font-bold text-texto-app ring-1 ring-inset ring-borde-app focus:ring-amber-brand/60"
          />
        </label>
        <label className="block w-28">
          <span className="productos-field-label">Precio (COP)</span>
          <input
            name="precio"
            type="number"
            min={0}
            step={1}
            defaultValue={precio}
            className="w-full rounded-lg border-0 bg-panel-app px-2.5 py-1.5 text-right text-sm text-texto-app ring-1 ring-inset ring-borde-app focus:ring-amber-brand/60"
          />
        </label>
        <div className="col-span-2 flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-texto-muted/45">
            {activo ? (
              precio > 0 ? (
                esProteina ? (
                  `${formatCOP(precio)} · precio propio: sirve de especial si va al menú del día`
                ) : (
                  `${formatCOP(precio)} · precio propio`
                )
              ) : (
                "Incluido en el almuerzo"
              )
            ) : (
              "Desactivado: no se ofrece; reactiva o borra definitivamente"
            )}
          </span>
          <button
            type="submit"
            aria-label={`Guardar cambios de ${nombre}`}
            disabled={pendiente}
            title="Guardar cambios"
            className="rounded-lg bg-panel-app px-2.5 py-1.5 text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover hover:text-texto-app"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
        </div>
      </form>
      {estado.error && (
        <p className="mt-1 text-xs font-semibold text-danger-text">{estado.error}</p>
      )}
      <AccionesTarjetaProducto
        id={id}
        nombre={nombre}
        tipo={tipo}
        precio={precio}
        activo={activo}
      />
    </div>
  );
}

/** Panel «Categorías propias»: aquí el cliente inventa sus propias secciones
 *  (p. ej. «Especiales»), les elige el icono y sus productos entran al menú
 *  del día con porciones, igual que proteínas, principios, ensaladas y sopas. */
export function PanelCategorias({ categorias }: { categorias: CategoriaPropia[] }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    crearCategoria,
    ESTADO_INICIAL,
  );
  const [icono, setIcono] = useState(ICONO_CATEGORIA_DEFECTO);

  return (
    <details className="productos-custom mt-4 rounded-[2rem] bg-panel-app p-6 text-texto-app ring-1 ring-borde-app">
      <summary><span><UtensilsCrossed aria-hidden className="h-5 w-5" /> Categorías propias</span><Plus aria-hidden className="h-5 w-5" /></summary>
      <div className="productos-custom-content">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 max-w-md">
          <h2 className="flex items-center gap-2 font-display text-xl text-amber-brand">
            <UtensilsCrossed aria-hidden className="h-5 w-5" />
            Categorías propias
          </h2>
          <p className="mt-1 text-sm text-texto-muted/70">
            Crea secciones a tu manera — «Especiales», «Postres», lo que
            quieras — con el icono que prefieras. Sus productos entran al menú
            del día y al armado del plato, igual que las ensaladas.
          </p>
        </div>
        <form action={accion} className="w-full max-w-sm">
          <span className="mb-1 block text-sm text-texto-muted/85">
            Nueva categoría
          </span>
          <div className="flex items-end gap-2">
            <input
              name="nombre"
              required
              maxLength={24}
              placeholder="Ej: Especiales"
              className="min-w-0 flex-1 rounded-2xl border-0 bg-campo-app px-3 py-2.5 text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/25 focus:ring-2 focus:ring-amber-brand/60"
            />
            <button
              type="submit"
              disabled={pendiente}
              className="flex items-center justify-center gap-2 rounded-2xl bg-amber-brand px-4 py-2.5 font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
            >
              <Plus aria-hidden className="h-4 w-4" /> Crear
            </button>
          </div>
          <input type="hidden" name="icono" value={icono} />
          <span className="mt-3 mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-texto-muted/45">
            Icono
          </span>
          <div className="grid grid-cols-7 gap-1.5">
            {LISTA_ICONOS_CATEGORIA.map((clave) => {
              const Ico = ICONOS_CATEGORIA[clave];
              return (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setIcono(clave)}
                  aria-pressed={icono === clave}
                  aria-label={`Icono ${clave}`}
                  className={
                    "flex h-9 w-9 items-center justify-center rounded-xl transition " +
                    (icono === clave
                      ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
                      : "bg-campo-app text-texto-muted/60 ring-1 ring-borde-app hover:text-texto-app")
                  }
                >
                  <Ico aria-hidden className="h-4.5 w-4.5" />
                </button>
              );
            })}
          </div>
        </form>
      </div>

      {categorias.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {categorias.map((c) => (
            <ChipCategoria key={c.nombre} nombre={c.nombre} icono={c.icono} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-campo-app px-3.5 py-3 text-sm text-texto-muted/45">
          Aún no hay categorías propias: el formulario de arriba crea la
          primera (hasta 6, de 2 a 24 letras).
        </p>
      )}

      {estado.error && (
        <p className="mt-3 text-sm font-semibold text-danger-text">
          {estado.error}
        </p>
      )}
      {estado.ok && !estado.error && (
        <p className="mt-3 text-sm font-semibold text-success-text">
          {estado.ok}
        </p>
      )}
      </div>
    </details>
  );
}

/** Chip de una categoría propia: el icono abre el picker y la X abre el
 *  diálogo de eliminación definitiva (con contajes de productos) */
function ChipCategoria({ nombre, icono }: { nombre: string; icono: string }) {
  const [estado, accion, pendiente] = useActionState<EstadoAccion, FormData>(
    eliminarCategoriaDefinitivamente,
    ESTADO_INICIAL,
  );
  const [estadoIcono, accionIcono, pendienteIcono] = useActionState<
    EstadoAccion,
    FormData
  >(cambiarIconoCategoria, ESTADO_INICIAL);
  /** ¿Qué diálogo está abierto? null = ninguno */
  const [dialogo, setDialogo] = useState<null | "borrar" | "icono">(null);
  const [iconoElegido, setIconoElegido] = useState(icono);
  const [detalle, setDetalle] = useState<DetalleEliminacionCategoria | null>(null);
  const IconoActual = ICONOS_CATEGORIA[icono] ?? UtensilsCrossed;
  const IconoElegido = ICONOS_CATEGORIA[iconoElegido] ?? UtensilsCrossed;
  const cajaRef = useRef<HTMLDivElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // Al abrir el diálogo de borrado se piden los contajes en vivo
  async function abrirBorrado() {
    setDialogo("borrar");
    setDetalle(null);
    const d = await detallesEliminacionCategoria(nombre);
    setDetalle(d);
  }

  // Entrada de la caja al abrir (candy pop de la casa)
  useEffect(() => {
    if (!dialogo || !cajaRef.current) return;
    const anim = gsap.fromTo(
      cajaRef.current,
      { opacity: 0, scale: 0.94, y: 12 },
      { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: "back.out(1.7)" },
    );
    cancelarRef.current?.focus();
    return () => {
      anim.kill();
    };
  }, [dialogo]);

  // Éxito: se cierra solito (600 ms por si el rAF está dormido en pestaña oculta)
  useEffect(() => {
    if (!dialogo) return;
    const listo =
      dialogo === "borrar" ? estado.ok && !estado.error : estadoIcono.ok && !estadoIcono.error;
    if (listo) {
      const t = window.setTimeout(() => setDialogo(null), 600);
      return () => window.clearTimeout(t);
    }
  }, [dialogo, estado, estadoIcono]);

  // Escape cierra el diálogo sin tocar el formulario
  useEffect(() => {
    if (!dialogo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogo(null);
    };
    window.addEventListener("keydown", onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
    };
  }, [dialogo]);

  const bloqueado = (detalle?.apartadosPendientes.length ?? 0) > 0;

  return (
    <li className="relative flex items-center gap-1.5 rounded-full bg-campo-app py-1.5 pl-2 pr-1.5 text-sm font-bold text-texto-app ring-1 ring-borde-app">
      <button
        type="button"
        aria-label={`Cambiar el icono de ${nombre}`}
        title="Cambiar el icono"
        onClick={() => {
          setIconoElegido(icono);
          setDialogo("icono");
        }}
        className="rounded-full p-1 text-amber-brand transition hover:bg-amber-brand/10"
      >
        <IconoActual aria-hidden className="h-4.5 w-4.5" />
      </button>
      <span className="pr-0.5">{nombre}</span>
      <button
        type="button"
        aria-label={`Eliminar la categoría ${nombre}`}
        title="Eliminar la categoría definitivamente (borra también sus productos)"
        onClick={abrirBorrado}
        className="rounded-full p-1 text-texto-muted/45 transition hover:text-danger-text"
      >
        <Trash2 aria-hidden className="h-3.5 w-3.5" />
      </button>

      {dialogo ? (
        <div
          role="dialog"
          aria-modal="true"
          className="productos-dialog fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogo(null);
          }}
        >
          <button
            type="button"
            aria-label="Cerrar"
            tabIndex={-1}
            onClick={() => setDialogo(null)}
            className="absolute inset-0 cursor-default bg-glass-app backdrop-blur-sm"
          />
          <div
            ref={cajaRef}
            className="relative w-full max-w-md rounded-[2rem] bg-panel-app p-6 text-texto-app ring-1 ring-borde-app shadow-pop"
          >
            {dialogo === "borrar" ? (
              <>
                <h3 className="font-display text-xl">
                  ¿Eliminar la categoría «{nombre}»?
                </h3>
                <p className="mt-2 text-sm text-danger-text font-semibold">
                  Se elimina completa: sus productos activos e inactivos se
                  borran del catálogo y la categoría sale de la configuración.
                </p>

                {detalle ? (
                  <dl className="mt-3 space-y-1 rounded-2xl bg-campo-app px-3.5 py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-muted/60">Productos activos</dt>
                      <dd className="font-bold">{detalle.productosActivos}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-muted/60">Productos desactivados</dt>
                      <dd className="font-bold">{detalle.productosInactivos}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-texto-muted/60">Ventas históricas</dt>
                      <dd className="font-bold">
                        {detalle.referenciasHistoricas} línea
                        {detalle.referenciasHistoricas === 1 ? "" : "s"} (nombre y
                        precios quedan guardados)
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3 text-sm text-texto-muted/60">Consultando dependencias…</p>
                )}

                {detalle && detalle.apartadosPendientes.length > 0 ? (
                  <div className="mt-3 rounded-2xl bg-danger/25 px-3.5 py-3 ring-1 ring-danger/45">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-danger-text">
                      <TriangleAlert className="h-4 w-4" /> Apartados pendientes
                      que necesitan productos de esta categoría
                    </p>
                    <ul className="mt-1.5 space-y-1 text-sm text-danger-text/90">
                      {detalle.apartadosPendientes.map((a) => (
                        <li key={a.id}>
                          <b>#{a.id}</b> · {a.cliente} · entrega {a.fechaEntrega} — {a.motivos}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {estado.error ? (
                  <p className="mt-3 rounded-xl bg-danger/25 px-3 py-2 text-sm font-semibold text-danger-text ring-1 ring-danger/45">
                    {estado.error}
                  </p>
                ) : null}
                {estado.ok && !estado.error ? (
                  <p className="mt-3 rounded-xl bg-success/20 px-3 py-2 text-sm font-semibold text-success-text ring-1 ring-success/45">
                    {estado.ok}
                  </p>
                ) : null}

                {detalle && !bloqueado ? (
                  <form action={accion} className="mt-4 flex items-center gap-2">
                    <input type="hidden" name="nombre" value={nombre} />
                    <button
                      ref={cancelarRef}
                      type="button"
                      onClick={() => setDialogo(null)}
                      disabled={pendiente}
                      className="flex-1 rounded-xl bg-campo-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={pendiente}
                      className="flex-1 rounded-xl bg-danger/30 px-4 py-2.5 text-sm font-bold text-danger-text ring-1 ring-danger/50 transition hover:bg-danger/45 disabled:opacity-50"
                    >
                      {pendiente ? "Eliminando…" : "Eliminar categoría definitivamente"}
                    </button>
                  </form>
                ) : (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      ref={cancelarRef}
                      type="button"
                      onClick={() => setDialogo(null)}
                      className="flex-1 rounded-xl bg-campo-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
                    >
                      Cerrar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="font-display text-xl text-texto-app">
                  Icono de «{nombre}»
                </h3>
                <form
                  action={accionIcono}
                  className="mt-3"
                >
                  <input type="hidden" name="nombre" value={nombre} />
                  <input type="hidden" name="icono" value={iconoElegido} />
                  <div className="grid grid-cols-7 gap-1.5">
                    {LISTA_ICONOS_CATEGORIA.map((clave) => {
                      const Ico = ICONOS_CATEGORIA[clave];
                      return (
                        <button
                          key={clave}
                          type="button"
                          onClick={() => setIconoElegido(clave)}
                          aria-pressed={iconoElegido === clave}
                          aria-label={`Icono ${clave}`}
                          className={
                            "flex h-9 w-9 items-center justify-center rounded-xl transition " +
                            (iconoElegido === clave
                              ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
                              : "bg-campo-app text-texto-muted/60 ring-1 ring-borde-app hover:text-texto-app")
                          }
                        >
                          <Ico aria-hidden className="h-4.5 w-4.5" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-texto-muted/70">
                      <IconoElegido aria-hidden className="h-4 w-4 shrink-0 text-amber-brand" />
                      {estadoIcono.error ? (
                        <span className="font-semibold text-danger-text">
                          {estadoIcono.error}
                        </span>
                      ) : (
                        "Toca un icono y aplícalo"
                      )}
                    </p>
                    <button
                      ref={cancelarRef}
                      type="button"
                      onClick={() => setDialogo(null)}
                      disabled={pendienteIcono}
                      className="rounded-xl bg-campo-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
                    >
                      Cerrar
                    </button>
                    <button
                      type="submit"
                      disabled={pendienteIcono || iconoElegido === icono}
                      className="rounded-xl bg-amber-brand px-4 py-2.5 font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
                    >
                      {pendienteIcono ? "Aplicando…" : "Aplicar"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}
