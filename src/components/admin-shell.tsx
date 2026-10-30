"use client";

import gsap from "gsap";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidebarAdmin } from "./sidebar-admin";

// w-64 = 256px (ancho del sidebar) · canal mínimo visible cuando está cerrado
const ANCHO_SIDEBAR = 256;
const CANAL = 64;

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
  const inicial = useRef(true);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const contenido = contenidoRef.current;
    if (!sidebar || !contenido) return;

    const animar = !inicial.current;
    inicial.current = false;
    const dur = animar ? 0.5 : 0;
    const ease = "power3.inOut";
    const escritorio = window.matchMedia("(min-width: 1024px)").matches;

    // El sidebar se desliza fuera de pantalla al cerrarse
    gsap.to(sidebar, {
      x: escritorio && !abierto ? -ANCHO_SIDEBAR : 0,
      duration: dur,
      ease,
      overwrite: "auto",
    });

    // El contenido se expande ocupando el espacio liberado
    if (escritorio) {
      gsap.to(contenido, {
        paddingLeft: abierto ? ANCHO_SIDEBAR : CANAL,
        duration: dur,
        ease,
        overwrite: "auto",
      });
    } else {
      gsap.set(contenido, { clearProps: "paddingLeft" });
    }

    // Revelado suave de los bloques (divs/páneles) al abrir o cerrar
    const main = mainRef.current;
    if (animar && main) {
      const bloques = Array.from(main.children);
      if (bloques.length) {
        gsap.fromTo(
          bloques,
          { opacity: 0.55, y: 16, scale: 0.99 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.5,
            ease: "power2.out",
            stagger: 0.06,
            overwrite: "auto",
            onComplete: () =>
              gsap.set(bloques, { clearProps: "opacity,transform" }),
          },
        );
      }
    }

    // Reposiciona sin animación si cambia el tamaño de la ventana
    const alRedimensionar = () => {
      const esc = window.matchMedia("(min-width: 1024px)").matches;
      gsap.set(sidebar, { x: esc && !abierto ? -ANCHO_SIDEBAR : 0 });
      if (esc) {
        gsap.set(contenido, {
          paddingLeft: abierto ? ANCHO_SIDEBAR : CANAL,
        });
      } else {
        gsap.set(contenido, { clearProps: "paddingLeft" });
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
        className="fixed left-4 top-5 z-50 hidden h-10 w-10 items-center justify-center rounded-xl bg-panel-app text-texto-app ring-1 ring-borde-app shadow-flotante transition hover:bg-amber-brand hover:text-brown-950 lg:flex"
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
