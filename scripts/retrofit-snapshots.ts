// Retrofit de datos para el sistema de fotos históricas de productos.
//
// Sobre qué base corre: la que apunte DATABASE_URL (del entorno o de .env).
// El dueño debe correrlo primero contra una COPIA:
//   $env:DATABASE_URL = "file:./dev-refactor.db"; npx tsx scripts/retrofit-snapshots.ts
//
// Qué hace (idempotente: detecta lo hecho y no repite):
//   1) Rellena productoNombre en PedidoItem y ApartadoReserva con el nombre
//      vigente del producto (la FOTO que ahora escribimos al ordenar). Si la
//      fila ya apunta a un producto borrado queda «(producto eliminado)».
//   2) Rellena el precio null de PedidoItem con el precio del catálogo
//      (0 = incluido en el almuerzo, si el producto ya no existe).
//   3) Limpia los productos «huérfanos» de la categoría «Especiales» (una
//      categoría propia que fue borrada de la configuración): los borra
//      definitivamente con preservación del historial, PERO SOLO si ningún
//      apartado PENDIENTE los necesita (mismo guard que la UI).
//
// No resetea datos, no corre seed, no toca fechas: solo repara columnas.
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";

const db = new PrismaClient();

/** El .env está en la raíz del proyecto (módulo del POS) */
if (!process.env.DATABASE_URL) {
  const raiz = existsSync("../.env") ? "../.env" : ".env";
  const linea = readFileSync(raiz, "utf-8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL"));
  if (linea) {
    const valor = linea.slice(linea.indexOf("=") + 1).trim();
    process.env.DATABASE_URL = valor;
  } else {
    console.error("No hay DATABASE_URL en el entorno ni en .env");
    process.exit(1);
  }
}

const CANTIDAD = (n: number) => `${n} fila${n === 1 ? "" : "s"}`;

/** Foto del nombre vigente en toda la tabla, cruzando con Producto */
async function rellenarFotos(tabla: "PedidoItem" | "ApartadoReserva"): Promise<void> {
  // El identificador de tabla viene de la constante de la firma, nunca de
  // input externo; por eso se interpola directo
  await db.$executeRawUnsafe(
    `UPDATE ${tabla}
     SET productoNombre = COALESCE(
           (SELECT p.nombre FROM Producto p WHERE p.id = ${tabla}.productoId),
           '(producto eliminado)')
     WHERE productoNombre IS NULL AND productoId IS NOT NULL`,
  );
}

