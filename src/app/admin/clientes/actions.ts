"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  coincidenciasDeCliente,
  crearClienteNuevo,
  datosBusquedaCliente,
  buscarClientesPagina,
  fusionarClientes,
  resumenDeFusion,
  telefonoComparacion,
  telefonoNormalizado,
  variantesTelefono,
  vincularHistorialDomicilios,
  type ClienteResumen,
} from "@/lib/clientes";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";
import { ESTADO_CUENTA } from "@/lib/roles";

export type EstadoAccionCliente = {
  error: string | null;
  ok: string | null;
  coincidencias?: ClienteResumen[]; // posibles duplicados para revisar
  clienteCreado?: ClienteResumen; // para la creación rápida desde Apartados
};

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function revalidar() {
  revalidatePath("/admin", "layout");
  realtime.broadcast("update");
}

/** Registra un cliente. Si hay posibles duplicados los MUESTRA y pide una
 *  decisión explícita: nunca reutiliza ni fusiona en silencio. */
export async function crearCliente(
  _previa: EstadoAccionCliente,
  datos: FormData,
): Promise<EstadoAccionCliente> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador gestiona clientes.", ok: null };
  }

  const nombre = texto(datos.get("nombre"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  if (nombre.length < 2) {
    return { error: "Escribe el nombre del cliente.", ok: null };
  }
  if (telefono && telefonoNormalizado(telefono).length < 7) {
    return { error: "El teléfono no es válido (7 dígitos o más).", ok: null };
  }

  const carga = {
    nombre,
    telefono,
    direccion: texto(datos.get("direccion"), 120),
    barrio: texto(datos.get("barrio"), 60) || null,
    observaciones: texto(datos.get("observaciones"), 300) || null,
  };

  // «Ignorar coincidencias y crear la ficha»: decisión tomada por el admin
  // (número compartido entre cercanos, homónimo con otro celular, etc.)
  if (texto(datos.get("forzar"), 1) === "1") {
    const id = await crearClienteNuevo(carga);
    revalidar();
    const creado: ClienteResumen = { id, nombre, telefono: telefono, direccion: carga.direccion, barrio: carga.barrio, createdAt: new Date() };
    return { error: null, ok: `Cliente registrado como ficha nueva #${id}.`, clienteCreado: creado };
  }

  const coincidencias = await coincidenciasDeCliente(carga);
  if (coincidencias.length > 0) {
    // Sin fusión automática: quedan listadas para que el admin revise las
    // fichas y elija (usar una) o confirme que es otra persona.
    return {
      error: null,
      ok: null,
      coincidencias,
    };
  }

  const id = await crearClienteNuevo(carga);
  revalidar();
  const creado: ClienteResumen = { id, nombre, telefono: telefono, direccion: carga.direccion, barrio: carga.barrio, createdAt: new Date() };
  return { error: null, ok: `Cliente registrado (#${id}).`, clienteCreado: creado };
}

/** Búsqueda paginada para el picker de clientes del formulario de fiados:
 *  envuelve la búsqueda en BD (nombre/teléfono/«#ficha») con una página
 *  corta. Solo ADMIN (se usa en formularios sensibles de dinero).
 *  La enumeración es la MISMA del listado de Clientes: N.º consecutivo por
 *  página; el id interno de ficha solo se muestra cuando la búsqueda es
 *  numérica (quien busca «#12» la está ubicando por ficha). */
export async function buscarClientesPicker(term: string, pagina = 1) {
  try {
    await exigirAdmin();
  } catch {
    return { filas: [], total: 0, pagina: 1 };
  }
  const r = await buscarClientesPagina(term, pagina, 8);
  const POR_PAGINA = 8;
  const busquedaPorFicha = /^\s*#?\s*\d{1,7}\s*$/.test(term);
  return {
    filas: r.filas.map((c, indice) => {
      const ordinal = ((r.pagina - 1) * POR_PAGINA) + indice + 1;
      return {
        id: c.id,
        etiqueta:
          `N.º ${ordinal} · ${c.nombre}${c.telefono ? ` · ${c.telefono}` : ""}` +
          (busquedaPorFicha ? ` · ficha ${c.id}` : ""),
      };
    }),
    total: r.total,
    pagina: r.pagina,
  };
}

/** Edita los datos de un cliente existente. Aún así advierte si el teléfono
 *  editado queda igual al de otra ficha (familias comparten el número). */
export async function editarCliente(
  _previa: EstadoAccionCliente,
  datos: FormData,
): Promise<EstadoAccionCliente> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador gestiona clientes.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("clienteId") ?? ""), 10);
  if (!Number.isInteger(id)) {
    return { error: "Cliente inválido.", ok: null };
  }
  const nombre = texto(datos.get("nombre"), 60);
  const telefono = texto(datos.get("telefono"), 24);
  if (nombre.length < 2) {
    return { error: "Escribe el nombre del cliente.", ok: null };
  }
  if (telefono && telefonoNormalizado(telefono).length < 7) {
    return { error: "El teléfono no es válido (7 dígitos o más).", ok: null };
  }

  await db.cliente.update({
    where: { id },
    data: {
      nombre,
      telefono,
      direccion: texto(datos.get("direccion"), 120),
      barrio: texto(datos.get("barrio"), 60) || null,
      observaciones: texto(datos.get("observaciones"), 300) || null,
      ...datosBusquedaCliente({ nombre, telefono }),
    },
  });

  revalidar();

  const tel = telefonoComparacion(telefono);
  // Cruce de teléfonos: la ficha quedó guardada SIN el "57" inicial, pero
  // las legacy van completas; variantesTelefono cruza cualquiera de las dos.
  const repetido =
    tel.length >= 7
      ? await db.cliente.count({
          where: {
            telefonoBusqueda: { in: variantesTelefono(tel) },
            id: { not: id },
          },
        })
      : 0;

  return {
    error: null,
    ok:
      repetido > 0
        ? "Datos actualizados. Ojo: ese teléfono también quedó en otra ficha (puede ser un número compartido)."
        : "Datos del cliente actualizados.",
  };
}

