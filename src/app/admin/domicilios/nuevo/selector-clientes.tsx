"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Search, UserRound, Check, ArrowRight, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { buscarClientesDomicilio, type ClienteDomicilio } from "./clientes-actions";

gsap.registerPlugin(useGSAP);

export function SelectorClientesDomicilio({ clientes, elegido, nombreElegido, onElegir }: {
  clientes: ClienteDomicilio[];
  elegido: number | null;
  nombreElegido: string;
  onElegir: (cliente: ClienteDomicilio) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [contenidoVisible, setContenidoVisible] = useState(false);
  const contenidoId = useId();
  const botonRef = useRef<HTMLButtonElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const [resultado, setResultado] = useState({ filas: clientes, termino: "", error: false });
  const buscando = resultado.termino !== busqueda;

  useGSAP(() => {
    const contenido = contenidoRef.current;
    if (!contenido) return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.killTweensOf(contenido);

    if (abierto) {
      gsap.fromTo(contenido,
        { height: reducido ? "auto" : 0, opacity: reducido ? 1 : 0, y: reducido ? 0 : -8 },
        { height: "auto", opacity: 1, y: 0, duration: reducido ? 0 : .34, ease: "power2.out", clearProps: "height,transform" },
      );
      return;
    }

    gsap.to(contenido, {
      height: 0,
      opacity: 0,
      y: reducido ? 0 : -8,
      duration: reducido ? 0 : .24,
      ease: "power2.in",
      onComplete: () => setContenidoVisible(false),
    });
  }, { dependencies: [abierto, contenidoVisible], scope: contenidoRef, revertOnUpdate: false });

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const filas = await buscarClientesDomicilio(busqueda);
        if (vigente) setResultado({ filas, termino: busqueda, error: false });
      } catch {
        if (vigente) setResultado({ filas: [], termino: busqueda, error: true });
      }
    }, 250);
    return () => { vigente = false; clearTimeout(timer); };
  }, [busqueda, abierto]);

  return <section className="domicilios-client-picker" aria-label="Elegir cliente del domicilio">
    <div className="domicilios-client-toolbar">
      <div><div className="domicilios-client-heading"><UserRound aria-hidden size={21} /><h2>¿Para quién es el domicilio?</h2></div>
        <p className="domicilios-client-summary" role="status">{elegido ? `Cliente: ${nombreElegido} · datos cargados en la comanda` : "Selecciona un cliente registrado para autocompletar su entrega."}</p>
      </div>
      <button ref={botonRef} type="button" className="domicilios-client-toggle" aria-expanded={abierto} aria-controls={contenidoId} onClick={() => {
        if (!abierto) setContenidoVisible(true);
        setAbierto(!abierto);
      }}>
        {abierto ? "Ocultar clientes" : elegido ? "Cambiar cliente" : "Ver clientes"}<ChevronDown aria-hidden size={18} />
      </button>
    </div>
    {contenidoVisible && <div ref={contenidoRef} id={contenidoId} className="domicilios-client-content" aria-hidden={!abierto}>
    <label className="domicilios-client-search"><Search aria-hidden size={18} /><input type="search" aria-label="Buscar clientes del domicilio" placeholder="Buscar por nombre o teléfono…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label>
    <p role="status" className="domicilios-client-status">{buscando ? "Buscando clientes…" : resultado.error ? "No se pudieron cargar los clientes. Cambia la búsqueda para intentar de nuevo." : resultado.filas.length === 0 ? "No encontramos clientes. Puedes ingresar sus datos en la comanda." : elegido ? "Datos del cliente cargados en la comanda." : "Clientes registrados · selecciona una ficha"}</p>
    <div className="domicilios-client-grid" aria-busy={buscando}>
      {!buscando && resultado.filas.map(c => <button type="button" key={c.id} aria-pressed={elegido === c.id} className="domicilios-client-card" onClick={() => {
        onElegir(c);
        setAbierto(false);
        botonRef.current?.focus();
      }}>
        <span className="domicilios-client-avatar">{c.nombre.slice(0, 1).toUpperCase()}</span>
        <span className="domicilios-client-info"><strong>{c.nombre}</strong><small>{c.telefono || "Sin teléfono"}</small><small>{[c.direccion, c.barrio].filter(Boolean).join(" · ") || "Sin dirección registrada"}</small></span>
        {elegido === c.id ? <Check aria-hidden size={17} /> : <ArrowRight aria-hidden size={17} />}
      </button>)}
    </div>
    </div>}
  </section>;
}
