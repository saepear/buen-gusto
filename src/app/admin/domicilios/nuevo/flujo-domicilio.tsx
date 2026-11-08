"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { EVENTO_PROGRESO_DOMICILIO } from "./progreso-domicilio";

const PASOS = [
  ["Cliente", "Datos de entrega"],
  ["Pedido", "Productos y extras"],
  ["Confirmación", "Revisar y crear"],
] as const;

export function FlujoDomicilio() {
  const [actual, setActual] = useState(1);

  useEffect(() => {
    const actualizar = (evento: Event) => {
      setActual((evento as CustomEvent<number>).detail);
    };

    window.addEventListener(EVENTO_PROGRESO_DOMICILIO, actualizar);
    return () => window.removeEventListener(EVENTO_PROGRESO_DOMICILIO, actualizar);
  }, []);

  return (
    <div className="domicilios-stepper" aria-label="Progreso del domicilio">
      <span className="domicilios-progress" style={{ width: `${((actual - 1) / 2) * 100}%` }} />
      {PASOS.map(([titulo, detalle], indice) => {
        const numero = indice + 1;
        const completo = numero < actual;
        const activo = numero === actual;
        return (
          <div
            key={titulo}
            className={`domicilios-step${activo ? " is-active" : ""}${completo ? " is-complete" : ""}`}
            aria-current={activo ? "step" : undefined}
          >
            <b>{completo ? <Check aria-hidden /> : numero}</b>
            <span><strong>{titulo}</strong><small>{detalle}</small></span>
          </div>
        );
      })}
    </div>
  );
}
