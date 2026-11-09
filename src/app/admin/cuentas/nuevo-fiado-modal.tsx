"use client";

import { CircleDollarSign, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ModalFlip, type OrigenModal } from "@/components/modal-flip";
import { FormularioNuevaCuenta, type OpcionCliente } from "./formularios";

export function NuevoFiadoModal({
  clienteFijo,
  autoOpen = false,
}: {
  clienteFijo: OpcionCliente | null;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [origen, setOrigen] = useState<OrigenModal | null>(() =>
    autoOpen ? { x: 24, y: 24, w: 220, h: 48 } : null,
  );

  function abrir() {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    setOrigen({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
  }

  useEffect(() => {
    if (!autoOpen) return;
    const timer = window.setTimeout(() => {
      const rect = trigger.current?.getBoundingClientRect();
      setOrigen(
        rect
          ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
          : { x: 24, y: 24, w: 220, h: 48 },
      );
    }, 40);
    return () => window.clearTimeout(timer);
  }, [autoOpen]);

  function cerrar() {
    setOrigen(null);
    if (autoOpen) router.replace("/admin/cuentas");
    trigger.current?.focus();
  }

  return (
    <>
      <button ref={trigger} type="button" onClick={abrir} className="cuentas-new-trigger">
        <Plus size={18} />
        Registrar fiado
      </button>
      {origen ? (
        <ModalFlip
          rapida
          origen={origen}
          onClose={cerrar}
          ariaLabel="Registrar nuevo fiado"
          panelClassName="cuentas-new-panel"
        >
          {(cerrarModal) => (
            <div className="cuentas-new-modal">
              <header className="cuentas-new-header" data-anim>
                <div className="cuentas-new-title">
                  <span className="cuentas-new-icon"><CircleDollarSign size={21} /></span>
                  <div>
                    <span className="cuentas-eyebrow">NUEVA CUENTA</span>
                    <h2>Registrar fiado</h2>
                    <p>Elige la persona, congela el valor y deja trazabilidad del saldo.</p>
                  </div>
                </div>
                <button type="button" onClick={cerrarModal} className="cuentas-modal-close" aria-label="Cerrar registro">
                  <X size={19} />
                </button>
              </header>
              <div className="cuentas-new-body" data-anim>
                <FormularioNuevaCuenta clienteFijo={clienteFijo} sinTitulo />
              </div>
            </div>
          )}
        </ModalFlip>
      ) : null}
    </>
  );
}
