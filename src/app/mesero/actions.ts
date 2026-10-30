"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearPedido, ErrorDePedido, type CargaPedido } from "@/lib/pedido";
import { exigirActor } from "@/lib/session";
import { realtime } from "@/lib/realtime";

export type EstadoAccionPedido = { error: string | null; ok: string | null };

/** Toma el pedido de una mesa: descuenta porciones en vivo y envía la comanda */
export async function tomarPedido(
  _previa: EstadoAccionPedido,
  datos: FormData,
): Promise<EstadoAccionPedido> {
  let meseroId: number;
  try {
    const sesion = await exigirActor(["MESERO"]);
    meseroId = sesion.id;
  } catch {
    return { error: "Solo los meseros pueden tomar pedidos.", ok: null };
  }

  const mesaId = Number.parseInt(String(datos.get("mesaId") ?? ""), 10);
  if (!Number.isInteger(mesaId)) {
    return { error: "Mesa inválida.", ok: null };
  }

  let carga: CargaPedido | null = null;
  try {
    carga = JSON.parse(String(datos.get("datos") ?? "")) as CargaPedido;
  } catch {
    carga = null;
  }
  if (!carga) {
    return {
      error: "Datos del pedido corruptos. Recarga la página e intenta de nuevo.",
      ok: null,
    };
  }

  const observaciones =
    String(datos.get("observaciones") ?? "").trim().slice(0, 140) || null;

  let nuevoId: number;
  try {
    nuevoId = await crearPedido({ mesaId, meseroId, carga, observaciones });
  } catch (e) {
    return {
      error:
        e instanceof ErrorDePedido
          ? e.message
          : "No se pudo guardar el pedido. Intenta otra vez.",
      ok: null,
    };
  }

  revalidatePath("/mesero", "layout");
  revalidatePath("/ordenes");
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  realtime.broadcast("update");

  redirect(`/ordenes/comanda/${nuevoId}?autoPrint=1`);
}
