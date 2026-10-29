export function EncabezadoPagina({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-3xl text-brown-800">{titulo}</h1>
      {subtitulo && <p className="mt-1 text-brown-600">{subtitulo}</p>}
    </header>
  );
}
