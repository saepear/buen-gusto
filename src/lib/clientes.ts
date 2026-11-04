// Unificación de clientes: las reglas de duplicados SÍ se usan para mostrar
// posibles coincidencias al administrador (tél norm., nombre canónico), pero
// JAMÁS se fusiona en silencio. Dos personas con el mismo nombre son dos
// fichas; la identidad se determina con la información conjunta.
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

/** Columnas de búsqueda normalizadas que escribe cualquier alta/edición */
export function datosBusquedaCliente(datos: { nombre: string; telefono: string }) {
  return {
    nombreBusqueda: nombreCanonico(datos.nombre),
    telefonoBusqueda: telefonoNormalizado(datos.telefono),
  };
}

/** Ficha para listas y avisos de coincidencias */
export type ClienteResumen = {
  id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  barrio: string | null;
  createdAt: Date;
};

/**
 * Posibles coincidencias con lo que el administrador está escribiendo:
 * · Teléfono igual (7+ dígitos) → la señal fuerte (regla C).
 * · Sin teléfono y nombre canónico idéntico → pista de revisión (regla B).
 * Nunca se incluye como «coincidencia» a alguien con el mismo nombre pero
 * otro teléfono (regla A: son personas distintas, el administrador decide).
 */
export async function coincidenciasDeCliente(
  datos: DatosClienteBase,
): Promise<ClienteResumen[]> {
  const nombre = datos.nombre.trim();
  const telefono = datos.telefono.trim();
  const tel = telefonoNormalizado(telefono);

  if (tel.length >= 7) {
    return db.cliente.findMany({
      where: { telefonoBusqueda: tel },
      orderBy: { id: "desc" },
      take: 6,
      select: { id: true, nombre: true, telefono: true, direccion: true, barrio: true, createdAt: true },
    });
  }

  const canon = nombreCanonico(nombre);
  if (canon.length > 2) {
    return db.cliente.findMany({
      where: { nombreBusqueda: canon, telefonoBusqueda: "" },
      orderBy: { id: "desc" },
      take: 6,
      select: { id: true, nombre: true, telefono: true, direccion: true, barrio: true, createdAt: true },
    });
  }
  return [];
}

/** Crea una ficha NUEVA sin reusar nada (solo tras que el admin confirme que
 *  que no es una de las coincidencias o que el número lo comparte alguien). */
export async function crearClienteNuevo(datos: DatosClienteBase): Promise<number> {
  const creado = await db.cliente.create({
    data: {
      nombre: datos.nombre.trim(),
      telefono: datos.telefono.trim(),
      direccion: (datos.direccion ?? "").trim(),
      barrio: datos.barrio?.trim() || null,
      observaciones: datos.observaciones?.trim() || null,
      ...datosBusquedaCliente({ nombre: datos.nombre, telefono: datos.telefono }),
    },
  });
  return creado.id;
}

/**
 * Encuentra el cliente guardado que corresponda (por teléfono normalizado;
 * los «solo el nombre» se cruzan por nombre canónico) o crea uno nuevo.
 * Úsalo SOLO en operaciones automáticas internas (vinculación masiva del
 * historial): el alta desde la UI muestra las coincidencias y pide una
 * decisión en vez de reusar silenciosamente.
 */
export async function buscarOcrearCliente(
  datos: DatosClienteBase,
): Promise<{ id: number; yaExistia: boolean }> {
  const nombre = datos.nombre.trim();
  const telefono = datos.telefono.trim();
  const tel = telefonoNormalizado(telefono);

  if (tel.length >= 7) {
    const igual = await db.cliente.findFirst({
      where: { telefonoBusqueda: tel },
      orderBy: { id: "desc" },
    });
    if (igual) return { id: igual.id, yaExistia: true };
  } else {
    const canon = nombreCanonico(nombre);
    if (canon.length > 2) {
      const igual = await db.cliente.findFirst({
        where: { nombreBusqueda: canon, telefonoBusqueda: "" },
        orderBy: { id: "desc" },
      });
      if (igual) return { id: igual.id, yaExistia: true };
    }
  }

  const id = await crearClienteNuevo(datos);
  return { id, yaExistia: false };
}

/** Búsqueda paginada en BD para picker/listados: nombré y teléfono parcial,
 *  sin acentos, sin cargar toda la base. */
export async function buscarClientesPagina(
  term: string,
  pagina = 1,
  tamano = 12,
): Promise<{ filas: ClienteResumen[]; total: number; pagina: number }> {
  const crudo = term.trim();
  const canon = nombreCanonico(crudo);
  const digitos = telefonoNormalizado(crudo);

  const donde =
    digitos.length >= 3
      ? {
          OR: [
            { telefonoBusqueda: { contains: digitos } },
            ...(canon ? [{ nombreBusqueda: { contains: canon } }] : []),
          ],
        }
      : canon
        ? { nombreBusqueda: { contains: canon } }
        : {};

  const [total, filas] = await Promise.all([
    db.cliente.count({ where: donde }),
    db.cliente.findMany({
      where: donde,
      orderBy: { updatedAt: "desc" },
      take: tamano,
      skip: (Math.max(1, pagina) - 1) * tamano,
      select: { id: true, nombre: true, telefono: true, direccion: true, barrio: true, createdAt: true },
    }),
  ]);

  return { filas, total, pagina: Math.max(1, pagina) };
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
