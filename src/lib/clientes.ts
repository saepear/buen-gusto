// Unificación de clientes: evitar duplicados cruzando por teléfono (dígito a
// dígito) y, para los que van sin teléfono, por nombre canónico (sin
// acentos, minúsculas) — la misma regla con la que agrupa el POS de hoy.
import { db } from "@/lib/db";

/** «+57 320 456 7890» → "3204567890": solo los dígitos, para comparar teléfonos */
export function telefonoNormalizado(telefono: string): string {
  return telefono.replace(/\D/g, "");
}

/** Nombre canon: minúsculas, sin acentos, espacios comprimidos */
export function nombreCanonico(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export type DatosClienteBase = {
  nombre: string;
  telefono: string;
  direccion?: string;
  barrio?: string | null;
  observaciones?: string | null;
};

/**
 * Encuentra el cliente guardado que corresponda (por teléfono normalizado;
 * los «solo el nombre» se cruzan por nombre canónico) o crea uno nuevo.
 * Sirve en creaciones de domicilio/apartado/cuenta: si ya existe, se
 * reutiliza su registro y NADIE escribe los datos de nuevo.
 */
export async function buscarOcrearCliente(
  datos: DatosClienteBase,
): Promise<{ id: number; yaExistia: boolean }> {
  const nombre = datos.nombre.trim();
  const telefono = datos.telefono.trim();
  const tel = telefonoNormalizado(telefono);

  if (tel.length >= 7) {
    // Cruzar por teléfono: los teléfonos se guardan con el formato que
    // escribió el usuario, la comparación es de dígitos
    const candidatos = await db.cliente.findMany({
      where: { telefono: { not: "" } },
      take: 500,
      orderBy: { id: "desc" },
    });
    const igual = candidatos.find(
      (c) => telefonoNormalizado(c.telefono) === tel,
    );
    if (igual) return { id: igual.id, yaExistia: true };
  } else {
    // Sin teléfono: match suave por nombre canónico
    const canon = nombreCanonico(nombre);
    if (canon.length > 2) {
      const candidatos = await db.cliente.findMany({
        where: { telefono: "" },
        take: 500,
        orderBy: { id: "desc" },
      });
      const igual = candidatos.find(
        (c) => nombreCanonico(c.nombre) === canon,
      );
      if (igual) return { id: igual.id, yaExistia: true };
    }
  }

  const creado = await db.cliente.create({
    data: {
      nombre,
      telefono,
      direccion: (datos.direccion ?? "").trim(),
      barrio: datos.barrio?.trim() || null,
      observaciones: datos.observaciones?.trim() || null,
    },
  });
  return { id: creado.id, yaExistia: false };
}

/** Resultado de la acción «Vincular historial», para mostrar qué pasó */
export type ResultadoVinculado = {
  clientesCreados: number;
  domiciliosVinculados: number;
};

/**
 * Crea clientes a partir del historial de domicilios sin clienteId y los
 * enlaza. Agrupa por teléfono normalizado; los que van sin teléfono se
 * agrupan por nombre canónico (la única señal fiable que tienen).
 * No toca los datos de los domicilios (nombre/telefono propios quedan como
 * estaban): solo rellena clienteId de los nuevos registros de Cliente.
 */
export async function vincularHistorialDomicilios(): Promise<ResultadoVinculado> {
  const sinVincular = await db.domicilio.findMany({
    where: { clienteId: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      cliente: true,
      telefono: true,
      direccion: true,
      barrio: true,
      clienteId: true,
    },
  });

  const porGrupo = new Map<
    string,
    { clienteId?: number; resultados: DatosClienteBase[] }
  >();
  for (const d of sinVincular) {
    const tel = telefonoNormalizado(d.telefono);
    const clave =
      tel.length >= 7 ? `t:${tel}` : `n:${nombreCanonico(d.cliente)}`;
    const grupo = porGrupo.get(clave) ?? { resultados: [] };
    grupo.resultados.push({
      nombre: d.cliente,
      telefono: d.telefono,
      direccion: d.direccion,
      barrio: d.barrio,
    });
    porGrupo.set(clave, grupo);
  }

  let clientesCreados = 0;
  let vinculados = 0;

  for (const grupo of porGrupo.values()) {
    // Los datos del cliente salen del registro MÁS NUEVO del grupo (el
    // último domicilio del grupo dica la dirección/observación vigente)
    const muestra = grupo.resultados[grupo.resultados.length - 1];
    const { id: clienteId, yaExistia } = await buscarOcrearCliente(muestra);
    if (!yaExistia) clientesCreados += 1;

    // Enlaza todas las filas del grupo (por teléfono o nombre coincide)
    const tel = telefonoNormalizado(muestra.telefono);
    const canon = nombreCanonico(muestra.nombre);
    for (const d of sinVincular) {
      if (d.clienteId !== null) continue;
      const dTel = telefonoNormalizado(d.telefono);
      const dCan = nombreCanonico(d.cliente);
      const coincide =
        tel.length >= 7
          ? dTel === tel
          : tel === "" && dTel === "" && dCan === canon;
      if (!coincide) continue;
      await db.domicilio.update({
        where: { id: d.id },
        data: { clienteId },
      });
      vinculados += 1;
    }
  }

  return { clientesCreados, domiciliosVinculados: vinculados };
}
