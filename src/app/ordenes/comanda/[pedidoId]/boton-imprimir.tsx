"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function BotonImprimir({
  leyenda = "Imprimir comanda",
  volverHref = "/ordenes",
}: {
  leyenda?: string;
  volverHref?: string;
}) {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("autoPrint") === "1";

  useEffect(() => {
    if (autoPrint) {
      window.print();
    }
  }, [autoPrint]);

  return (
    <div className="mt-6 flex justify-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-2 rounded-xl bg-amber-brand px-5 py-3 font-display text-brown-950 transition hover:bg-orange-brand hover:text-texto-app"
      >
        <Printer className="h-5 w-5" /> {leyenda}
      </button>
      <Link
        href={volverHref}
        className="flex items-center gap-2 rounded-xl border border-brown-700/50 px-5 py-3 text-texto-muted/85 transition hover:bg-brown-800"
      >
        <ArrowLeft className="h-5 w-5" /> Volver
      </Link>
    </div>
  );
}
