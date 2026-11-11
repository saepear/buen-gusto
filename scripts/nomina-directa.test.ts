import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fechaDePago, proximaFechaPendiente, validarCuotas } from "../src/lib/nomina/calendario-pago";

test("fechas individuales, fin de mes y año bisiesto", () => {
  assert.equal(fechaDePago("2026-11-11", "CICLOS").fechaHasta, "2026-11-14");
  assert.equal(fechaDePago("2026-11-11", "QUINCENAL").fechaHasta, "2026-11-15");
  assert.equal(fechaDePago("2026-11-11", "MENSUAL").fechaHasta, "2026-11-30");
  assert.equal(fechaDePago("2028-02-27", "CICLOS").fechaHasta, "2028-02-29");
});
test("recordatorios omiten pagos completos y priorizan atrasos", () => {
  const pagado = { estadoPago: "PAGADO", periodo: { fechaDesde: "2026-11-08", fechaHasta: "2026-11-14" } };
  assert.equal(proximaFechaPendiente("2026-11-11", "CICLOS", [pagado]), "2026-11-21");
  const atrasado = { estadoPago: "PARCIALMENTE", periodo: { fechaDesde: "2026-11-01", fechaHasta: "2026-11-07" } };
  assert.equal(proximaFechaPendiente("2026-11-11", "CICLOS", [pagado, atrasado]), "2026-11-07");
});
test("crédito de 300 mil en cinco cuotas y validación de importes", () => {
  const cuotas = [11,12].map(m => ({ fecha: `2026-${m}-30`, valor: 60000 })).concat([1,2,3].map(m => ({ fecha: `2027-0${m}-14`, valor: 60000 })));
  assert.doesNotThrow(() => validarCuotas(300000, cuotas, "2026-11-10"));
  assert.throws(() => validarCuotas(300001, cuotas, "2026-11-10"));
  assert.throws(() => validarCuotas(300000, [{ fecha: "2026-11-09", valor: 300000 }], "2026-11-10"));
});
test("vale del 11 descuenta el 14, recalcula borrador y no se duplica; cuota futura espera", async () => {
  const carpeta = mkdtempSync(join(tmpdir(), "nomina-prueba-"));
  writeFileSync(join(carpeta, "prueba.db"), "");
  const url = "file:" + join(carpeta, "prueba.db").replaceAll("\\", "/");
  process.env.DATABASE_URL = url;
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const { db } = await import("../src/lib/db");
  const { prepararLiquidacion } = await import("../src/lib/nomina/preparar-liquidacion");
  try {
    const admin = await db.usuario.create({ data: { nombre: "Prueba", pin: "test", rol: "ADMIN" } });
    const empleado = await db.empleado.create({ data: { nombre: "Prueba", apellidos: "Pago", cargo: "Cocina", documentoTipo: "CC", documentoNumero: "test", fechaIngreso: new Date("2026-01-01"), salarioMensual: 1485000, periodicidadPago: "CICLOS", creadoById: admin.id } });
    await db.contratoVersion.create({ data: { empleadoId: empleado.id, desde: new Date("2026-01-01"), modalidad: "LABORAL", remuneracion: "MENSUAL", salarioMensual: 1485000, salarioDiario: 0, valorHora: 0, jornadaSemanalMinutos: 2520, periodicidadPago: "CICLOS", diaDescanso: 0, auxilioTransporte: false, metodoPago: "TRANSFERENCIA", motivo: "Prueba", creadoById: admin.id } });
    const periodo = await db.periodoNomina.create({ data: { fechaDesde: "2026-11-08", fechaHasta: "2026-11-14", tipo: "CICLOS", creadoById: admin.id } });
    const preparar = () => prepararLiquidacion({ periodoId: periodo.id, empleadoId: empleado.id, usuarioId: admin.id, soloSiFalta: true });
    assert.equal((await preparar()).error, null);
    // Aprobación antigua sin entrega: también debe incorporar el vale nuevo.
    await db.liquidacionNomina.updateMany({ data: { estado: "APROBADA" } });
    await db.valeNomina.create({ data: { empleadoId: empleado.id, fecha: "2026-11-11", productoNombre: "Coca cola 1.5", cantidad: 1, precioUnitario: 5000, total: 5000, estado: "PENDIENTE", creadoById: admin.id } });
    await db.creditoNomina.create({ data: { empleadoId: empleado.id, monto: 60000, motivo: "Escritorio", creadoById: admin.id, cuotas: { create: { empleadoId: empleado.id, fecha: "2026-11-30", valor: 60000, tipo: "DESCUENTO", descripcion: "Cuota escritorio", estado: "APROBADA", creadoById: admin.id } } } });
    assert.equal((await preparar()).error, null);
    const pago = await db.liquidacionNomina.findFirstOrThrow();
    assert.equal(pago.netoAPagar, 366250);
    assert.equal((await preparar()).error, null);
    assert.equal((await db.liquidacionNomina.findFirstOrThrow()).netoAPagar, 366250);
    assert.equal((await db.valeNomina.findFirstOrThrow()).estado, "AUTORIZADO");
    await db.liquidacionNomina.update({ where: { id: pago.id }, data: { pagado: pago.netoAPagar, estadoPago: "PAGADO" } });
    const fin = await db.periodoNomina.create({ data: { fechaDesde: "2026-11-22", fechaHasta: "2026-11-30", tipo: "CICLOS", creadoById: admin.id } });
    assert.equal((await prepararLiquidacion({ periodoId: fin.id, empleadoId: empleado.id, usuarioId: admin.id })).error, null);
    const siguiente = await db.liquidacionNomina.findFirstOrThrow({ where: { periodoId: fin.id } });
    assert.equal(siguiente.netoAPagar, 311250);
    assert.equal((await db.valeNomina.findFirstOrThrow()).liquidacionId, pago.id);
  } finally { await db.$disconnect(); }
});
