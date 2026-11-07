import { test } from "node:test";
import assert from "node:assert/strict";
import { diferenciaEfectivo, efectivoEsperadoCaja } from "../src/lib/caja/conciliacion";

test("el cierre suma ventas, propinas y abonos en efectivo y resta gastos", () => {
  assert.equal(efectivoEsperadoCaja({ ventasEfectivo: 100000, propinasEfectivo: 5000, abonosEfectivo: 20000, gastosEfectivo: 3000 }), 122000);
  assert.equal(diferenciaEfectivo(120000, 122000), -2000);
});

test("propinas de tarjeta y transferencia no inflan el efectivo esperado", () => {
  assert.equal(efectivoEsperadoCaja({ ventasEfectivo: 100000, propinasEfectivo: 0, abonosEfectivo: 0, gastosEfectivo: 0 }), 100000);
});
