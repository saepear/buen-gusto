"use client";

import gsap from "gsap";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidebarAdmin } from "./sidebar-admin";

// w-64 = 256px (ancho del sidebar) · canal mínimo visible cuando está cerrado
const ANCHO_SIDEBAR = 256;
const CANAL = 64;
// Ancho máximo del contenido: se amplía al ocultar el sidebar para que crezca de verdad
const MAX_CONTENIDO = 1152; // 72rem (max-w-6xl)
const MAX_CONTENIDO_AMPLIO = 1440;

export function AdminShell({
  nombre,
  children,
}: {
  nombre: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const activoRef = useRef(false);
  const inicial = useRef(true);

  // Marca si hay una animación en curso para ignorar el "resize" que dispara el navegador
  type Objetivo = Parameters<typeof gsap.to>[0];
  type Vars = NonNullable<Parameters<typeof gsap.to>[1]>;
  const animar = (objetivo: Objetivo, vars: Vars, dur: number) => {
    if (dur === 0) {
      gsap.set(objetivo, vars);
      return;
    }
    activoRef.current = true;
    gsap.to(objetivo, {
      ...vars,
      duration: dur,
      onComplete: () => {
        activoRef.current = false;
      },
    });
  };

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const contenido = contenidoRef.current;
    const main = mainRef.current;
    if (!sidebar || !contenido) return;

    const debeAnimar = !inicial.current;
    inicial.current = false;
    const dur = debeAnimar ? 0.55 : 0;
    const ease = "power3.inOut";
    const escritorio = window.matchMedia("(min-width: 1024px)").matches;

    // El sidebar se desliza fuera de pantalla al cerrarse
    animar(
      sidebar,
      { x: escritorio && !abierto ? -ANCHO_SIDEBAR : 0, ease, overwrite: "auto" },
      dur,
    );

    if (escritorio) {
      // El contenido ocupa el espacio liberado…
      animar(
        contenido,
        { paddingLeft: abierto ? ANCHO_SIDEBAR : CANAL, ease, overwrite: "auto" },
        dur,
      );
      // …y crece de verdad en ancho, por lo que los divs se agrandan
      if (main) {
        animar(
          main,
          {
            maxWidth: abierto ? MAX_CONTENIDO : MAX_CONTENIDO_AMPLIO,
            ease,
            overwrite: "auto",
          },
          dur,
        );
      }
    } else {
      gsap.set(contenido, { clearProps: "paddingLeft" });
      if (main) gsap.set(main, { clearProps: "maxWidth" });
    }

    // Micro-escala del contenido (sin tocar la opacidad → no parece recarga):
    // al cerrar crece, al abrir se achica.
    if (debeAnimar && main) {
      const bloques = Array.from(main.children);
      if (bloques.length) {
        const creciendo = !abierto;
        gsap.fromTo(
          bloques,
          { scale: creciendo ? 0.96 : 1.04 },
          {
            scale: 1,
            duration: 0.55,
            ease: creciendo ? "back.out(1.4)" : "power2.inOut",
            stagger: { each: 0.04, from: "start" },
            overwrite: "auto",
            onComplete: () => gsap.set(bloques, { clearProps: "transform" }),
          },
        );
      }
    }

    // Reposiciona sin animación si cambia el tamaño de la ventana
    const alRedimensionar = () => {
      if (activoRef.current) return; // ignora el resize provocado por la propia animación
      const esc = window.matchMedia("(min-width: 1024px)").matches;
      gsap.set(sidebar, { x: esc && !abierto ? -ANCHO_SIDEBAR : 0 });
      if (esc) {
        gsap.set(contenido, { paddingLeft: abierto ? ANCHO_SIDEBAR : CANAL });
        if (main) {
          gsap.set(main, {
            maxWidth: abierto ? MAX_CONTENIDO : MAX_CONTENIDO_AMPLIO,
          });
        }
      } else {
        gsap.set(contenido, { clearProps: "paddingLeft" });
        if (main) gsap.set(main, { clearProps: "maxWidth" });
      }
    };
    window.addEventListener("resize", alRedimensionar);
    return () => window.removeEventListener("resize", alRedimensionar);
  }, [abierto]);

  return (
    <div className="flex min-h-screen bg-fondo-app text-texto-app">
      <SidebarAdmin ref={sidebarRef} nombre={nombre} />

      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Ocultar menú" : "Mostrar menú"}
        title={abierto ? "Ocultar menú" : "Mostrar menú"}
        className="fixed left-5 top-7 z-50 hidden h-10 w-10 items-center justify-center rounded-xl bg-panel-app text-texto-app ring-1 ring-borde-app shadow-flotante transition hover:bg-amber-brand hover:text-brown-950 lg:flex"
      >
        {abierto ? (
          <PanelLeftClose className="h-5 w-5" />
        ) : (
          <PanelLeftOpen className="h-5 w-5" />
        )}
      </button>

      <div ref={contenidoRef} className="min-w-0 flex-1 lg:pl-64">
        <main
          ref={mainRef}
          className="mx-auto max-w-6xl p-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:p-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