/**
 * Crea clientes desde el historial de domicilios y enlaza cada domicilio con
 * su cliente (por teléfono; los «solo nombre», por nombre canónico). No
 * modifica ningún dato de los domicilios.
 */
export async function vincularHistorial(
  _previa: EstadoAccionCliente,
  _datos: FormData,
): Promise<EstadoAccionCliente> {
  void _previa;
  void _datos;
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador gestiona clientes.", ok: null };
  }

  const { clientesCreados, domiciliosVinculados } =
    await vincularHistorialDomicilios();
  revalidar();
  return {
    error: null,
    ok:
      clientesCreados === 0 && domiciliosVinculados === 0
        ? "Todo el historial ya está vinculado."
        : `Historial vinculado: ${clientesCreados} ${
            clientesCreados === 1 ? "cliente nuevo" : "clientes nuevos"
          }, ${domiciliosVinculados} ${
            domiciliosVinculados === 1 ? "domicilio enlazado" : "domicilios enlazados"
          }.`,
  };
}

/** Búsqueda paginada en BD (sin límite de fichas): para picker y listados. */
export async function buscarClientes(term: string) {
  const { filas } = await buscarClientesPagina(term, 1, 12);
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    telefono: f.telefono,
    direccion: f.direccion,
  }));
}

