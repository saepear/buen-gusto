"use client";

import { Clock, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { formatCOP } from "@/lib/format";
import { precioAlmuerzo } from "@/lib/precios";
import type { BorradorParseado } from "./parser";
import {
  analizarMensaje,
  crearDomiciliosDesdeBorrador,
  type EstadoAnalisis,
} from "./acciones";

const VACIO: EstadoAnalisis = { error: null, ok: null, borrador: null };

const ESTILO_CHIP =
  "rounded-full bg-amber-brand/15 px-3 py-1 text-xs font-bold text-amber-brand ring-1 ring-amber-brand/40";

const ESTILO_CAMPO =
  "w-full rounded-xl border-0 bg-panel-app px-3 py-2 text-sm font-bold text-texto-app ring-1 ring-borde-app focus:ring-2 focus:ring-amber-brand/60";

/**
 * Fase 1 del bot de WhatsApp: "pegar y armar". El admin pega el mensaje del
 * cliente, el parser propone el borrador y él lo confirma con un toque.
 * La IA (Fase 2) reemplazará el parser sin cambiar esta pantalla.
 */
export function BandejaWhatsapp() {
  const [estado, analizar, analizando] = useActionState<EstadoAnalisis, FormData>(
    analizarMensaje,
    VACIO,
  );
  const [estadoCrear, crear, creando] = useActionState<EstadoAnalisis, FormData>(
    crearDomiciliosDesdeBorrador,
    VACIO,
  );

  const borrador: BorradorParseado | null = estadoCrear.borrador ?? estado.borrador;
  const errorCrear = estadoCrear.error ?? estado.error;
  const totalPorUno =
    precioAlmuerzo(borrador?.conSopa ?? true, true) +
    (borrador?.extras.reduce((s, e) => s + e.precio * e.cantidad, 0) ?? 0);
  const totalTodo = totalPorUno * (borrador?.cantidad ?? 1);

  return (
    <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
      <h2 className="flex items-center gap-2 font-display text-xl text-texto-app">
        <MessageCircle className="h-5 w-5 text-texto-muted/70" /> Pegar y armar
      </h2>
      <p className="mt-1 text-sm text-texto-muted/70">
        Pega el mensaje del cliente tal como llegó. El sistema arma el borrador
        contra el menú de hoy; tú lo revisas y confirmas con un toque.
      </p>

      {/* 1) El mensaje */}
      <form action={analizar} className="mt-4">
        <textarea
          name="mensaje"
          rows={4}
          required
          placeholder={'Ej.:\n"Hola, me regalas un almuerzo con frijol y asada de res porfa"'}
          aria-label="Mensaje de WhatsApp del cliente"
          className="w-full resize-y rounded-2xl border-0 bg-panel-app px-4 py-3 text-sm text-texto-app ring-1 ring-borde-app placeholder:text-texto-muted/40 focus:ring-2 focus:ring-amber-brand/60"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={analizando}
            className="flex items-center gap-2 rounded-xl bg-amber-brand px-4 py-2.5 text-sm font-bold text-brown-950 transition hover:bg-orange-brand hover:text-texto-app disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {analizando ? "Entendiendo…" : "Entender el mensaje"}
          </button>
          <Link
            href="/admin/domicilios/nuevo"
            className="rounded-xl px-3 py-2.5 text-sm font-bold text-texto-muted/60 transition hover:text-texto-app"
          >
            Mejor armarlo a mano
          </Link>
        </div>
      </form>

      {/* Error del análisis o de la creación */}
      {errorCrear ? (
        <p className="mt-3 rounded-xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger-text ring-1 ring-danger/20">
          {errorCrear}
        </p>
      ) : null}

      {/* Éxito parcial (creó algunos del lote y se agotó algo) */}
      {estadoCrear.ok ? (
        <p className="mt-3 rounded-xl bg-success/10 px-3.5 py-2.5 text-sm text-success-text ring-1 ring-success/20">
          {estadoCrear.ok}
        </p>
      ) : null}

      {/* 2) El borrador para revisar y confirmar */}
      {borrador ? (
        <div className="mt-5 rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app">
          <h3 className="flex flex-wrap items-center gap-2 font-display text-lg text-texto-app">
            Lo que entendí
            <span className={ESTILO_CHIP}>
              {borrador.cantidad} {borrador.cantidad === 1 ? "almuerzo" : "almuerzos"}
            </span>
            <span
              className={
                borrador.conSopa
                  ? ESTILO_CHIP
                  : "rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success-text ring-1 ring-success/20"
              }
            >
              {borrador.conSopa ? "con sopa" : "bandeja (sin sopa)"}
            </span>
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {borrador.cliente ? (
              <span className={ESTILO_CHIP}>{borrador.cliente}</span>
            ) : (
              <span className="rounded-full bg-fondo-app px-3 py-1 text-xs font-bold text-texto-muted/70 ring-1 ring-borde-app">
                sin contacto (es opcional)
              </span>
            )}
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
            {borrador.sopa ? (
              <span className={ESTILO_CHIP}>{borrador.sopa.nombre}</span>
            ) : null}
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
              {formatCOP(totalPorUno)} c/u
              {borrador.cantidad > 1 ? ` · ${formatCOP(totalTodo)} en total` : ""}
            </span>
          </div>

          {borrador.notas.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {borrador.notas.map((nota) => (
                <li key={nota} className="text-xs text-warning-text">
                  · {nota}
                </li>
              ))}
            </ul>
          ) : null}

          {/* 3) Confirmación: contacto (prellenado con su última entrega) + crear */}
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
              <label className="grid gap-1 sm:col-span-2">
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
            {!borrador.cliente && !borrador.telefono && !borrador.direccion ? (
              <p className="mt-2 text-xs text-texto-muted/60">
                Mensaje sin contacto: se registra solo el valor del almuerzo para Reportes;
                el tablero deja la fila abierta para el repartidor.
              </p>
            ) : null}
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
                Analizar otro mensaje
              </Link>
            </div>
            {!borrador.armable ? (
              <p className="mt-2 text-xs text-danger-text">
                Sin proteína no se puede armar el almuerzo: corrige en “Mejor armarlo a mano”.
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </section>
  );
}
