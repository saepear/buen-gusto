// Unificación de clientes: las reglas de duplicados SÍ se usan para mostrar
// posibles coincidencias al administrador (tél norm., nombre canónico), pero
// JAMÁS se fusiona en silencio. Dos personas con el mismo nombre son dos
// fichas; la identidad se determina con la información conjunta.
import { db } from "@/lib/db";
import { ESTADO_CUENTA } from "@/lib/roles";

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

/** Qué historial tiene una ficha (para decidir «eliminar» vs «fusionar») */
export type HistorialDeCliente = {
  domicilios: number;
  apartados: number;
  cuentas: number;
  saldoPendiente: number; // COP: suma de (valorOriginal − pagado) de las PENDIENTE
};

export async function historialDeCliente(id: number): Promise<HistorialDeCliente> {
  const [domicilios, apartados, cuentas] = await Promise.all([
    db.domicilio.count({ where: { clienteId: id } }),
    db.apartado.count({ where: { clienteId: id } }),
    db.cuentaPorCobrar.findMany({
      where: { clienteId: id, estado: ESTADO_CUENTA.PENDIENTE },
      select: { valorOriginal: true, pagado: true },
    }),
  ]);
  return {
    domicilios,
    apartados,
    cuentas: cuentas.length,
    saldoPendiente: cuentas.reduce((s, c) => s + Math.max(0, c.valorOriginal - c.pagado), 0),
  };
}

/** Resumen antes de confirmar una fusión: qué viaja y qué queda */
export async function resumenDeFusion(origenId: number, destinoId: number): Promise<{
  origen: ClienteResumen | null;
  destino: ClienteResumen | null;
  historial: HistorialDeCliente | null;
} | null> {
  const [origen, destino] = await Promise.all([
    db.cliente.findUnique({ where: { id: origenId } }),
    db.cliente.findUnique({ where: { id: destinoId } }),
  ]);
  if (!origen || !destino) return null;
  const historial = await historialDeCliente(origenId);
  const present = (c: {
    id: number; nombre: string; telefono: string; direccion: string; barrio: string | null; createdAt: Date;
  }): ClienteResumen => ({
    id: c.id, nombre: c.nombre, telefono: c.telefono, direccion: c.direccion, barrio: c.barrio, createdAt: c.createdAt,
  });
  return { origen: present(origen), destino: present(destino), historial };
}

/**
 * Fusión de fichas en UNA transacción: traslada TODA la trazabilidad del
 * cliente origen al destino y borra la ficha origen al final. No crea deudas,
 * pagos ni abonos; no cambia importes; no genera movimientos de caja.
 */
export async function fusionarClientes(
  origenId: number,
  destinoId: number,
  adminId: number,
): Promise<{ ok: boolean; mensaje: string; movidos: { domicilios: number; apartados: number; cuentas: number } }> {
  if (origenId === destinoId) {
    return { ok: false, mensaje: "No se fusiona una ficha consigo misma.", movidos: { domicilios: 0, apartados: 0, cuentas: 0 } };
  }
  const [origen, destino] = await Promise.all([
    db.cliente.findUnique({ where: { id: origenId } }),
    db.cliente.findUnique({ where: { id: destinoId } }),
  ]);
  if (!origen || !destino) {
    return { ok: false, mensaje: "Alguna de las fichas ya no existe.", movidos: { domicilios: 0, apartados: 0, cuentas: 0 } };
  }

  const resultado = await db.$transaction(async (tx) => {
    // updateMany devuelve BatchPayload: mapeamos .count para trabajar con números
    const [domicilios, apartados, cuentas] = (
      await Promise.all([
        tx.domicilio.updateMany({ where: { clienteId: origenId }, data: { clienteId: destinoId } }),
        tx.apartado.updateMany({ where: { clienteId: origenId }, data: { clienteId: destinoId } }),
        tx.cuentaPorCobrar.updateMany({ where: { clienteId: origenId }, data: { clienteId: destinoId } }),
      ])
    ).map((r) => r.count);

    // Rellena los datos vacíos del destino con los del origen: nunca
    // sobrescribe lo que ya está escrito
    const completado: Record<string, string> = {};
    if (!destino.telefono && origen.telefono) completado.telefono = origen.telefono;
    if (!destino.direccion && origen.direccion) completado.direccion = origen.direccion;
    if (!destino.barrio && origen.barrio) completado.barrio = origen.barrio;
    if (!destino.observaciones && origen.observaciones) completado.observaciones = origen.observaciones;
    if (Object.keys(completado).length > 0) {
      await tx.cliente.update({
        where: { id: destinoId },
        data: {
          ...completado,
          ...datosBusquedaCliente({
            nombre: destino.nombre,
            telefono: completado.telefono ?? destino.telefono,
          }),
        },
      });
    }

    const saldoOrigen = await tx.cuentaPorCobrar.findMany({
      where: { clienteId: destinoId, estado: ESTADO_CUENTA.PENDIENTE },
      select: { valorOriginal: true, pagado: true },
    });
    const saldoMovido = saldoOrigen.reduce(
      (s, c) => s + Math.max(0, c.valorOriginal - c.pagado),
      0,
    );

    // Auditar ANTES de borrar: los datos del origen se copian aquí porque la
    // ficha va a desaparecer físicamente
    await tx.fusionCliente.create({
      data: {
        origenId,
        origenNombre: origen.nombre,
        origenTelefono: origen.telefono,
        destinoId,
        domicilios,
        apartados,
        cuentas,
        saldoMovido,
        createdById: adminId,
      },
    });

    // Verifica que TODAS las referencias viajaron antes de borrar la ficha
    const quedan = await Promise.all([
      tx.domicilio.count({ where: { clienteId: origenId } }),
      tx.apartado.count({ where: { clienteId: origenId } }),
      tx.cuentaPorCobrar.count({ where: { clienteId: origenId } }),
    ]);
    if (quedan.some((n) => n > 0)) {
      throw new Error(`La ficha origen aún tiene referencias: ${quedan.join("/")}`);
    }
    await tx.cliente.delete({ where: { id: origenId } });

    return { domicilios, apartados, cuentas };
  });

  return {
    ok: true,
    mensaje: `Fusión lista: ${resultado.domicilios} domicilios, ${resultado.apartados} apartados y ${resultado.cuentas} cuenta(s) de ${origen.nombre} quedaron en la ficha de ${destino.nombre}.`,
    movidos: resultado,
  };
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
