import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fechaColombia,
  fechaNominaValida,
  resumenEmpleado,
} from "../src/lib/nomina/resumen";
import { ciclosDeMes } from "../src/lib/nomina/helpers";

test("un vale pendiente no reduce el neto ni cuenta como pago", () => {
  const r = resumenEmpleado(
    { estado: "BORRADOR", netoAPagar: 371250, pagado: 0 },
    [{ estado: "PENDIENTE", total: 6000, liquidacionId: null }],
  );
  assert.equal(r.netoEstimado, 371250);
  assert.equal(r.valesPendientes, 6000);
  assert.equal(r.saldoEstimado, 371250);
});
test("el autorizado reduce la estimación; el descontado no se resta otra vez", () => {
  const r = resumenEmpleado(
    { estado: "BORRADOR", netoAPagar: 365250, pagado: 200000 },
    [
      { estado: "DESCONTADO", total: 6000, liquidacionId: 1 },
      { estado: "AUTORIZADO", total: 12000, liquidacionId: null },
      { estado: "ANULADO", total: 20000, liquidacionId: null },
    ],
  );
  assert.equal(r.netoEstimado, 353250);
  assert.equal(r.saldoEstimado, 153250);
  assert.equal(r.valesDescontados, 6000);
  assert.equal(r.requiereRecalculo, true);
});
test("un vale nuevo no cambia la foto de una liquidación aprobada", () => {
  const r = resumenEmpleado(
    { estado: "APROBADA", netoAPagar: 365250, pagado: 365250 },
    [{ estado: "AUTORIZADO", total: 6000, liquidacionId: null }],
  );
  assert.equal(r.netoEstimado, 365250);
  assert.equal(r.saldoEstimado, 0);
  assert.equal(r.requiereRecalculo, false);
});
test("sin liquidación el neto es desconocido, no cero", () => {
  assert.equal(resumenEmpleado(null, []).netoEstimado, null);
  assert.equal(resumenEmpleado(null, []).saldoEstimado, null);
});
test("los cortes cubren cada mes sin cruces ni huecos, incluidos bisiestos", () => {
  for (const [anio, mes, ultimo] of [
    [2026, 11, 30],
    [2026, 12, 31],
    [2027, 2, 28],
    [2028, 2, 29],
  ]) {
    const cortes = ciclosDeMes(anio, mes);
    assert.equal(cortes.length, 4);
    assert.deepEqual(
      cortes.map((c) => [Number(c.desde.slice(8)), Number(c.hasta.slice(8))]),
      [
        [1, 7],
        [8, 14],
        [15, 21],
        [22, ultimo],
      ],
    );
  }
});
test("las fechas usan Bogotá y rechazan días inexistentes", () => {
  assert.equal(fechaColombia(new Date("2026-11-08T02:00:00Z")), "2026-11-07");
  assert.equal(fechaNominaValida("2028-02-29"), true);
  assert.equal(fechaNominaValida("2027-02-29"), false);
  assert.equal(fechaNominaValida("2026-11-31"), false);
});
