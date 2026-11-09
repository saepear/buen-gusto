"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

gsap.registerPlugin(useGSAP);

/** Rect de la ficha que abrió el modal: el panel nace ahí y allí se pliega */
export type OrigenModal = { x: number; y: number; w: number; h: number };

/** FLIP manual: rectángulo de origen vs. final */
function centroDe(r: DOMRect) {
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
}

/**
 * Modal con la animación del POS (nació en Mesas, hoy la comparten módulos):
 * el panel nace dentro del rect de la ficha que lo abrió, crece a su tamaño
 * final mientras el fondo se oscurece y el contenido entra en cascada
 * ([data-anim]); al cerrar el contenido se recoge primero y el panel se
 * pliega de regreso hacia la ficha. Escape y clic fuera cierran; el scroll
 * del fondo queda bloqueado mientras está abierto.
 *
 * `origen` se toma del rect de la ficha (getBoundingClientRect). Con
 * prefers-reduced-motion la animación se omite sin perder funcionalidad.
 */
export function ModalFlip({
  origen,
  onClose,
  ariaLabel,
  rapida = false,
  animacion = "ficha",
  panelClassName = "",
  children,
}: {
  origen: OrigenModal;
  onClose: () => void;
  ariaLabel: string;
  /** Ajusta la cadencia al modal ágil del Menú del día. */
  rapida?: boolean;
  /** Entrada proporcional para paneles cuyo contenido ya está visible. */
  animacion?: "ficha" | "suave";
  /** Clase adicional para fichas que necesitan un ancho distinto al estándar. */
  panelClassName?: string;
  /** Contenido del panel; recibe la función de cierre para el botón ✕ */
  children: (cerrar: () => void) => ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cerrandoRef = useRef(false);
  const aperturaRef = useRef<gsap.core.Timeline | null>(null);

  const { contextSafe } = useGSAP(
    () => {
      const panel = panelRef.current;
      const overlay = overlayRef.current;
      if (!panel || !overlay) return;

      const filas = panel.querySelectorAll<HTMLElement>("[data-anim]");
      const reducido = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reducido || !origen) {
        gsap.set([overlay, panel, ...filas], { autoAlpha: 1 });
        return;
      }

      if (animacion === "suave") {
        // La tarjeta y el formulario tienen proporciones distintas. Una
        // escala uniforme corta evita comprimir texto y controles.
        gsap.set(panel, { autoAlpha: 0, y: 20, scale: 0.97, transformOrigin: "50% 50%" });
        gsap.set(overlay, { autoAlpha: 0 });
        aperturaRef.current = gsap.timeline()
          .to(overlay, { autoAlpha: 1, duration: 0.2, ease: "power2.out" }, 0)
          .to(panel, { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: "power3.out" }, 0.03);
        return;
      }

      // El panel mide su posición final ANTES de pintarse (useGSAP corre en
      // layout effect): sin parpadeo del panel en el centro.
      const final = panel.getBoundingClientRect();
      const fc = centroDe(final);
      gsap.set(panel, {
        transformOrigin: "50% 50%",
        x: origen.x + origen.w / 2 - fc.cx,
        y: origen.y + origen.h / 2 - fc.cy,
        scaleX: origen.w / final.width,
        scaleY: origen.h / final.height,
        autoAlpha: 1, // la superficie nace donde está la mesa y crece de ahí
      });
      gsap.set([overlay, ...filas], { autoAlpha: 0 });

      // Apertura: ficha → superficie expansión y luego el contenido en cascada.
      // El perfil rápido mantiene la misma cadencia visual del Menú del día.
      gsap
        .timeline()
        .to(overlay, { autoAlpha: 1, duration: 0.3, ease: "power2.out" }, 0)
        .to(
          panel,
          { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: rapida ? 0.5 : 0.55, ease: "power4.inOut" },
          rapida ? 0.04 : 0.06,
        )
        .fromTo(
          filas,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: rapida ? 0.3 : 0.38,
            ease: "power3.out",
            stagger: rapida ? 0.06 : 0.05,
          },
          rapida ? 0.18 : 0.32,
        );
    },
    { scope: panelRef },
  );

  // Cierre asimétrico: el contenido se recoge primero y el panel se pliega
  // de regreso hacia la ficha que abrió el modal.
  const cerrar = useCallback(() => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;

    const panel = panelRef.current;
    const overlay = overlayRef.current;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!panel || !overlay || !origen || reducido) {
      onClose();
      return;
    }

    contextSafe(() => {
      if (animacion === "suave") {
        // Interrumpir la entrada también permite cerrar durante la apertura
        // sin que dos timelines compitan por la transformación del panel.
        aperturaRef.current?.kill();
        gsap.timeline({ onComplete: onClose })
          .to(panel, { autoAlpha: 0, y: 12, scale: 0.98, duration: 0.2, ease: "power2.in", overwrite: "auto" }, 0)
          .to(overlay, { autoAlpha: 0, duration: 0.2, ease: "power2.in" }, 0.04);
        return;
      }
      const filas = panel.querySelectorAll<HTMLElement>("[data-anim]");
      const r = panel.getBoundingClientRect();
      const c = centroDe(r);
      gsap
        .timeline({ onComplete: onClose })
        .to(
          filas,
          {autoAlpha: 0, y: -8, duration: 0.13, stagger: 0.012, ease: "power2.in"},
          0,
        )
        .to(
          panel,
          {
            x: origen.x + origen.w / 2 - c.cx,
            y: origen.y + origen.h / 2 - c.cy,
            scaleX: origen.w / r.width,
            scaleY: origen.h / r.height,
            duration: rapida ? 0.28 : 0.42,
            ease: "power3.inOut",
            overwrite: "auto",
          },
          rapida ? 0.04 : 0.08,
        )
        .to(overlay, { autoAlpha: 0, duration: rapida ? 0.22 : 0.26, ease: "power2.in" }, rapida ? 0.12 : 0.16);
    })();
  }, [contextSafe, onClose, origen, rapida, animacion]);

  // Escape para cerrar y bloqueo del scroll de fondo mientras está abierto
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", alTeclear);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = anterior;
    };
  }, [cerrar]);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={cerrar}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-brown-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[2rem] bg-fondo-app shadow-pop ring-1 ring-borde-app ${panelClassName}`}
      >
        {/* The render prop receives the close handler so modal controls can share the same GSAP timeline. */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {children(cerrar)}
      </div>
    </div>
  );
}
