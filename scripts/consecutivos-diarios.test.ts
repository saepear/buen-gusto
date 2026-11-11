import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("comandas y domicilios tienen consecutivos diarios independientes", async () => {
  const carpeta = mkdtempSync(join(tmpdir(), "consecutivos-prueba-"));
  const archivo = join(carpeta, "prueba.db");
  writeFileSync(archivo, "");
  const url = "file:" + archivo.replaceAll("\\", "/");
  process.env.DATABASE_URL = url;
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const { db } = await import("../src/lib/db");
  const { numeroVisible, siguienteConsecutivo } = await import("../src/lib/consecutivos");
  try {
    const reservar = (fecha: string, tipo: "PEDIDO" | "DOMICILIO") => db.$transaction(tx => siguienteConsecutivo(tx, fecha, tipo));
    assert.equal(await reservar("2026-11-11", "PEDIDO"), 1);
    assert.equal(await reservar("2026-11-11", "PEDIDO"), 2);
    assert.equal(await reservar("2026-11-11", "DOMICILIO"), 1);
    assert.equal(await reservar("2026-11-11", "DOMICILIO"), 2);
    assert.equal(await reservar("2026-11-12", "PEDIDO"), 1);
    assert.equal(await reservar("2026-11-12", "DOMICILIO"), 1);
    assert.equal(numeroVisible({ id: 25, consecutivoDia: 1 }), 1);
    assert.equal(numeroVisible({ id: 25, consecutivoDia: null }), 25);
  } finally {
    await db.$disconnect();
  }
});
