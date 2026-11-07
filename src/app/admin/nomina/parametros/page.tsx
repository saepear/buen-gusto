// ═════════ Nómina · Parámetros legales (SOLO LECTURA) ═════════
// Las fechas y fuentes van aquí citadas; las filas NO se editan desde la
// pantalla: una modificación normativa entra como fila nueva vía script con
// revisión del dueño (es la forma de no alterar liquidaciones ya cerradas).
import { Scale } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { requerirRol } from "@/lib/session";
import { NavegacionNomina } from "../navegacion";

export const metadata = { title: "Parámetros laborales · Nómina · El Buen Gusto" };

const CATEGORIA_LABEL: Record<string, string> = {
  INDICADOR: "Indicadores",
  RECARGO: "Recargos",
  APOS_TRABAJADOR: "Aportes del trabajador",
  APOS_EMPRESA: "Aportes del empleador",
  JORNADA: "Jornada",
};

function mostrarValor(unidad: string, valor: number): string {
  if (unidad === "PORCENTAJE") return `${(valor / 10000).toFixed(3)} %`;
  if (unidad === "MINUTOS") {
    const h = Math.floor(valor / 60);
    const m = valor % 60;
    return m === 0 ? `${h} h` : `${h}:${String(m).padStart(2, "0")}`;
  }
  return `$${valor.toLocaleString("es-CO")}`;
}

export default async function PaginaParametros() {
  await requerirRol("ADMIN");

  const filas = await db.parametroLaboral.findMany({
    orderBy: [{ categoria: "asc" }, { clave: "asc" }, { vigenciaDesde: "desc" }],
  });

  const porCategoria = new Map<string, typeof filas>();
  for (const f of filas) {
    porCategoria.set(f.categoria, [...(porCategoria.get(f.categoria) ?? []), f]);
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Parámetros laborales"
        subtitulo="Salarios mínimos, recargos y aportes con vigencia y fuente: nada está hardcodeado y el pasado está congelado en las fotos"
      />

      <div className="mb-6">
        <NavegacionNomina actual="/admin/nomina/parametros" />
      </div>

      <p className="mb-6 rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning-text ring-1 ring-warning/20">
        Esta pantalla es SOLO DE CONSULTA. Para actualizar un parámetro
        normativo (ley nueva, decreto del salario mínimo) se agrega una fila
        NUEVA con su vigencia — eso lo hace el dueño con ayuda técnica vía{" "}
        <code>npm run db:nomina</code> — y las liquidaciones cerradas
        conservan su propia foto: nada cambia retroactivamente.
      </p>

      {[...porCategoria.entries()].map(([categoria, filasCat]) => (
        <section key={categoria} className="mb-8">
          <h2 className="mb-2 flex items-center gap-2 font-display text-xl text-texto-app">
            <Scale className="h-5 w-5 text-amber-brand" />
            {CATEGORIA_LABEL[categoria] ?? categoria}
          </h2>
          <div className="overflow-x-auto rounded-2xl bg-panel-app p-1 ring-1 ring-borde-app">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-texto-muted/55">
                  <th className="px-3 py-2">Parámetro</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2">Vigencia</th>
                  <th className="px-3 py-2">Fuente</th>
                </tr>
              </thead>
              <tbody>
                {filasCat.map((f) => (
                  <tr key={f.id} className="border-t border-borde-app/40 align-top">
                    <td className="px-3 py-2">
                      <span className="font-bold text-texto-app">{f.descripcion}</span>
                      <span className="block text-[10px] text-texto-muted/55">{f.clave}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-texto-app">
                      {mostrarValor(f.unidad, f.valor)}
                    </td>
                    <td className="px-3 py-2 text-xs text-texto-muted/70">
                      desde {f.vigenciaDesde.toISOString().slice(0, 10)}
                      {f.vigenciaHasta
                        ? ` · hasta ${f.vigenciaHasta.toISOString().slice(0, 10)}`
                        : " · sin fin declarado"}
                    </td>
                    <td className="px-3 py-2 text-xs text-texto-muted/70">
                      {f.fuente}
                      {f.pendienteVerificar ? (
                        <span className="block font-bold text-warning-text">
                          pendiente verificar
                        </span>
                      ) : null}
                      {f.nota ? <span className="block text-[10px]">{f.nota}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