export type DetalleClienteModal = {
  cliente: {
    id: number;
    nombre: string;
    telefono: string;
    direccion: string;
    barrio: string | null;
    observaciones: string | null;
    createdAt: string;
  };
  saldoFiado: number;
  domicilios: Array<{
    id: number;
    createdAt: string;
    direccion: string;
    barrio: string | null;
    estado: string;
    cobradoMonto: number | null;
    cobradoMetodo: string | null;
    notaEntrega: string | null;
  }>;
  apartados: Array<{
    id: number;
    estado: string;
    total: number;
    fechaEntrega: string | null;
    horaEntrega: string | null;
    observaciones: string | null;
    pedidoId: number | null;
    items: Array<{ id: number; nombre: string; cantidad: number; precio: number; conSopa: boolean | null }>;
  }>;
  cuentas: Array<{
    id: number;
    concepto: string;
    valorOriginal: number;
    pagado: number;
    saldoCondonado: number;
    estado: string;
    createdAt: string;
    creadoPor: string;
    abonos: Array<{ id: number; monto: number; metodo: string; nota: string | null; createdAt: string }>;
  }>;
  fusiones: Array<{ id: number; origenId: number; origenNombre: string; origenTelefono: string; domicilios: number; apartados: number; cuentas: number; createdAt: string; hechoPor: string }>;
};

/** Carga la ficha completa para el modal del tablero de clientes. */
export async function obtenerDetalleCliente(id: number): Promise<DetalleClienteModal | null> {
  try {
    await exigirAdmin();
  } catch {
    return null;
  }
  if (!Number.isInteger(id)) return null;

  const [cliente, fusiones, pendientes] = await Promise.all([
    db.cliente.findUnique({
      where: { id },
      include: {
        domicilios: { orderBy: { createdAt: "desc" }, take: 20 },
        apartados: {
          orderBy: { createdAt: "desc" }, take: 20,
          include: { items: true },
        },
        cuentas: {
          orderBy: { createdAt: "desc" }, take: 20,
          include: {
            abonos: { orderBy: { createdAt: "asc" } },
            creadoPor: true,
          },
        },
      },
    }),
    db.fusionCliente.findMany({
      where: { destinoId: id },
      orderBy: { createdAt: "desc" }, take: 10,
      include: { hechoPor: { select: { nombre: true } } },
    }),
    db.cuentaPorCobrar.findMany({
      where: { clienteId: id, estado: ESTADO_CUENTA.PENDIENTE },
      select: { valorOriginal: true, pagado: true, saldoCondonado: true },
    }),
  ]);
  if (!cliente) return null;

  return {
    cliente: {
      id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono,
      direccion: cliente.direccion, barrio: cliente.barrio,
      observaciones: cliente.observaciones, createdAt: cliente.createdAt.toISOString(),
    },
    saldoFiado: pendientes.reduce((total, cuenta) => total + Math.max(0, cuenta.valorOriginal - cuenta.pagado - cuenta.saldoCondonado), 0),
    domicilios: cliente.domicilios.map((dom) => ({
      id: dom.id, createdAt: dom.createdAt.toISOString(), direccion: dom.direccion,
      barrio: dom.barrio, estado: dom.estado, cobradoMonto: dom.cobradoMonto,
      cobradoMetodo: dom.cobradoMetodo, notaEntrega: dom.notaEntrega,
    })),
    apartados: cliente.apartados.map((apartado) => ({
      id: apartado.id, estado: apartado.estado, total: apartado.total,
      fechaEntrega: apartado.fechaEntrega, horaEntrega: apartado.horaEntrega,
      observaciones: apartado.observaciones, pedidoId: apartado.pedidoId,
      items: apartado.items.map((item) => ({ id: item.id, nombre: item.nombre, cantidad: item.cantidad, precio: item.precio, conSopa: item.conSopa })),
    })),
    cuentas: cliente.cuentas.map((cuenta) => ({
      id: cuenta.id, concepto: cuenta.concepto, valorOriginal: cuenta.valorOriginal,
      pagado: cuenta.pagado, saldoCondonado: cuenta.saldoCondonado,
      estado: cuenta.estado, createdAt: cuenta.createdAt.toISOString(),
      creadoPor: cuenta.creadoPor.nombre,
      abonos: cuenta.abonos.map((abono) => ({ id: abono.id, monto: abono.monto, metodo: abono.metodo, nota: abono.nota, createdAt: abono.createdAt.toISOString() })),
    })),
    fusiones: fusiones.map((fusion) => ({
      id: fusion.id, origenId: fusion.origenId, origenNombre: fusion.origenNombre,
      origenTelefono: fusion.origenTelefono, domicilios: fusion.domicilios,
      apartados: fusion.apartados, cuentas: fusion.cuentas,
      createdAt: fusion.createdAt.toISOString(), hechoPor: fusion.hechoPor.nombre,
    })),
  };
}