async function main() {
  console.log("═ Retrofit de snapshots de productos ═");
  console.log("Base:", process.env.DATABASE_URL?.replace(/\?.*$/, "?…"));

  // ── 1) Fotos (productoNombre) ──
  const porLlenarPi = await db.pedidoItem.count({
    where: { productoNombre: null },
  });
  const porLlenarAr = await db.apartadoReserva.count({
    where: { productoNombre: null },
  });
  if (porLlenarPi === 0 && porLlenarAr === 0) {
    console.log("1) Fotos (productoNombre): nada por rellenar (OK)");
  } else {
    if (porLlenarPi > 0) {
      await rellenarFotos("PedidoItem");
      // Filas cuyo producto ya se había borrado a mano: copia literal
      await db.$executeRawUnsafe(
        `UPDATE PedidoItem SET productoNombre = '(producto eliminado)'
         WHERE productoNombre IS NULL`,
      );
      console.log(`1) PedidoItem.productoNombre rellenado: ${CANTIDAD(porLlenarPi)}`);
    }
    if (porLlenarAr > 0) {
      await rellenarFotos("ApartadoReserva");
      await db.$executeRawUnsafe(
        `UPDATE ApartadoReserva SET productoNombre = '(producto eliminado)'
         WHERE productoNombre IS NULL`,
      );
      console.log(
        `1b) ApartadoReserva.productoNombre rellenado: ${CANTIDAD(porLlenarAr)}`,
      );
    }
  }

  // ── 2) Precio null en PedidoItem: el congelado NUNCA debe ser null ──
  const porPrecio = await db.pedidoItem.count({ where: { precio: null } });
  if (porPrecio > 0) {
    await db.$executeRawUnsafe(
      `UPDATE PedidoItem
       SET precio = COALESCE(
             (SELECT p.precio FROM Producto p WHERE p.id = PedidoItem.productoId),
             0)
       WHERE precio IS NULL`,
    );
    console.log(`2) PedidoItem.precio congelado rellenado: ${CANTIDAD(porPrecio)}`);
  } else {
    console.log("2) PedidoItem.precio: nada por rellenar (OK)");
  }

  // ── 3) Limpieza de huérfanos «Especiales» ──
  const huerfanos = await db.producto.findMany({
    where: { tipo: "Especiales" },
    select: { id: true, nombre: true, activo: true },
  });
  if (huerfanos.length === 0) {
    console.log("3) Huérfanos «Especiales»: no hay (OK)");
  } else {
    console.log(
      `3) Encontrados ${huerfanos.length} productos «Especiales»:`,
      huerfanos
        .map((h) => `#${h.id} ${h.nombre}${h.activo ? "" : " (inactivo)"}`)
        .join(", "),
    );
    const ids = huerfanos.map((h) => h.id);

    // Guard duro: igual que eliminarProductoDefinitivamente. Si un apartado
    // pendiente los necesita, NO borra nada y avisa quién lo bloquea.
    const [reservasPend, itemsPend] = await Promise.all([
      db.apartadoReserva.findMany({
        where: { productoId: { in: ids }, apartado: { estado: "PENDIENTE" } },
        select: {
          apartado: { select: { id: true, cliente: { select: { nombre: true } } } },
        },
      }),
      db.apartadoItem.findMany({
        where: { productoId: { in: ids }, apartado: { estado: "PENDIENTE" } },
        select: {
          apartado: { select: { id: true, cliente: { select: { nombre: true } } } },
        },
      }),
    ]);
    if (reservasPend.length > 0 || itemsPend.length > 0) {
      const bloqueos = [...reservasPend, ...itemsPend]
        .map((r) => `#${r.apartado.id} (${r.apartado.cliente?.nombre ?? "—"})`)
        .join(", ");
      console.error(
        `3) ✋ NO SE BORRA NADA: apartados pendientes necesitan esos productos: ${bloqueos}. Resuélvelos y corre de nuevo.`,
      );
      await db.$disconnect();
      process.exit(2);
    }

    for (const huerfano of huerfanos) {
      const id = huerfano.id;
      await db.$transaction(async (tx) => {
        // Trazabilidad: la foto queda y la FK pasa a null antes de borrar
        await tx.pedidoItem.updateMany({ where: { productoId: id }, data: { productoId: null } });
        await tx.apartadoReserva.updateMany({ where: { productoId: id }, data: { productoId: null } });
        await tx.apartadoItem.updateMany({ where: { productoId: id }, data: { productoId: null } });
        await tx.menuDiaItem.deleteMany({ where: { productoId: id } });
        await tx.producto.delete({ where: { id } });
      });
      console.log(`   Borrado definitivo del producto #${id} «${huerfano.nombre}»`);
    }
  }

  // ── Verificación final ──
  const [piSinFoto, arSinFoto, piSinPrecio, quedoEspeciales] = await Promise.all([
    db.pedidoItem.count({ where: { productoNombre: null } }),
    db.apartadoReserva.count({ where: { productoNombre: null } }),
    db.pedidoItem.count({ where: { precio: null } }),
    db.producto.count({ where: { tipo: "Especiales" } }),
  ]);
  console.log("── Verificación ──");
  console.log(
    `   PedidoItem sin foto: ${piSinFoto} · ApartadoReserva sin foto: ${arSinFoto}`,
  );
  console.log(
    `   PedidoItem sin precio: ${piSinPrecio} · productos «Especiales» restantes: ${quedoEspeciales}`,
  );
  console.log("✓ Retrofit terminado.");
  await db.$disconnect();
}

// Sin top-level await: tsx compila este archivo como CommonJS
main().catch(async (e) => {
  console.error("Retrofit FALLÓ:", e);
  await db.$disconnect();
  process.exit(1);
});
