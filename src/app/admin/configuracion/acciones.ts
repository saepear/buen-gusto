"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { ES_ROL_VALIDO } from "@/lib/roles";
import { exigirAdmin } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionConfig = { error: string | null; ok: string | null };

const PIN_LIMPIO = (v: unknown) => String(v ?? "").replace(/[^0-9]/g, "");

function revalidarTodo() {
  revalidatePath("/admin", "layout");
  revalidatePath("/mesero", "layout");
  revalidatePath("/ordenes", "layout");
  realtime.broadcast("update");
}

/** Crea un usuario del equipo con su PIN (único dentro del rol) */
export async function crearUsuario(
  _previa: EstadoAccionConfig,
  datos: FormData,
): Promise<EstadoAccionConfig> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede configurar usuarios.", ok: null };
  }

  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 40);
  if (nombre.length < 2) {
    return { error: "El nombre necesita al menos 2 letras.", ok: null };
  }

  const rol = String(datos.get("rol") ?? "");
  if (!ES_ROL_VALIDO(rol)) {
    return { error: "Elige un rol válido.", ok: null };
  }

  const pin = PIN_LIMPIO(datos.get("pin"));
  if (!/^\d{4}$/.test(pin)) {
    return { error: "El PIN debe tener exactamente 4 dígitos.", ok: null };
  }

  const repetido = await db.usuario.findFirst({ where: { pin, rol } });
  if (repetido) {
    return { error: `El PIN ${pin} ya lo usa alguien del rol ${rol}.`, ok: null };
  }

  try {
    await db.usuario.create({ data: { nombre, pin, rol, activo: true } });
  } catch {
    return { error: "Ese PIN ya lo usa alguien del rol elegido.", ok: null };
  }

  revalidarTodo();
  return { error: null, ok: `Usuario «${nombre}» creado. Entra con el PIN ${pin}.` };
}

/** Cambia el PIN de un usuario (sigue único dentro de su rol) */
export async function guardarPin(
  _previa: EstadoAccionConfig,
  datos: FormData,
): Promise<EstadoAccionConfig> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede cambiar PINs.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("usuarioId") ?? ""), 10);
  if (!Number.isInteger(id)) return { error: "Usuario inválido.", ok: null };

  const pin = PIN_LIMPIO(datos.get("nuevoPin"));
  if (!/^\d{4}$/.test(pin)) {
    return { error: "El PIN debe tener exactamente 4 dígitos.", ok: null };
  }

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return { error: "Ese usuario ya no existe.", ok: null };
  if (usuario.pin === pin) {
    return { error: "Ese ya es su PIN de ahora.", ok: null };
  }

  const repetido = await db.usuario.findFirst({ where: { pin, rol: usuario.rol } });
  if (repetido) {
    return {
      error: `El PIN ${pin} ya lo usa ${repetido.nombre} en el rol ${usuario.rol}.`,
      ok: null,
    };
  }

  try {
    await db.usuario.update({ where: { id }, data: { pin } });
  } catch {
    return { error: "Ese PIN ya lo usa alguien del rol elegido.", ok: null };
  }

  revalidarTodo();
  return { error: null, ok: `PIN de ${usuario.nombre} actualizado.` };
}

/** Activa o desactiva a un integrante del equipo */
export async function alternarUsuario(
  _previa: EstadoAccionConfig,
  datos: FormData,
): Promise<EstadoAccionConfig> {
  let sesionId: number;
  try {
    sesionId = (await exigirAdmin()).id;
  } catch {
    return { error: "Solo el administrador puede activar o desactivar usuarios.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("usuarioId") ?? ""), 10);
  if (!Number.isInteger(id)) return { error: "Usuario inválido.", ok: null };
  if (id === sesionId) {
    return { error: "No puedes desactivar tu propia cuenta.", ok: null };
  }

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return { error: "Ese usuario ya no existe.", ok: null };

  if (usuario.activo && usuario.rol === "ADMIN") {
    const adminsActivos = await db.usuario.count({
      where: { rol: "ADMIN", activo: true },
    });
    if (adminsActivos <= 1) {
      return {
        error: "No puedes desactivar al único administrador activo.",
        ok: null,
      };
    }
  }

  await db.usuario.update({ where: { id }, data: { activo: !usuario.activo } });

  revalidarTodo();
  return {
    error: null,
    ok: usuario.activo
      ? `Cuenta de ${usuario.nombre} desactivada: no podrá entrar hasta que la reactives.`
      : `Cuenta de ${usuario.nombre} reactivada: ya puede entrar de nuevo.`,
  };
}

/** Agrega una mesa nueva al salón */
export async function crearMesa(
  _previa: EstadoAccionConfig,
  datos: FormData,
): Promise<EstadoAccionConfig> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede agregar mesas.", ok: null };
  }

  const nombre = String(datos.get("nombre") ?? "").trim().slice(0, 30);
  // Se admite de 1 carácter en adelante: mesas "1", "2"… o "A", "B"…
  if (nombre.length < 1) {
    return { error: "Escribe el nombre de la mesa (p. ej. 1 o A).", ok: null };
  }

  const existente = await db.mesa.findUnique({ where: { nombre } });
  if (existente) {
    return {
      error: `Ya existe la mesa «${nombre}»${
        existente.activa ? "" : " (está oculta; muéstrala de nuevo)"
      }.`,
      ok: null,
    };
  }

  await db.mesa.create({ data: { nombre, estado: "LIBRE", activa: true } });

  revalidarTodo();
  return { error: null, ok: `Mesa «${nombre}» agregada al salón.` };
}

/** Oculta o vuelve a mostrar una mesa (solo si está libre) */
export async function alternarMesa(
  _previa: EstadoAccionConfig,
  datos: FormData,
): Promise<EstadoAccionConfig> {
  try {
    await exigirAdmin();
  } catch {
    return { error: "Solo el administrador puede ocultar mesas.", ok: null };
  }

  const id = Number.parseInt(String(datos.get("mesaId") ?? ""), 10);
  if (!Number.isInteger(id)) return { error: "Mesa inválida.", ok: null };

  const mesa = await db.mesa.findUnique({ where: { id } });
  if (!mesa) return { error: "Esa mesa ya no existe.", ok: null };

  if (mesa.activa && mesa.estado !== "LIBRE") {
    return {
      error: `La mesa «${mesa.nombre}» está ocupada: cobra o cancela sus comandas antes de ocultarla.`,
      ok: null,
    };
  }

  await db.mesa.update({ where: { id }, data: { activa: !mesa.activa } });

  revalidarTodo();
  return {
    error: null,
    ok: mesa.activa
      ? `La mesa «${mesa.nombre}» ya no aparece en el salón.`
      : `La mesa «${mesa.nombre}» volvió al salón.`,
  };
}