/** ── Eliminar una ficha SIN historial ──────────────────────────────────
 *  El servidor vuelve a comprobar que no tenga nada asociado: si tiene
 *  domicilios, apartados o deudas, bloquea el borrado (usar Fusionar). */
export async function eliminarCliente(
  _previa: EstadoAccionCliente,
  datos: FormData,
): Promise<EstadoAccionCliente> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador gestiona clientes.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("cliente") ?? ""), 10);
  if (!Number.isInteger(id)) {
    return { error: "Cliente inválido.", ok: null };
  }

  const cliente = await db.cliente.findUnique({
    where: { id },
    select: { nombre: true, telefono: true },
  });
  if (!cliente) {
    return { error: "Esa ficha ya no existe.", ok: null };
  }

  const [domicilios, apartados, cuentas, recibidas] = await Promise.all([
    db.domicilio.count({ where: { clienteId: id } }),
    db.apartado.count({ where: { clienteId: id } }),
    db.cuentaPorCobrar.count({ where: { clienteId: id } }),
    db.fusionCliente.count({ where: { destinoId: id } }),
  ]);
  if (domicilios > 0 || apartados > 0 || cuentas > 0 || recibidas > 0) {
    return {
      error:
        "Esa ficha tiene historial (domicilios, apartados, deudas o fusiones recibidas). No se elimina: usa «Fusionar con otro cliente» para no perder nada.",
      ok: null,
    };
  }

  await db.cliente.delete({ where: { id } });
  revalidar();
  return {
    error: null,
    ok: `Ficha #${id} de ${cliente.nombre} eliminada definitivamente.`,
  };
}

/** ── Fusiones de clientes ────────────────────────────────────────────── */

/** Resumen de una fusión pendiente (qué historial viaja al destino) */
export async function prepararFusion(origenId: number, destinoId: number) {
  try {
    await exigirAdmin();
  } catch {
    return null;
  }
  return resumenDeFusion(origenId, destinoId);
}

/**
 * Ejecuta la fusión: mueve todo el historial al destino y borra el origen
 * en una única transacción. El formulario (acciones-ficha.tsx) ya pidió
 * la confirmación explícita del administrador; al terminar lleva a la
 * ficha destino con el banner de éxito (?fusion=ok&origen=…).
 */
export async function fusionarClientesForm(
  _previa: EstadoAccionCliente,
  datos: FormData,
): Promise<EstadoAccionCliente> {
  let adminId = 0;
  try {
    adminId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador gestiona clientes.", ok: null };
  }

  const origenId = Number.parseInt(String(datos.get("origenId") ?? ""), 10);
  const destinoId = Number.parseInt(String(datos.get("destinoId") ?? ""), 10);
  if (!Number.isInteger(origenId) || !Number.isInteger(destinoId)) {
    return { error: "Ficha origen o destino inválida.", ok: null };
  }
  if (origenId === destinoId) {
    return { error: "El origen y el destino son la misma ficha.", ok: null };
  }

  const resultado = await fusionarClientes(origenId, destinoId, adminId);
  if (!resultado.ok) {
    revalidar();
    return { error: resultado.mensaje, ok: null };
  }
  revalidar();
  // La ficha origen se borró: si el admin recargara ahí vería un 404.
  redirect(`/admin/clientes/${destinoId}?fusion=ok&origen=${origenId}`);
}

