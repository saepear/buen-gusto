"use client";

import { Search, UserRound, Check, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { buscarClientesDomicilio, type ClienteDomicilio } from "./clientes-actions";

export function SelectorClientesDomicilio({ clientes, elegido, onElegir }: {
  clientes: ClienteDomicilio[];
  elegido: number | null;
  onElegir: (cliente: ClienteDomicilio) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [resultado, setResultado] = useState({ filas: clientes, termino: "", error: false });
  const buscando = resultado.termino !== busqueda;

  useEffect(() => {
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
  }, [busqueda]);

  return <section className="domicilios-client-picker" aria-label="Elegir cliente del domicilio">
    <div className="domicilios-client-heading"><UserRound aria-hidden size={21} /><h2>¿Para quién es el domicilio?</h2></div>
    <p>Elige una ficha para completar sus datos de entrega. Puedes ajustarlos en la comanda.</p>
    <label className="domicilios-client-search"><Search aria-hidden size={18} /><input type="search" aria-label="Buscar clientes del domicilio" placeholder="Buscar por nombre o teléfono…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label>
    <p role="status" className="domicilios-client-status">{buscando ? "Buscando clientes…" : resultado.error ? "No se pudieron cargar los clientes. Cambia la búsqueda para intentar de nuevo." : resultado.filas.length === 0 ? "No encontramos clientes. Puedes ingresar sus datos en la comanda." : elegido ? "Datos del cliente cargados en la comanda." : "Clientes registrados · selecciona una ficha"}</p>
    <div className="domicilios-client-grid" aria-busy={buscando}>
      {!buscando && resultado.filas.map(c => <button type="button" key={c.id} aria-pressed={elegido === c.id} className="domicilios-client-card" onClick={() => onElegir(c)}>
        <span className="domicilios-client-avatar">{c.nombre.slice(0, 1).toUpperCase()}</span>
        <span className="domicilios-client-info"><strong>{c.nombre}</strong><small>{c.telefono || "Sin teléfono"}</small><small>{[c.direccion, c.barrio].filter(Boolean).join(" · ") || "Sin dirección registrada"}</small></span>
        {elegido === c.id ? <Check aria-hidden size={17} /> : <ArrowRight aria-hidden size={17} />}
      </button>)}
    </div>
  </section>;
}
