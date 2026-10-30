export function EncabezadoPagina({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <header className="mb-9">
      <h1 className="font-display text-4xl text-texto-app">{titulo}</h1>
      {subtitulo && <p className="mt-2 text-texto-muted/50">{subtitulo}</p>}
    </header>
  );
}

