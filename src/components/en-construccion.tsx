import { Hammer, type LucideIcon } from "lucide-react";

export function EnConstruccion({
  titulo,
  fase,
  detalle,
  Icono,
}: {
  titulo: string;
  fase: string;
  detalle: string;
  Icono: LucideIcon;
}) {
  return (
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-brown-600/25 bg-cream-100 p-10 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brown-800/10 text-brown-700">
        <Icono className="h-10 w-10" />
      </span>
      <h2 className="mt-5 font-display text-2xl text-brown-800">{titulo}</h2>
      <p className="mt-2 max-w-md text-brown-600">{detalle}</p>
      <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-brand/25 px-4 py-1.5 text-sm font-bold text-brown-700">
        <Hammer className="h-4 w-4" /> {fase}
      </span>
    </div>
  );
}
