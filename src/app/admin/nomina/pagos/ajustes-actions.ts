"use server";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function ajustarPago(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const usuario = await exigirAdmin();
  const id = Number(form.get("pagoId"));
  const quitar = Number(form.get("quitar"));
  const tipo = String(form.get("tipo") ?? "");
  const descripcion = String(form.get("descripcion") ?? "").trim().slice(0, 200);
  const crudo = String(form.get("valor") ?? "");
  const valor = /^\d+$/.test(crudo) ? Number(crudo) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return { error: "Pago inválido." };
  if (!quitar && (!["BONIFICACION", "DESCUENTO"].includes(tipo) || !descripcion || !Number.isSafeInteger(valor) || valor <= 0 || valor > 2147483647)) return { error: "Indica el concepto y un valor entero positivo en pesos." };
  try {
    await db.$transaction(async tx => {
      const pago = await tx.liquidacionNomina.findUnique({ where: { id }, include: { periodo: true } });
      if (!pago || pago.estado !== "BORRADOR" || pago.pagado !== 0 || pago.periodo.estado === "CERRADO") throw new Error("Solo puedes ajustar un pago en preparación y sin abonos.");
      if (JSON.parse(pago.contratoFoto).esquemaPago !== "INTERNO_V1") throw new Error("Recalcula este borrador para usar el nuevo formato de pago.");
      let cambio = valor;
      let deduccion = tipo === "DESCUENTO";
      if (quitar) {
        const concepto = await tx.liquidacionConcepto.findFirst({ where: { id: quitar, liquidacionId: id } });
        if (!concepto || !/^AJUSTE_\d+$/.test(concepto.clave)) throw new Error("Este concepto no es un ajuste editable.");
        const cuota = await tx.novedadNomina.findUnique({ where: { id: Number(concepto.clave.slice(7)) }, select: { creditoId: true } });
        if (cuota?.creditoId) throw new Error("Esta deducción pertenece a un crédito con cuotas acordadas.");
        cambio = -concepto.valor;
        deduccion = concepto.tipo === "DEDUCCION";
        await tx.novedadNomina.update({ where: { id: Number(concepto.clave.slice(7)) }, data: { estado: "RECHAZADA", liquidacionId: null, rechazoMotivo: "Retirado del pago en preparación por el administrador", aprobadoById: usuario.id, aprobadoAt: new Date() } });
        await tx.liquidacionConcepto.delete({ where: { id: concepto.id } });
      } else {
        const novedad = await tx.novedadNomina.create({ data: { empleadoId: pago.empleadoId, fecha: pago.periodo.fechaDesde, tipo, descripcion, valor, estado: "APROBADA", creadoById: usuario.id, aprobadoById: usuario.id, aprobadoAt: new Date(), liquidacionId: id } });
        await tx.liquidacionConcepto.create({ data: { liquidacionId: id, clave: `AJUSTE_${novedad.id}`, tipo: deduccion ? "DEDUCCION" : "DEVENGADO", etiqueta: descripcion, detalle: descripcion, valor } });
      }
      const totalDevengado = pago.totalDevengado + (deduccion ? 0 : cambio);
      const totalDeducciones = pago.totalDeducciones + (deduccion ? cambio : 0);
      const netoAPagar = totalDevengado - totalDeducciones;
      if (netoAPagar < 0 || totalDevengado > 2147483647 || totalDeducciones > 2147483647) throw new Error("Las deducciones no pueden superar el pago disponible ni los importes permitidos.");
      const novedades = await tx.novedadNomina.findMany({ where: { liquidacionId: id }, orderBy: { id: "asc" } });
      await tx.liquidacionNomina.update({ where: { id }, data: { totalDevengado, totalDeducciones, netoAPagar, comisionesBonos: pago.comisionesBonos + (deduccion ? 0 : cambio), otrosDescuentos: pago.otrosDescuentos + (deduccion ? cambio : 0), costoEmpleador: totalDevengado, novedadesFoto: JSON.stringify(novedades) } });
    });
  } catch (e) {
    return { error: e instanceof Error && !('code' in e) ? e.message : "No se pudo guardar el ajuste. Actualiza e intenta de nuevo." };
  }
  revalidatePath("/admin/nomina", "layout");
  return { error: null };
}
