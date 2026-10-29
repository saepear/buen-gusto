"use client";

import {
  Banknote,
  CupSoda,
  Drumstick,
  Minus,
  Plus,
  Salad,
  Send,
  ShoppingBag,
  Soup,
  Star,
  StickyNote,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";
import { PRECIO_COMPLETO, PRECIO_ICOPOR, precioAlmuerzo } from "@/lib/precios";
import type { ItemMenuHoy } from "@/lib/pedido";
import { tomarPedido, type EstadoAccionPedido } from "@/app/mesero/actions";

const SIN_ENVIAR: EstadoAccionPedido = { error: null, ok: null };

export type Extra = { id: number; nombre: string; tipo: string; precio: number };

/** Encabezado de cada sección, con ícono en píldora de color */
function TituloSeccion({
  Icono,
  clase,
  titulo,
  sub,
}: {
  Icono: LucideIcon;
  clase: string;
  titulo: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " + clase
        }
      >
        <Icono className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/40">
          {titulo}
        </p>
        <p className="text-[11px] text-cream-200/35">{sub}</p>
      </div>
    </div>
  );
}

const ICONO_TIPO: Record<string, LucideIcon> = {
  PROTEINA: Drumstick,
  PRINCIPIO: Wheat,
  ENSALADA: Salad,
  SOPA: Soup,
  BEBIDA: CupSoda,
  ADICIONAL: Star,
};

