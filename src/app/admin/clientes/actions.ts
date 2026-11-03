"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  buscarOcrearCliente,
  nombreCanonico,
  telefonoNormalizado,
  vincularHistorialDomicilios,
} from "@/lib/clientes";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionCliente = { error: string | null; ok: string | null };

const texto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function revalidar() {
  revalidatePath("/admin", "layout");
  realtime.broadcast("update");
}

/** Registra un cliente. Si ya existe (teléfono o nombre), se reutiliza. */
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

  const { yaExistia } = await buscarOcrearCliente({
    nombre,
    telefono,
    direccion: texto(datos.get("direccion"), 120),
    barrio: texto(datos.get("barrio"), 60) || null,
    observaciones: texto(datos.get("observaciones"), 300) || null,
  });

  revalidar();
  return {
    error: null,
    ok: yaExistia
      ? "Ya estaba guardado: reutilizamos esa ficha (sin duplicar)."
      : "Cliente registrado.",
  };
}

/** Edita los datos de un cliente existente */
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
    },
  });

  revalidar();
  return { error: null, ok: "Datos del cliente actualizados." };
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

/** Búsqueda de clientes para escoger uno (apartados, cuentas por cobrar…) */
export async function buscarClientes(term: string) {
  const filtro = term.trim().toLowerCase();
  const digitos = filtro.replace(/\D/g, "");
  const todos = await db.cliente.findMany({
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: { id: true, nombre: true, telefono: true, direccion: true },
  });
  if (!filtro) return todos.slice(0, 12);
  return todos
    .filter(
      (c) =>
        c.nombre.toLowerCase().includes(filtro) ||
        nombreCanonico(c.nombre).includes(filtro) ||
        (digitos.length > 0 && telefonoNormalizado(c.telefono).includes(digitos)),
    )
    .slice(0, 12);
}
