import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { claveDia, formatHora } from "../src/lib/format";
import { fotoPedidos, leerFotoPedidos } from "../src/lib/recibo";

test("las fechas del turno siempre corresponden a Colombia, incluso con servidor UTC", () => {
  assert.equal(claveDia(new Date("2026-11-15T02:30:00Z")), "2026-11-14");
  assert.equal(claveDia(new Date("2026-11-15T05:00:00Z")), "2026-11-15");
  assert.match(formatHora(new Date("2026-11-15T02:30:00Z")), /9:30/);
});

test("el recibo conserva todos los pedidos y precios aunque cambie el catálogo", () => {
  const producto = { nombre: "Carne", precio: 99999 };
  const pedidos = [1, 2].map(id => ({ id, consecutivoDia: id, createdAt: new Date("2026-11-14T15:00:00Z"), paraLlevar: false, observaciones: null,
    items: [{ id, cantidad: 1, tipo: "PROTEINA", precio: 13000, productoNombre: "Almuerzo original", producto, conSopa: true, nota: null }] }));
  const foto = JSON.stringify(fotoPedidos(pedidos));
  producto.nombre = "Otro producto";
  const leida = leerFotoPedidos(foto)!;
  assert.equal(leida.length, 2);
  assert.equal(leida[0].items[0].nombre, "Almuerzo original");
  assert.equal(leida.reduce((sum, p) => sum + p.items.reduce((s, i) => s + i.cantidad * i.precio, 0), 0), 26000);
  assert.equal(leerFotoPedidos("{malformado"), null);
});

