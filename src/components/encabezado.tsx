import type { ReactNode } from "react";

/**
 * Encabezado de página del panel. `acciones` (opcional) aloja controles
 * compactos alineados con el título — p. ej. el selector de tema, que así
 * deja de ocupar un panel entero.
 */
export function EncabezadoPagina({
  titulo,
  subtitulo,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-4xl text-texto-app">{titulo}</h1>
        {subtitulo && <p className="mt-2 text-texto-muted/50">{subtitulo}</p>}
      </div>
      {acciones ? <div className="shrink-0">{acciones}</div> : null}
    </header>
  );
}
