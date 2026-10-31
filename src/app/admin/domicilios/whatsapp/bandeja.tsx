"use client";

import { Clock, Inbox, MessageCircle, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { formatCOP } from "@/lib/format";
import { precioAlmuerzo } from "@/lib/precios";
import type { BorradorParseado } from "./parser";
import {
  analizarMensaje,
  alternarAutoRegistrar,
  convertirEntrada,
  crearDomiciliosDesdeBorrador,
  descartarEntrada,
  type EstadoAnalisis,
} from "./acciones";
import { BANDEJA_VACIA, type EstadoBandeja } from "./estado";

const VACIO: EstadoAnalisis = { error: null, ok: null, borrador: null, entradaId: null };

const ESTILO_CHIP =
  "rounded-full bg-amber-brand/15 px-3 py-1 text-xs font-bold text-amber-brand ring-1 ring-amber-brand/40";

const ESTILO_CAMPO =
  "w-full rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60";

/** Una entrada de la bandeja tal como la manda la página (server) */
export type EntradaVista = {
  id: number;
  /** Nombre del contacto guardado en el teléfono, o el número si no está */
  remitente: string;
  /** Número desde el que escribió (lo captura el puente; vale para contactarlo) */
  telefono: string;
  texto: string;
  estado: string; // NUEVO | CONVERTIDO | DESCARTADO
  armable: boolean;
  /** La comanda que se creó de esta entrada (para abrir su comanda) */
  pedidoId: number | null;
  borrador: BorradorParseado | null;
  recibidoEn: string;
};

function borraresumen(borrador: BorradorParseado) {
  const totalPorUno =
    precioAlmuerzo(borrador.conSopa, true) +
    borrador.extras.reduce((s, e) => s + e.precio * e.cantidad, 0);
  return totalPorUno * borrador.cantidad;
}

/** Píldoras del borrador compartidas entre la bandeja y el local de pegar */
function ChipsBorrador({ borrador }: { borrador: BorradorParseado }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2">
      <span className={ESTILO_CHIP}>
        {borrador.cantidad} {borrador.cantidad === 1 ? "almuerzo" : "almuerzos"}
      </span>
      <span className={ESTILO_CHIP}>
        {borrador.conSopa ? "con sopa" : "bandeja (sin sopa)"}
      </span>
      {borrador.proteina ? (
        <span className={ESTILO_CHIP}>{borrador.proteina.nombre}</span>
      ) : (
        <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-bold text-danger-text ring-1 ring-danger/20">
          sin proteína
        </span>
      )}
      {borrador.principios.map((p) => (
        <span key={p.itemId} className={ESTILO_CHIP}>
          {p.nombre}
        </span>
      ))}
      {borrador.ensaladas.map((e) => (
        <span key={e.itemId} className={ESTILO_CHIP}>
          {e.nombre}
        </span>
      ))}
      {borrador.sopa ? <span className={ESTILO_CHIP}>{borrador.sopa.nombre}</span> : null}
      {borrador.extras.map((e) => (
        <span key={e.productoId} className={ESTILO_CHIP}>
          {e.nombre}
          {e.cantidad > 1 ? ` ×${e.cantidad}` : ""}
        </span>
      ))}
      {borrador.hora ? (
        <span className={ESTILO_CHIP}>
          <Clock className="mr-1 inline h-3 w-3" /> entrega {borrador.hora}
        </span>
      ) : null}
      <span className="text-sm font-bold text-texto-app">
        {formatCOP(borraresumen(borrador))} en total
      </span>
    </div>
  );
}

