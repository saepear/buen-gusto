import { formatCOP } from "@/lib/format";

/** Barras verticales con etiqueta de dinero (server component, sin JS) */
export function GraficoDinero({
  datos,
}: {
  datos: { etiqueta: string; valor: number; resaltar?: boolean }[];
}) {
  if (datos.length === 0) return null;
  const max = Math.max(1, ...datos.map((d) => d.valor));

  return (
    <div className="flex items-end gap-2">
      {datos.map((d) => (
        <div
          key={d.etiqueta}
          className="flex min-w-0 flex-1 flex-col items-center gap-1"
        >
          <span className="text-[10px] font-bold leading-none text-cream-100">
            {d.valor > 0 ? formatCOP(d.valor) : ""}
          </span>
          <div className="flex h-28 w-full items-end">
            <div
              style={{ height: `${Math.max(4, Math.round((d.valor / max) * 100))}%` }}
              className={
                "w-full rounded-lg transition-all " +
                (d.resaltar ? "bg-orange-brand" : "bg-amber-brand/70")
              }
            />
          </div>
          <span
            className={
              "truncate text-[10px] leading-none " +
              (d.resaltar ? "font-bold text-white" : "text-cream-200/45")
            }
          >
            {d.etiqueta}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barra horizontal con unidades (para proteínas y extras) */
export function BarraUnidades({
  etiqueta,
  unidades,
  max,
  detalle,
}: {
  etiqueta: string;
  unidades: number;
  max: number;
  detalle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 truncate text-sm font-bold text-cream-100">
        {etiqueta}
      </span>
      <div className="h-5 min-w-0 flex-1 rounded-full bg-white/5">
        <div
          style={{
            width: `${Math.max(6, Math.round((unidades / Math.max(1, max)) * 100))}%`,
          }}
          className="h-5 rounded-full bg-orange-brand"
        />
      </div>
      <span className="w-28 shrink-0 text-right text-xs font-bold text-cream-200/70">
        {unidades}×{detalle ? ` · ${detalle}` : ""}
      </span>
    </div>
  );
}