export function FormularioPedido({
  mesa,
  menu,
  extras,
}: {
  mesa: { id: number; numero: number };
  menu: ItemMenuHoy[];
  extras: Extra[];
}) {
  const [estado, accion, pendiente] = useActionState<EstadoAccionPedido, FormData>(
    tomarPedido,
    SIN_ENVIAR,
  );

  const [conSopa, setConSopa] = useState(true);
  const [llevar, setLlevar] = useState(false);
  const [proteina, setProteina] = useState<number | null>(null);
  const [principios, setPrincipios] = useState<number[]>([]);
  const [ensaladas, setEnsaladas] = useState<number[]>([]);
  const [sopa, setSopa] = useState<number | null>(null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [nota, setNota] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const proteinasMenu = menu.filter((m) => m.tipo === "PROTEINA");
  const principiosMenu = menu.filter((m) => m.tipo === "PRINCIPIO");
  const ensaladasMenu = menu.filter((m) => m.tipo === "ENSALADA");
  const sopasMenu = menu.filter((m) => m.tipo === "SOPA");
  const bebidas = extras.filter((e) => e.tipo === "BEBIDA");
  const adicionales = extras.filter((e) => e.tipo === "ADICIONAL");

  const porItemId = new Map(menu.map((m) => [m.itemId, m]));
  const porProductoId = new Map(extras.map((e) => [e.id, e]));

  const totalExtras = Object.entries(cantidades).reduce(
    (suma, [id, n]) => suma + (porProductoId.get(Number(id))?.precio ?? 0) * n,
    0,
  );
  const precioDelAlmuerzo = precioAlmuerzo(conSopa, llevar);
  const totalComanda = precioDelAlmuerzo + totalExtras;

  const completo = proteina !== null;
  const totalUnidades = Object.values(cantidades).reduce((a, b) => a + b, 0);

  const nombreProteina =
    proteina !== null ? (porItemId.get(proteina)?.nombre ?? "—") : null;
  const nombreSopa = sopa !== null ? (porItemId.get(sopa)?.nombre ?? null) : null;
  const nombresPrincipios = principios
    .map((id) => porItemId.get(id)?.nombre ?? "")
    .filter(Boolean);
  const nombresEnsaladas = ensaladas
    .map((id) => porItemId.get(id)?.nombre ?? "")
    .filter(Boolean);

  const datos = JSON.stringify({
    conSopa,
    proteinaId: proteina,
    principios,
    ensaladas,
    sopaId: conSopa ? sopa : null,
    extras: Object.entries(cantidades).flatMap(([id, n]) =>
      Array.from({ length: n }, () => Number(id)),
    ),
    llevar,
  });

  // Líneas del resumen para el modal de confirmación
  const lineasResumen: { texto: string; detalle?: string; precio: number }[] = [];
  if (nombreProteina) {
    lineasResumen.push({
      texto: nombreProteina,
      detalle: `${conSopa ? "con sopa" : "bandeja"} · ${llevar ? "para llevar" : "en mesa"}`,
      precio: precioDelAlmuerzo,
    });
  }
  if (nombreSopa) {
    lineasResumen.push({ texto: nombreSopa, detalle: "sopa incluida", precio: 0 });
  }
  for (const n of nombresPrincipios) {
    lineasResumen.push({ texto: n, detalle: "principio", precio: 0 });
  }
  for (const n of nombresEnsaladas) {
    lineasResumen.push({ texto: n, detalle: "ensalada", precio: 0 });
  }
  for (const [id, n] of Object.entries(cantidades)) {
    const extra = porProductoId.get(Number(id));
    if (extra) {
      lineasResumen.push({
        texto: extra.nombre,
        detalle: n > 1 ? `${n} unidades` : undefined,
        precio: extra.precio * n,
      });
    }
  }

  const noSePermite = pendiente || !completo;

  const ordenarAhora = () => {
    setConfirmar(false);
    formRef.current?.requestSubmit();
  };

  const aceptarPrincipio = (itemId: number) => {
    setPrincipios((prev) =>
      prev.includes(itemId) ? prev.filter((p) => p !== itemId) : [...prev, itemId],
    );
  };
  const aceptarEnsalada = (itemId: number) => {
    setEnsaladas((prev) =>
      prev.includes(itemId) ? prev.filter((p) => p !== itemId) : [...prev, itemId],
    );
  };
  const pedirExtra = (id: number, delta: number) => {
    setCantidades((prev) => {
      const n = (prev[id] ?? 0) + delta;
      const copia = { ...prev };
      if (n <= 0) delete copia[id];
      else copia[id] = n;
      return copia;
    });
  };

  const FichaMenu = ({
    item,
    elegido,
    onClick,
  }: {
    item: ItemMenuHoy;
    elegido: boolean;
    onClick: () => void;
  }) => {
    const agotado = item.disponibles === 0;
    const Icono = ICONO_TIPO[item.tipo] ?? UtensilsCrossed;
    return (
      <button
        type="button"
        disabled={agotado}
        onClick={onClick}
        className={
          "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition active:scale-95 " +
          (agotado
            ? "bg-white/5 text-cream-200/35 ring-1 ring-white/10"
            : elegido
              ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
              : "bg-white/5 text-white ring-1 ring-white/10 hover:ring-amber-brand/60")
        }
      >
        <span
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl " +
            (agotado
              ? "bg-white/5 text-cream-200/35"
              : elegido
                ? "bg-brown-950/20 text-brown-950"
                : "bg-white/5 text-cream-200/35 ring-1 ring-white/10")
          }
        >
          <Icono className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight font-bold">
            {item.nombre}
          </span>
          <span
            className={
              "text-[10px] font-bold " +
              (agotado
                ? "text-danger"
                : item.disponibles === null
                  ? elegido
                    ? "text-brown-950/70"
                    : "text-cream-200/35"
                  : item.disponibles <= 5
                    ? "text-warning"
                    : elegido
                      ? "text-brown-950/70"
                      : "text-cream-200/35")
            }
          >
            {agotado
              ? "Agotado"
              : item.disponibles === null
                ? "Ilimitado"
                : `Quedan ${item.disponibles}`}
          </span>
        </span>
      </button>
    );
  };

  const ChipExtra = ({ e }: { e: Extra }) => {
    const n = cantidades[e.id] ?? 0;
    const activo = n > 0;
    return (
      <span
        className={
          "flex items-center overflow-hidden rounded-2xl transition " +
          (activo
            ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
            : "bg-white/5 ring-1 ring-white/10")
        }
      >
        {activo ? (
          <button
            type="button"
            aria-label={`Quitar ${e.nombre}`}
            onClick={() => pedirExtra(e.id, -1)}
            className="flex h-full items-center px-2.5 transition hover:bg-danger/80"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => pedirExtra(e.id, 1)}
          className="flex flex-1 items-center gap-2 px-2.5 py-2.5 text-left"
        >
          {!activo ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-cream-200/35 ring-1 ring-white/10">
              <Plus className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="min-w-0">
            <span className="block text-sm leading-tight font-bold">
              {e.nombre}
              {activo && n > 1 ? ` ×${n}` : ""}
            </span>
            <span
              className={
                "text-[10px] font-bold " + (activo ? "text-brown-950/70" : "text-cream-200/35")
              }
            >
              {e.precio > 0 ? formatCOP(e.precio) : "Gratis"}
            </span>
          </span>
        </button>
      </span>
    );
  };

  return (
    <form ref={formRef} action={accion} className="mx-auto w-full max-w-xl sm:max-w-2xl px-4 pt-4 pb-44">
      {estado.error ? (
        <p className="mb-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger ring-1 ring-danger/30">
          {estado.error}
        </p>
      ) : null}

      {/* 1. Canal: en mesa / para llevar */}
      <section className="rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={ShoppingBag}
          clase="bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20"
          titulo="¿Cómo se sirve?"
          sub={`En mesa ${formatCOP(PRECIO_COMPLETO)} · llevar +${formatCOP(PRECIO_ICOPOR)} de icopor`}
        />
        <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1.5 ring-1 ring-white/10">
          {(
            [
              { ok: false, txt: "En mesa", Icono: UtensilsCrossed },
              { ok: true, txt: "Para llevar", Icono: ShoppingBag },
            ] as const
          ).map(({ ok, txt, Icono }) => (
            <button
              key={txt}
              type="button"
              onClick={() => setLlevar(ok)}
              className={
                "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 font-display text-md transition active:scale-95 " +
                (llevar === ok
                  ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
                  : "text-cream-200/70 hover:bg-white/10")
              }
            >
              <span className="flex items-center gap-2">
                <Icono className="h-4 w-4" /> {txt}
              </span>
              <span className="text-[10px] font-bold normal-case">
                {ok ? `+ icopor ${formatCOP(PRECIO_ICOPOR)}` : "se sirve en la mesa"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Sopa o bandeja */}
      <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={Soup}
          clase="bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20"
          titulo="¿El almuerzo lleva sopa?"
          sub="La bandeja es el mismo almuerzo sin sopa"
        />
        <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1.5 ring-1 ring-white/10">
          {(
            [
              { ok: true, txt: "Con sopa" },
              { ok: false, txt: "Bandeja (sin sopa)" },
            ] as const
          ).map((o) => (
            <button
              key={o.txt}
              type="button"
              onClick={() => setConSopa(o.ok)}
              className={
                "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2.5 font-display text-md transition active:scale-95 " +
                (conSopa === o.ok
                  ? "bg-amber-brand text-brown-950 shadow-lg shadow-amber-brand/20"
                  : "text-cream-200/70 hover:bg-white/10")
              }
            >
              <span className="flex items-center gap-2">
                <Soup className="h-4 w-4" /> {o.txt}
              </span>
              <span className="text-[10px] font-bold normal-case">
                {formatCOP(precioAlmuerzo(o.ok, llevar))}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Proteína */}
      <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={Drumstick}
          clase="bg-amber-brand/10 text-amber-brand ring-1 ring-amber-brand/20"
          titulo="Proteína"
          sub="Elige una · el almuerzo se cobra en esta línea"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {proteinasMenu.map((item) => (
            <FichaMenu
              key={item.itemId}
              item={item}
              elegido={proteina === item.itemId}
              onClick={() => setProteina(item.itemId)}
            />
          ))}
        </div>
      </section>

      {/* 4. Principios */}
      <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={Wheat}
          clase="bg-success/10 text-[#a7dd83] ring-1 ring-success/20"
          titulo="Principios"
          sub="Los que pidan · frijoles, papa, pasta…"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {principiosMenu.map((item) => (
            <FichaMenu
              key={item.itemId}
              item={item}
              elegido={principios.includes(item.itemId)}
              onClick={() => aceptarPrincipio(item.itemId)}
            />
          ))}
        </div>
      </section>

      {/* 5. Ensaladas (apartado especial) */}
      <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={Salad}
          clase="bg-[#4ec27e]/10 text-[#8fdcae] ring-1 ring-[#4ec27e]/20"
          titulo="Ensalada"
          sub="Elige una o varias · incluida en la bandeja"
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ensaladasMenu.map((item) => (
            <FichaMenu
              key={item.itemId}
              item={item}
              elegido={ensaladas.includes(item.itemId)}
              onClick={() => aceptarEnsalada(item.itemId)}
            />
          ))}
        </div>
      </section>

      {/* 6. Sopa del día (solo si lleva) */}
      {conSopa ? (
        <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
          <TituloSeccion
            Icono={Soup}
            clase="bg-[#b06fd0]/10 text-[#d3a7e8] ring-1 ring-[#b06fd0]/20"
            titulo="Sopa del día"
            sub="Elige una · queda incluida"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {sopasMenu.map((item) => (
              <FichaMenu
                key={item.itemId}
                item={item}
                elegido={sopa === item.itemId}
                onClick={() => setSopa(item.itemId)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* 7. Bebidas */}
      <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={CupSoda}
          clase="bg-[#4aa3ff]/10 text-[#8fc6ff] ring-1 ring-[#4aa3ff]/20"
          titulo="Bebidas"
          sub="Con precio, sumadas al total"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {bebidas.map((e) => (
            <ChipExtra key={e.id} e={e} />
          ))}
        </div>
      </section>

      {/* 8. Adicionales */}
      <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={Star}
          clase="bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20"
          titulo="Adicionales"
          sub="Huevo, carne extra, los que pidan"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {adicionales.map((e) => (
            <ChipExtra key={e.id} e={e} />
          ))}
        </div>
      </section>

      {/* 8. Nota para la cocina */}
      <section className="mt-3.5 rounded-[2rem] bg-white/[0.02] p-4 ring-1 ring-white/10 shadow-2xl">
        <TituloSeccion
          Icono={StickyNote}
          clase="bg-white/5 text-cream-200/70"
          titulo="Nota para la cocina"
          sub="Sin arroz, sin cebolla, huevo blando…"
        />
        <label className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white/5 px-3.5 py-3.5 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-amber-brand/60">
          <StickyNote className="h-4 w-4 shrink-0 text-cream-200/35" />
          <input
            name="observaciones"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={140}
            placeholder="Escribe la nota…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-cream-200/25"
          />
        </label>
      </section>

      {/* Barra fija: total + ordenar (respetando la barra del sistema) */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-xl sm:max-w-2xl px-3 barra-seguro">
          <div className="flex items-center gap-3 rounded-[1.75rem] bg-brown-950/95 px-4 py-3.5 shadow-flotante ring-1 ring-white/10 backdrop-blur">
            <div className="min-w-0 flex-1 text-cream-100">
              <p className="truncate text-sm font-bold">
                {proteina === null ? (
                  "Falta la proteína"
                ) : (
                  <>
                    <UtensilsCrossed className="mr-1 inline h-3.5 w-3.5" />
                    {conSopa ? "Almuerzo con sopa" : "Bandeja sin sopa"}
                    {llevar ? " · para llevar" : ""}
                    {totalUnidades > 0
                      ? ` + ${totalUnidades} ${totalUnidades === 1 ? "extra" : "extras"}`
                      : ""}
                  </>
                )}
              </p>
              <p className="text-[11px] text-cream-200/70">
                {proteina === null ? (
                  "El precio del almuerzo se muestra arriba"
                ) : (
                  <>
                    Total{" "}
                    <span className="font-display text-base text-cream-50">
                      {formatCOP(totalComanda)}
                    </span>
                    {totalExtras > 0 ? ` (extras ${formatCOP(totalExtras)})` : ""}
                  </>
                )}
              </p>
            </div>
            <input type="hidden" name="mesaId" value={mesa.id} />
            <input type="hidden" name="datos" value={datos} />
            <button
              type="button"
              disabled={noSePermite}
              onClick={() => setConfirmar(true)}
              title={
                !completo
                  ? "Falta la proteína"
                  : "Revisar el resumen antes de enviar"
              }
              className={
                "flex shrink-0 items-center gap-2 rounded-2xl px-5 py-3 font-display text-lg transition active:scale-95 " +
                (noSePermite
                  ? "bg-brown-800/60 text-cream-200/50"
                  : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-white")
              }
            >
              <Send className="h-5 w-5" />
              {pendiente ? "Enviando…" : "Ordenar"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación del pedido */}
      {confirmar ? (
        <div
          className="animar-aparecer fixed inset-0 z-50 flex items-end justify-center bg-brown-950/60 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:pb-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmar(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmar(false);
          }}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar pedido"
        >
          <div className="animar-subir w-full max-w-md rounded-[2rem] bg-brown-900 p-5 shadow-pop ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-brand/20 text-amber-brand ring-1 ring-amber-brand/30">
                <UtensilsCrossed className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg leading-none text-white">
                  Confirmar pedido
                </p>
                <p
                  className={
                    "mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide " +
                    (llevar
                      ? "bg-orange-brand/10 text-orange-brand ring-1 ring-orange-brand/20"
                      : "bg-white/5 text-cream-200/60 ring-1 ring-white/10")
                  }
                >
                  {llevar ? (
                    <>
                      <ShoppingBag className="h-3 w-3" /> Para llevar
                    </>
                  ) : (
                    <>Mesa #{mesa.numero} · en mesa</>
                  )}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 text-sm">
              {lineasResumen.map((l, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate font-bold text-white">
                    {l.texto}
                    {l.detalle ? (
                      <span className="ml-1.5 text-[11px] font-normal text-cream-200/35">
                        {l.detalle}
                      </span>
                    ) : null}
                  </span>
                  {l.precio > 0 ? (
                    <span className="text-xs font-bold text-cream-200/70">
                      {formatCOP(l.precio)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-cream-200/35">
                      incluido
                    </span>
                  )}
                </li>
              ))}
              {nota.trim() ? (
                <li className="flex items-start gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-cream-200/70">
                  <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cream-200/35" />
                  Nota: {nota}
                </li>
              ) : null}
            </ul>

            <div className="my-4 border-t border-dashed border-white/10" />

            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-cream-200/70">Total</span>
              <span className="flex items-baseline gap-1.5">
                {llevar ? (
                  <Banknote className="h-4 w-4 text-orange-brand" />
                ) : null}
                <span className="font-display text-3xl text-white">
                  {formatCOP(totalComanda)}
                </span>
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                className="rounded-2xl bg-white/5 py-3.5 font-display text-md text-cream-200/70 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-95"
              >
                Seguir editando
              </button>
              <button
                type="button"
                disabled={pendiente}
                onClick={ordenarAhora}
                className={
                  "flex items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-md transition active:scale-95 " +
                  (pendiente
                    ? "bg-brown-800/50 text-cream-50/60"
                    : "bg-amber-brand text-brown-950 hover:bg-orange-brand hover:text-white")
                }
              >
                <Send className="h-4.5 w-4.5" />
                {pendiente ? "Enviando…" : "Enviar a cocina"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
