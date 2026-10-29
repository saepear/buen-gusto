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
    <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5 text-amber-brand/60">
        <Icono className="h-10 w-10" />
      </span>
      <h2 className="mt-5 font-display text-2xl text-white">{titulo}</h2>
      <p className="mt-2 max-w-md text-cream-200/50">{detalle}</p>
      <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-brand/10 px-4 py-1.5 text-sm font-bold text-amber-brand ring-1 ring-amber-brand/20">
        <Hammer className="h-4 w-4" /> {fase}
      </span>
    </div>
  );
}