export function BandejaWhatsapp({
  entradas,
  auto,
  menuVacio,
}: {
  entradas: EntradaVista[];
  auto: boolean;
  menuVacio: boolean;
}) {
  const [estadoManual, analizar, analizando] = useActionState<EstadoAnalisis, FormData>(
    analizarMensaje,
    VACIO,
  );
  const [estadoConvertir, convertir, convirtiendo] = useActionState<EstadoAnalisis, FormData>(
    convertirEntrada,
    VACIO,
  );
  const [estadoCrear, crear, creando] = useActionState<EstadoAnalisis, FormData>(
    crearDomiciliosDesdeBorrador,
    VACIO,
  );
  const [estadoDescarte, descartar] = useActionState<EstadoBandeja, FormData>(
    descartarEntrada,
    BANDEJA_VACIA,
  );
  const [estadoAuto, alternarAuto] = useActionState<EstadoBandeja, FormData>(
    alternarAutoRegistrar,
    BANDEJA_VACIA,
  );

  // El borrador activo: de analizar a mano, de convertir una entrada, o del
  // intento de creación que falló (regresa fiel con su contacto)
  const borrador: BorradorParseado | null =
    estadoCrear.borrador ?? estadoConvertir.borrador ?? estadoManual.borrador;
  const entradaActiva =
    estadoCrear.entradaId ?? estadoConvertir.entradaId ?? estadoManual.entradaId;
  const errorCrear = estadoCrear.error ?? estadoConvertir.error ?? estadoManual.error;

  return (
    <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
      {/* Bandera del auto-registro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-texto-muted/70" />
          <h2 className="font-display text-xl text-texto-app">
            Bandeja de ingreso
            <span className="ml-2 rounded-full bg-panel-app px-2 py-0.5 text-xs font-bold text-texto-muted/60 ring-1 ring-borde-app">
              {entradas.filter((e) => e.estado === "NUEVO").length} nuevos
            </span>
          </h2>
        </div>
        <form action={alternarAuto}>
          <button
            type="submit"
            aria-pressed={auto}
            className={
              "flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-95 " +
              (auto
                ? "bg-success/15 text-success-text ring-1 ring-success/30 hover:bg-success/25"
                : "bg-panel-app text-texto-muted/60 ring-1 ring-borde-app hover:bg-panel-hover")
            }
          >
            <span
              aria-hidden
              className={
                "h-2.5 w-2.5 rounded-full " + (auto ? "bg-success" : "bg-texto-muted/40")
              }
            />
            Auto-registro: {auto ? "ENCENDIDO" : "APAGADO"}
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-texto-muted/70">
        {auto
          ? "Cada mensaje de WhatsApp entra solo: si se arma el plato contra el menú de hoy, el domicilio queda creado; si no, queda pendiente acá."
          : "Cada mensaje de WhatsApp entra aquí con su borrador; tú lo confirmas con un toque."}
      </p>
      {estadoAuto.error || estadoAuto.ok ? (
        <p className="mt-2 rounded-xl bg-panel-app px-3 py-2 text-xs text-texto-muted/70 ring-1 ring-borde-app">
          {estadoAuto.error ?? estadoAuto.ok}
        </p>
      ) : null}

      {/* Sin menú de hoy: nada se puede armar */}
      {menuVacio ? (
        <div className="mt-3 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning-text ring-1 ring-warning/20">
          Todavía no hay menú para hoy: ármalo en{" "}
          <Link href="/admin/menu-dia" className="underline">
            Menú del día
          </Link>{" "}
          antes de armar domicilios.
        </div>
      ) : null}

      {/* Avisos de los analisis y creaciones */}
      {errorCrear ? (
        <p className="mt-3 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger-text ring-1 ring-danger/20">
          {errorCrear}
        </p>
      ) : null}
      {estadoCrear.ok ? (
        <p className="mt-3 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm text-success-text ring-1 ring-success/20">
          {estadoCrear.ok}
        </p>
      ) : null}

      {/* La lista de entradas */}
      <div className="mt-4 space-y-3">
        {entradas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borde-app bg-panel-app px-4 py-8 text-center text-sm text-texto-muted/45">
            Sin mensajes por ahora. Cuando el teléfono del negocio reciba un
            WhatsApp, el puente lo trae acá con el nombre del contacto.
          </p>
        ) : (
          entradas.map((entrada) => {
            const esNuevo = entrada.estado === "NUEVO";
            const convertido = entrada.estado === "CONVERTIDO";
            return (
              <article
                key={entrada.id}
                className={
                  "rounded-2xl bg-panel-app p-4 ring-1 " +
                  (convertido
                    ? "ring-success/30"
                    : esNuevo
                      ? "ring-borde-app"
                      : "ring-borde-app opacity-60")
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg text-texto-app">
                    {entrada.remitente || "Sin nombre"}
                  </span>
                  {entrada.telefono ? (
                    <span className="font-mono text-xs text-texto-muted/50">
                      {entrada.telefono}
                    </span>
                  ) : null}
                  <span
                    className={
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                      (convertido
                        ? "bg-success/10 text-success-text ring-1 ring-success/20"
                        : esNuevo
                          ? "bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20"
                          : "bg-panel-app text-texto-muted/50 ring-1 ring-borde-app")
                    }
                  >
                    {convertido ? "Convertido" : esNuevo ? "Pendiente" : "Descartado"}
                  </span>
                  <span className="ml-auto font-mono text-xs text-texto-muted/45">
                    {entrada.recibidoEn}
                  </span>
                </div>

                <p className="mt-1.5 whitespace-pre-line text-sm text-texto-muted/70">
                  {entrada.texto}
                </p>

                {entrada.borrador && entrada.estado !== "DESCARTADO" ? (
                  <>
                    <ChipsBorrador borrador={entrada.borrador} />
                    {entrada.borrador.notas.length > 0 ? (
                      <ul className="mt-2 space-y-0.5">
                        {entrada.borrador.notas.slice(0, 3).map((nota) => (
                          <li key={nota} className="text-xs text-warning-text">
                            · {nota}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}

                {/* Acciones según el estado de la entrada */}
                {esNuevo && entrada.armable ? (
                  !auto ? (
                    <form action={convertir} className="mt-3">
                      <input type="hidden" name="entradaId" value={entrada.id} />
                      <button
                        type="submit"
                        disabled={convirtiendo}
                        className="flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
                      >
                        <Sparkles className="h-4 w-4" />
                        {convirtiendo ? "Leyendo…" : "Armar el domicilio"}
                      </button>
                    </form>
                  ) : (
                    <p className="mt-3 text-xs text-warning-text">
                      No se pudo registrar solo: revisa el borrador y confírmalo
                      abajo.
                    </p>
                  )
                ) : null}
                {esNuevo && !entrada.armable ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Link
                      href="/admin/domicilios/nuevo"
                      className="rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950"
                    >
                      Abrirlo a mano
                    </Link>
                    <form action={descartar}>
                      <input type="hidden" name="entradaId" value={entrada.id} />
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-texto-muted/60 transition hover:text-danger-text"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Descartar
                      </button>
                    </form>
                  </div>
                ) : null}
                {convertido && entrada.pedidoId ? (
                  <Link
                    href={`/ordenes/comanda/${entrada.pedidoId}`}
                    target="_blank"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-panel-app px-3 py-2 text-xs font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-amber-brand hover:text-brown-950"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Comanda #{entrada.pedidoId}
                  </Link>
                ) : null}
              </article>
            );
          })
        )}
      </div>

      {/* Pegar a mano (mensaje que solo está en WhatsApp Web del PC) */}
      <details className="mt-5 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
        <summary className="cursor-pointer text-sm font-bold text-texto-muted/70 transition hover:text-texto-app">
          Pegar un mensaje a mano
        </summary>
        <form action={analizar} className="mt-3">
          <textarea
            name="mensaje"
            rows={3}
            required
            placeholder={'Ej.:\n"Hola, me regalas un almuerzo con frijol y asada de res porfa"'}
            aria-label="Mensaje de WhatsApp del cliente"
            className="w-full resize-y rounded-2xl border-0 bg-panel-app px-4 py-3 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/40 focus:ring-2 focus:ring-amber-brand/60"
          />
          <button
            type="submit"
            disabled={analizando || menuVacio}
            className="mt-2 flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {analizando ? "Entendiendo…" : "Entender el mensaje"}
          </button>
        </form>
      </details>

      {/* Confirmación del borrador activo (pegado a mano o de una entrada) */}
      {borrador ? (
        <div className="mt-5 rounded-2xl bg-panel-app p-4 ring-1 ring-amber-brand/40">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-lg text-texto-app">
            Revisar y confirmar
            {entradaActiva ? (
              <span className={ESTILO_CHIP}>de la entrada #{entradaActiva}</span>
            ) : null}
          </h3>
          <ChipsBorrador borrador={borrador} />

          <form action={crear} className="mt-4">
            <input
              type="hidden"
              name="borrador"
              value={JSON.stringify({
                cantidad: borrador.cantidad,
                conSopa: borrador.conSopa,
                proteina: borrador.proteina,
                principios: borrador.principios,
                ensaladas: borrador.ensaladas,
                sopa: borrador.sopa,
                hora: borrador.hora,
                extras: borrador.extras,
                notas: borrador.notas,
              })}
            />
            {entradaActiva ? (
              <input type="hidden" name="entradaId" value={entradaActiva} />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/50">
                  Cliente
                </span>
                <input
                  name="cliente"
                  defaultValue={borrador.cliente}
                  placeholder="opcional: el repartidor lo conoce"
                  className={ESTILO_CAMPO}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/50">
                  Teléfono
                </span>
                <input
                  name="telefono"
                  defaultValue={borrador.telefono}
                  placeholder="opcional"
                  className={ESTILO_CAMPO}
                />
              </label>
              <label className="grid gap-1 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/50">
                  Dirección de entrega (opcional)
                </span>
                <input
                  name="direccion"
                  defaultValue={borrador.direccion}
                  placeholder="el repartidor la conoce de memoria"
                  className={ESTILO_CAMPO}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/50">
                  Barrio
                </span>
                <input name="barrio" defaultValue={borrador.barrio} className={ESTILO_CAMPO} />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/50">
                  Referencia
                </span>
                <input
                  name="referencia"
                  defaultValue={borrador.referencia}
                  className={ESTILO_CAMPO}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/50">
                  Hora de entrega
                </span>
                <input
                  name="horaEntrega"
                  defaultValue={borrador.hora ?? ""}
                  maxLength={40}
                  placeholder="opcional, ej.: 1 y media"
                  className={ESTILO_CAMPO}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-texto-muted/50">
                  Nota para la cocina (opcional)
                </span>
                <input
                  name="observaciones"
                  maxLength={140}
                  placeholder="Ej.: sin arveja, toalla aparte"
                  className={ESTILO_CAMPO}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={creando || !borrador.armable}
                className="flex items-center gap-2 rounded-xl bg-success/15 px-4 py-2.5 text-sm font-bold text-success-text ring-1 ring-success/30 transition hover:bg-success/25 disabled:opacity-50"
              >
                {creando
                  ? "Creando…"
                  : `Crear ${borrador.cantidad > 1 ? `${borrador.cantidad} domicilios` : "domicilio"}`}
              </button>
              <Link
                href="/admin/domicilios/whatsapp"
                className="rounded-xl px-3 py-2.5 text-sm font-bold text-texto-muted/60 transition hover:text-texto-app"
              >
                Salir de la revisión
              </Link>
            </div>
            {!borrador.armable ? (
              <p className="mt-2 text-xs text-danger-text">
                Sin proteína no se puede armar el almuerzo: corrige en “Abrir a
                mano”.
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
