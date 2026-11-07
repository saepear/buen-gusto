// ═════════ Instalación del módulo Nómina ═════════
// Siembra IDEMPOTENTE (nunca borra ni sobreescribe filas existentes):
//  • ParametroLaboral: filas con vigencia (SMMLV, auxilio, recargos,
//    aportes…) — solo crea la que falta, tocando cero liquidaciones.
//  • Festivo: calendario 2026 (ley Emiliani, lunes traslados).
//
// Uso:
//   npm run db:nomina                          → sobre la base de .env
//   set DATABASE_URL=file:./dev-refactor.db    → sobre otra base (pruebas)
//   npx tsx scripts/instalar-nomina.ts
import { PrismaClient } from "@prisma/client";
import { PARAMETROS_SEMILLA } from "../src/lib/nomina/parametros-data";

const db = new PrismaClient();

// ── Festivos 2026 — semana Santa: Pascua 5 abr 2026. Traslado a lunes
//    según Ley 1855 de 1992 (Emiliani). Verificación: calendario colombiano.
const FESTIVOS_2026: { fecha: string; nombre: string; traslado: boolean }[] = [
  { fecha: "2026-01-01", nombre: "Año Nuevo", traslado: false },
  { fecha: "2026-01-05", nombre: "Día de los Reyes Magos", traslado: true },
  { fecha: "2026-03-23", nombre: "Día de San José", traslado: true },
  { fecha: "2026-04-02", nombre: "Jueves Santo", traslado: false },
  { fecha: "2026-04-03", nombre: "Viernes Santo", traslado: false },
  { fecha: "2026-05-01", nombre: "Día del Trabajo", traslado: false },
  { fecha: "2026-05-18", nombre: "Ascensión de Jesús", traslado: true },
  { fecha: "2026-06-08", nombre: "Corpus Christi", traslado: true },
  { fecha: "2026-06-15", nombre: "Sagrado Corazón de Jesús", traslado: true },
  { fecha: "2026-06-29", nombre: "San Pedro y San Pablo", traslado: false },
  { fecha: "2026-07-20", nombre: "Independencia de Colombia", traslado: false },
  { fecha: "2026-08-10", nombre: "Batalla de Boyacá", traslado: true },
  { fecha: "2026-08-17", nombre: "Asunción de la Virgen", traslado: true },
  { fecha: "2026-10-12", nombre: "Día de la Raza", traslado: false },
  { fecha: "2026-11-02", nombre: "Todos los Santos", traslado: false },
  { fecha: "2026-11-16", nombre: "Independencia de Cartagena", traslado: true },
  { fecha: "2026-12-07", nombre: "Inmaculada Concepción", traslado: true },
  { fecha: "2026-12-25", nombre: "Día de Navidad", traslado: false },
];

async function main(): Promise<void> {
  // ── Parámetros: upsert silencioso por (clave, vigenciaDesde). Si ya existe
  //    NO se modifica, así que una fila sembrada con datos corregidos por el
  //    dueño jamás se retoca desde aquí.
  let creados = 0;
  let existentes = 0;
  for (const p of PARAMETROS_SEMILLA) {
    const existente = await db.parametroLaboral.findUnique({
      where: {
        clave_vigenciaDesde: {
          clave: p.clave,
          vigenciaDesde: new Date(`${p.vigenciaDesde}T12:00:00.000Z`),
        },
      },
    });
    if (existente) {
      existentes++;
      continue;
    }
    await db.parametroLaboral.create({
      data: {
        clave: p.clave,
        valor: p.valor,
        unidad: p.unidad,
        vigenciaDesde: new Date(`${p.vigenciaDesde}T12:00:00.000Z`),
        vigenciaHasta: p.vigenciaHasta
          ? new Date(`${p.vigenciaHasta}T12:00:00.000Z`)
          : null,
        descripcion: p.descripcion,
        fuente: p.fuente,
        pendienteVerificar: p.pendienteVerificar,
        nota: p.nota,
        categoria: p.categoria,
      },
    });
    creados++;
  }
  console.log(
    `ParametroLaboral: ${creados} creados, ${existentes} ya existentes (intactos).`,
  );

  // ── Festivos: idempotente por clave primaria (fecha)
  let festivosNuevos = 0;
  for (const f of FESTIVOS_2026) {
    const yaEsta = await db.festivo.findUnique({ where: { fecha: f.fecha } });
    if (yaEsta) continue;
    await db.festivo.create({
      data: {
        fecha: f.fecha,
        nombre: f.nombre + (f.traslado ? " (trasladado a lunes)" : ""),
        anio: 2026,
      },
    });
    festivosNuevos++;
  }
  console.log(`Festivo: ${festivosNuevos} nuevos; 2026 completo en la tabla.`);
  console.log("Instalación de Nómina lista ✓");
  await db.$disconnect();
}

main().catch((e) => {
  console.error("Instalación detenida:", e);
  process.exit(1);
});
