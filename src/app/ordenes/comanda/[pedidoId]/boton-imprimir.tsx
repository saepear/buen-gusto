"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ESTILO_TICKET } from "@/lib/impresion";

export function BotonImprimir({
  leyenda = "Imprimir comanda",
  volverHref = "/ordenes",
}: {
  leyenda?: string;
  volverHref?: string;
}) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoPrint") === "1";

  /**
   * La impresión automática ocurre UNA sola vez por visita: la página se
   * remonta con cada refresco del tiempo real (y en desarrollo, React
   * StrictMode ejecuta los efectos dos veces al montar). Si el diálogo se
   * abriera de nuevo en cada remontaje, cancelar «a la siguiente» abriría
   * otro y no se podría salir: exactamente el bucle que se reportó.
   */
  const yaAutoImprimió = useRef(false);

  useEffect(() => {
    if (!autoPrint || yaAutoImprimió.current) return;
    yaAutoImprimió.current = true;

    // El ?autoPrint=1 sale de la URL al vuelo (replaceState: no causa
    // re-render ni navegación). Así, volver/avanzar o recargar el ticket ya
    // NO re-abre el diálogo; el botón «Imprimir» queda para el ticket físico.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("autoPrint")) {
        url.searchParams.delete("autoPrint");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {
      // Si el entorno bloquea la manipulación de la URL, se sigue igual:
      // la impresión es lo importante, el guardia del ref cubre el resto.
    }

    void document.fonts.ready.then(() => window.print());
  }, [autoPrint]);

  return (
    <><style>{`@media print {${ESTILO_TICKET}}`}</style><div data-print-controls="" className="mt-6 flex justify-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-2 rounded-xl bg-amber-brand px-5 py-3 font-display text-brown-950 transition hover:bg-orange-brand hover:text-texto-app"
      >
        <Printer className="h-5 w-5" /> {leyenda}
      </button>
      <Link
        href={volverHref}
        className="flex items-center gap-2 rounded-xl border border-brown-950/30 bg-white px-5 py-3 font-bold text-brown-950 transition hover:bg-brown-100"
      >
        <ArrowLeft className="h-5 w-5" /> Volver
      </Link>
    </div></>
  );
}