test("jornadas: apertura atómica, vales correctos, parciales, cierre y protección de doble pago", async () => {
  const carpeta = mkdtempSync(join(tmpdir(), "buen-gusto-qa-"));
  const url = "file:" + join(carpeta, "qa.db").replaceAll("\\", "/");
  writeFileSync(join(carpeta, "qa.db"), "");
  process.env.DATABASE_URL = url;
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const { db } = await import("../src/lib/db");
  const { crearJornadaPago } = await import("../src/lib/nomina/jornadas");
  const { registrarEntregaNomina } = await import("../src/lib/nomina/entregas");
  try {
    const admin = await db.usuario.create({ data: { nombre: "Administrador QA", pin: "1234", rol: "ADMIN" } });
    async function empleado(nombre: string, sueldo: number, contrato = true) {
      const persona = await db.empleado.create({ data: { nombre, apellidos: "Prueba", documentoTipo: "CC", documentoNumero: nombre, cargo: "Cocina", fechaIngreso: new Date("2026-01-01"), salarioMensual: sueldo, periodicidadPago: "CICLOS", creadoById: admin.id } });
      if (contrato) await crearContrato(persona.id, sueldo);
      return persona;
    }
    async function crearContrato(empleadoId: number, sueldo: number) {
      await db.contratoVersion.create({ data: { empleadoId, desde: new Date("2026-01-01"), modalidad: "LABORAL", remuneracion: "MENSUAL", salarioMensual: sueldo, salarioDiario: 0, valorHora: 0, jornadaSemanalMinutos: 2520, periodicidadPago: "CICLOS", diaDescanso: 0, auxilioTransporte: false, metodoPago: "TRANSFERENCIA", motivo: "QA", creadoById: admin.id } });
    }
    const ana = await empleado("Ana", 1485000);
    const bruno = await empleado("Bruno", 20000);
    const carlos = await empleado("Carlos", 800000, false);
    const valeAna = await db.valeNomina.create({ data: { empleadoId: ana.id, fecha: "2026-11-11", productoNombre: "Coca cola", total: 5000, precioUnitario: 5000, creadoById: admin.id } });
    await db.valeNomina.create({ data: { empleadoId: bruno.id, fecha: "2026-11-11", productoNombre: "Consumo", total: 5000, precioUnitario: 5000, creadoById: admin.id } });
    await assert.rejects(crearJornadaPago("2026-11-14", admin.id), /Carlos/);
    assert.equal(await db.jornadaPagoNomina.count(), 0, "no deja jornadas parciales");
    assert.equal(await db.liquidacionNomina.count(), 0, "revierte también las fichas y descuentos previos");
    await crearContrato(carlos.id, 800000);
    const jornada = await crearJornadaPago("2026-11-14", admin.id);
    assert.equal(jornada.preparados, 3);
    assert.equal(jornada.cerrada, false);
    assert.equal((await db.valeNomina.findUniqueOrThrow({ where: { id: valeAna.id } })).estado, "AUTORIZADO", "no descontar antes de pagar");
    assert.equal((await db.valeNomina.findFirstOrThrow({ where: { empleadoId: bruno.id } })).estado, "DESCONTADO", "neto cero sí queda saldado");
    await assert.rejects(crearJornadaPago("2026-11-14", admin.id), /Ya hay una jornada/);
    const pagoAna = await db.liquidacionNomina.findFirstOrThrow({ where: { empleadoId: ana.id } });
    const entrega = (id: number, monto: number, neto: number) => registrarEntregaNomina({ liquidacionId: id, monto, netoRevisado: neto, metodo: "EFECTIVO", usuarioId: admin.id });
    await assert.rejects(entrega(pagoAna.id, pagoAna.netoAPagar + 1, pagoAna.netoAPagar), /saldo pendiente/);
    await entrega(pagoAna.id, 100000, pagoAna.netoAPagar);
    assert.equal((await db.jornadaPagoNomina.findUniqueOrThrow({ where: { id: jornada.jornadaId } })).estado, "ABIERTA");
    const resultados = await Promise.allSettled([
      entrega(pagoAna.id, pagoAna.netoAPagar - 100000, pagoAna.netoAPagar),
      entrega(pagoAna.id, pagoAna.netoAPagar - 100000, pagoAna.netoAPagar),
    ]);
    assert.equal(resultados.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await db.liquidacionNomina.findUniqueOrThrow({ where: { id: pagoAna.id } })).pagado, pagoAna.netoAPagar);
    assert.equal(await db.pagoNomina.count({ where: { liquidacionId: pagoAna.id } }), 2);
    assert.equal(await db.gasto.count(), 2, "solo un gasto por entrega efectiva");
    const pagoCarlos = await db.liquidacionNomina.findFirstOrThrow({ where: { empleadoId: carlos.id } });
    await entrega(pagoCarlos.id, pagoCarlos.netoAPagar, pagoCarlos.netoAPagar);
    assert.equal((await db.jornadaPagoNomina.findUniqueOrThrow({ where: { id: jornada.jornadaId } })).estado, "CERRADA");
    await assert.rejects(entrega(pagoAna.id, 1, pagoAna.netoAPagar), /Abre una jornada/);
    await assert.rejects(crearJornadaPago("2026-11-14", admin.id), /ya están completos/);
    assert.equal(await db.jornadaPagoNomina.count(), 1);
    const siguiente = await crearJornadaPago("2026-11-21", admin.id);
    assert.equal(siguiente.preparados, 3);
    assert.equal(siguiente.cerrada, false);
    // Fixtures de impresión y navegación; permanecen únicamente en esta DB temporal.
    const mesa = await db.mesa.create({ data: { nombre: "Mesa QA", activa: true } });
    const pedido = await db.pedido.create({ data: { mesaId: mesa.id, estado: "COBRADO", consecutivoDia: 1, items: { create: { tipo: "PROTEINA", cantidad: 1, productoNombre: "Almuerzo con carne", precio: 13000, conSopa: true, grupo: 1 } } }, include: { items: { include: { producto: true } } } });
    await db.pago.create({ data: { pedidoId: pedido.id, total: 13000, metodo: "EFECTIVO", pedidosSnapshot: JSON.stringify(fotoPedidos([pedido])), cobradoPorNombre: admin.nombre } });
    const { datosReporte } = await import("../src/app/admin/reportes/datos-reporte");
    const fecha = new Date(`${claveDia(new Date())}T00:00:00-05:00`);
    const antesAnticipo = await datosReporte(fecha);
    const cliente = await db.cliente.create({ data: { nombre: "Cliente QA" } });
    const anticipo = await db.anticipoCliente.create({ data: { clienteId: cliente.id, valorOriginal: 30000, concepto: "QA", metodo: "EFECTIVO", createdById: admin.id } });
    const despuesAnticipo = await datosReporte(fecha);
    assert.equal(despuesAnticipo.efectivoDisponible - antesAnticipo.efectivoDisponible, 30000, "el anticipo sí entra al efectivo del reporte");
    assert.equal(despuesAnticipo.pagadoHoy, antesAnticipo.pagadoHoy, "un anticipo no es una venta nueva");
    await db.anticipoCliente.update({ where: { id: anticipo.id }, data: { usado: 13000 } });
    assert.equal((await datosReporte(fecha)).efectivoDisponible, despuesAnticipo.efectivoDisponible, "consumirlo no genera un segundo ingreso");
    console.log(`Base temporal QA (sin datos reales): ${url}`);
  } finally { await db.$disconnect(); }
});
