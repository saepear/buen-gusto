"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Banknote,
  ClipboardList,
  DoorOpen,
  Plus,
  Search,
  UtensilsCrossed,
} from "lucide-react";

type Estado = "LIBRE" | "OCUPADA" | "POR_PAGAR";
type Mesa = { id: number; nombre: string; estado: Estado; comandas: number };
type Filtro = "TODAS" | Estado;

const filtros: { id: Filtro; texto: string; Icono: typeof DoorOpen }[] = [
  { id: "TODAS", texto: "Todas", Icono: UtensilsCrossed },
  { id: "LIBRE", texto: "Libres", Icono: DoorOpen },
  { id: "OCUPADA", texto: "Ocupadas", Icono: UtensilsCrossed },
  { id: "POR_PAGAR", texto: "Por pagar", Icono: Banknote },
];

function etiqueta(estado: Estado) {
  return estado === "LIBRE" ? "Libre" : estado === "POR_PAGAR" ? "Por pagar" : "Ocupada";
}

export function TableroMesero({ usuario, mesas }: { usuario: string; mesas: Mesa[] }) {
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [busqueda, setBusqueda] = useState("");
  const contador = (estado: Estado) => mesas.filter((mesa) => mesa.estado === estado).length;
  const visibles = useMemo(() => mesas.filter((mesa) =>
    (filtro === "TODAS" || mesa.estado === filtro) && mesa.nombre.toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()),
  ), [busqueda, filtro, mesas]);

  return <main className="mx-auto w-full max-w-lg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 sm:max-w-2xl sm:px-6 sm:pt-6">
    <section className="overflow-hidden rounded-[2rem] bg-panel-app ring-1 ring-borde-app shadow-2xl">
      <div className="bg-gradient-to-br from-amber-brand/18 via-orange-brand/8 to-transparent p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-brand">Turno activo</p>
        <h1 className="mt-1 font-display text-2xl text-texto-app">Hola, {usuario}</h1>
        <p className="mt-1 max-w-sm text-sm leading-5 text-texto-muted/70">Elige una mesa para revisar la comanda o toma el próximo pedido.</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-borde-app border-t border-borde-app">
        {[
          ["Libres", contador("LIBRE"), DoorOpen, "text-success-text"],
          ["Ocupadas", contador("OCUPADA"), UtensilsCrossed, "text-orange-brand"],
          ["Por pagar", contador("POR_PAGAR"), Banknote, "text-warning-text"],
        ].map(([texto, valor, Icono, color]) => {
          const I = Icono as typeof DoorOpen;
          return <button key={String(texto)} type="button" onClick={() => setFiltro(texto === "Libres" ? "LIBRE" : texto === "Ocupadas" ? "OCUPADA" : "POR_PAGAR")} className="min-h-20 px-2 py-3 text-center transition active:bg-campo-app">
            <span className={`mx-auto flex w-fit items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${String(color)}`}><I size={13} />{String(texto)}</span>
            <strong className="mt-1 block font-display text-2xl text-texto-app">{Number(valor)}</strong>
          </button>;
        })}
      </div>
    </section>

    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-brand">Salón</p><h2 className="font-display text-xl text-texto-app">Mesas</h2></div><span className="rounded-full bg-panel-app px-3 py-1.5 text-xs font-bold text-texto-muted/70 ring-1 ring-borde-app">{visibles.length} visibles</span></div>
      <label className="flex h-12 items-center gap-3 rounded-2xl bg-panel-app px-4 ring-1 ring-borde-app focus-within:ring-2 focus-within:ring-amber-brand/60"><Search size={18} className="shrink-0 text-texto-muted/45" /><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar una mesa…" className="min-w-0 flex-1 bg-transparent text-base text-texto-app outline-none placeholder:text-texto-muted/40" /></label>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar mesas">{filtros.map(({ id, texto, Icono }) => <button key={id} type="button" role="tab" aria-selected={filtro === id} onClick={() => setFiltro(id)} className={"flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold ring-1 transition active:scale-95 " + (filtro === id ? "bg-amber-brand text-brown-950 ring-amber-brand" : "bg-panel-app text-texto-muted/70 ring-borde-app") }><Icono size={14} />{texto}</button>)}</div>
      {visibles.length ? <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{visibles.map((mesa) => <Link key={mesa.id} href={`/mesero/mesa/${mesa.id}`} className={"group relative min-h-44 overflow-hidden rounded-[1.65rem] p-4 text-left ring-1 transition active:scale-[.97] " + (mesa.estado === "LIBRE" ? "bg-panel-app ring-borde-app" : mesa.estado === "POR_PAGAR" ? "bg-warning/10 ring-warning/35" : "bg-orange-brand/10 ring-orange-brand/35")}><span className={"flex h-10 w-10 items-center justify-center rounded-xl " + (mesa.estado === "LIBRE" ? "bg-success/10 text-success-text" : mesa.estado === "POR_PAGAR" ? "bg-warning/15 text-warning-text" : "bg-orange-brand/15 text-orange-brand")}><UtensilsCrossed size={19} /></span><span className="mt-4 block truncate font-display text-xl text-texto-app">{mesa.nombre}</span><span className={"mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide " + (mesa.estado === "LIBRE" ? "bg-success/10 text-success-text" : mesa.estado === "POR_PAGAR" ? "bg-warning/15 text-warning-text" : "bg-orange-brand/15 text-orange-brand")}>{etiqueta(mesa.estado)}</span><footer className="absolute inset-x-4 bottom-4 flex items-center justify-between border-t border-borde-app/70 pt-3 text-xs font-bold text-texto-muted/65">{mesa.estado === "LIBRE" ? <span className="flex items-center gap-1 text-amber-brand"><Plus size={14} /> Tomar pedido</span> : <span className="flex items-center gap-1"><ClipboardList size={14} /> {mesa.comandas} {mesa.comandas === 1 ? "comanda" : "comandas"}</span>}<ArrowUpRight size={16} className="text-amber-brand" /></footer></Link>)}</div> : <div className="mt-4 rounded-[1.75rem] border border-dashed border-borde-app p-8 text-center"><Search className="mx-auto text-texto-muted/35" /><p className="mt-3 font-bold text-texto-app">No encontramos una mesa</p><button type="button" onClick={() => { setBusqueda(""); setFiltro("TODAS"); }} className="mt-2 text-sm font-bold text-amber-brand">Limpiar filtros</button></div>}</section>
  </main>;
}
