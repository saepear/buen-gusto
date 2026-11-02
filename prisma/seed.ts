// Semilla inicial del sistema El Buen Gusto
//
// Uso:
//   npm run db:seed            → sieMBRA SIN BORRAR NADA (idempotente)
//   npm run db:seed -- --reset → borra todo y recrea los datos de demo
//
// ⚠ SEGURIDAD DE DATOS:
//   · El modo por defecto no ejecuta ningún deleteMany: en una base nueva
//     deja todo el catálogo entrada; en una base con datos reales solo
//     añade lo que falte (usuarios, catálogo, mesas o menú de hoy).
//   · `--reset` borra de verdad, PERO se detiene si la base tiene
//     comandas, pagos o domicilios: el borrado de un negocio en
//     marcha nunca es parte de ejecutar un seed.
import { PrismaClient } from "@prisma/client";
import { hashearPin } from "../src/lib/pin";

const db = new PrismaClient();

// Usuarios de demostración (PIN visibles en consola con propósito:
// son las credenciales de entrada de una instalación nueva)
const USUARIOS = [
  { nombre: "Administrador", pin: "1234", rol: "ADMIN" },
  { nombre: "Laura", pin: "1111", rol: "MESERO" },
  { nombre: "Carlos", pin: "2222", rol: "MESERO" },
  { nombre: "Repartidor", pin: "4444", rol: "DOMICILIARIO" },
  { nombre: "Cristian", pin: "5555", rol: "DOMICILIARIO" },
];

// Mesas del salón identificadas por nombre (cualitativo), no por número.
// "Para llevar" ilustra el uso del salón como zona de espera de pedidos.
const MESAS = [
  "Ventana",
  "Centro",
  "Barra",
  "Esquina",
  "Terraza",
  "Jardín",
  "Familiar",
  "Parejas",
  "Pasillo",
  "Para llevar",
];

// Mesa virtual que agrupa los domicilios. No aparece en el salón ni en la caja:
// sirve para reutilizar el stock y el cobro de una comanda normal.
const MESA_DOMICILIO = "Domicilios";

const PRODUCTOS = [
  // Proteínas
  { nombre: "Res", tipo: "PROTEINA", precio: 0 },
  { nombre: "Pollo", tipo: "PROTEINA", precio: 0 },
  { nombre: "Cerdo", tipo: "PROTEINA", precio: 0 },
  { nombre: "Hígado", tipo: "PROTEINA", precio: 0 },
  { nombre: "Pescado", tipo: "PROTEINA", precio: 0 },
  // Principios
  { nombre: "Arroz blanco", tipo: "PRINCIPIO", precio: 0 },
  { nombre: "Frijoles", tipo: "PRINCIPIO", precio: 0 },
  { nombre: "Lentejas", tipo: "PRINCIPIO", precio: 0 },
  { nombre: "Papa a la francesa", tipo: "PRINCIPIO", precio: 0 },
  { nombre: "Pasta", tipo: "PRINCIPIO", precio: 0 },
  // Ensaladas: apartado aparte de los principios (Fase 8), siempre incluidas
  { nombre: "Ensalada verde", tipo: "ENSALADA", precio: 0 },
  { nombre: "Pico de gallo", tipo: "ENSALADA", precio: 0 },
  // Sopas
  { nombre: "Sopa de verduras", tipo: "SOPA", precio: 0 },
  { nombre: "Sopa de frijol", tipo: "SOPA", precio: 0 },
  { nombre: "Crema de ahuyamá", tipo: "SOPA", precio: 0 },
  // Bebidas
  { nombre: "Limonada natural", tipo: "BEBIDA", precio: 6000 },
  { nombre: "Jugo natural", tipo: "BEBIDA", precio: 6000 },
  { nombre: "Gaseosa", tipo: "BEBIDA", precio: 3500 },
  { nombre: "Agua", tipo: "BEBIDA", precio: 2500 },
  { nombre: "Cerveza", tipo: "BEBIDA", precio: 8000 },
  // Adicionales
  { nombre: "Chicharrón", tipo: "ADICIONAL", precio: 8000 },
  { nombre: "Arepa", tipo: "ADICIONAL", precio: 2500 },
  { nombre: "Huevo frito", tipo: "ADICIONAL", precio: 2500 },
  { nombre: "Tostón", tipo: "ADICIONAL", precio: 4000 },
  { nombre: "Queso", tipo: "ADICIONAL", precio: 4000 },
  { nombre: "Aguacate", tipo: "ADICIONAL", precio: 4000 },
];

// Stock de demostración para el menú de HOY
const STOCK_DEMO: Record<string, number> = {
  PROTEINA: 35,
  PRINCIPIO: 40,
  ENSALADA: 30,
  SOPA: 45,
};

function claveDia(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Crea (si no existen) usuarios, catálogo, mesas y el menú de hoy.
 *  Nunca borra: en una base con datos reales solo llena los huecos. */
async function sembrarSinBorrar(): Promise<void> {
  // Usuarios: compara por nombre+rol (el PIN ahora va hasheado)
  const usuariosExistentes = new Set(
    (await db.usuario.findMany({ select: { nombre: true, rol: true } })).map(
      (u) => `${u.nombre}|${u.rol}`,
    ),
  );
  const usuariosNuevos = USUARIOS.filter(
    (u) => !usuariosExistentes.has(`${u.nombre}|${u.rol}`),
  );
  if (usuariosNuevos.length > 0) {
    await db.usuario.createMany({
      data: usuariosNuevos.map((u) => ({ ...u, pin: hashearPin(u.pin) })),
    });
  }

  // Catálogo: compara por nombre (no puede haber duplicados de nombre
  // porque TODO el sistema busca productos por nombre)
  const nombresProductos = new Set(
    (await db.producto.findMany({ select: { nombre: true } })).map(
      (p) => p.nombre,
    ),
  );
  const productosNuevos = PRODUCTOS.filter(
    (p) => !nombresProductos.has(p.nombre),
  );
  if (productosNuevos.length > 0) {
    await db.producto.createMany({ data: productosNuevos });
  }

  // Mesas (nombre es unique) + la mesa virtual de domicilios
  const nombresMesas = new Set(
    (await db.mesa.findMany({ select: { nombre: true } })).map((m) => m.nombre),
  );
  const mesasNuevas = [
    ...MESAS.filter((n) => !nombresMesas.has(n)).map((nombre) => ({ nombre })),
    ...(!nombresMesas.has(MESA_DOMICILIO)
      ? [{ nombre: MESA_DOMICILIO, esDomicilio: true }]
      : []),
  ];
  if (mesasNuevas.length > 0) {
    await db.mesa.createMany({ data: mesasNuevas });
  }

  // Menú de HOY con porciones demo, solo si aún no existe
  const fecha = claveDia(new Date());
  let menu = await db.menuDia.findUnique({ where: { fecha } });
  if (!menu) {
    menu = await db.menuDia.create({ data: { fecha } });
  }
  const productos = await db.producto.findMany();
  const porNombre = new Map(productos.map((p) => [p.nombre, p]));
  const itemsExistentes = new Set(
    (
      await db.menuDiaItem.findMany({
        where: { menuDiaId: menu.id },
        select: { productoId: true },
      })
    ).map((i) => i.productoId),
  );
  const itemsMenu = PRODUCTOS.filter(
    (p) =>
      ["PROTEINA", "PRINCIPIO", "ENSALADA", "SOPA"].includes(p.tipo) &&
      !itemsExistentes.has(porNombre.get(p.nombre)?.id ?? 0),
  ).map((p) => ({
    menuDiaId: menu.id,
    productoId: porNombre.get(p.nombre)!.id,
    stockPorciones: STOCK_DEMO[p.tipo] ?? null,
  }));
  if (itemsMenu.length > 0) {
    await db.menuDiaItem.createMany({ data: itemsMenu });
  }

  console.log("✔ Usuarios:");
  for (const u of USUARIOS) console.log(`   ${u.rol.padEnd(7)} ${u.nombre} → PIN ${u.pin} (guardado con hash)`);
  console.log(`✔ ${PRODUCTOS.length} productos del catálogo`);
  console.log(`✔ ${MESAS.length} mesas del salón + mesa virtual «${MESA_DOMICILIO}»`);
  console.log(`✔ Menú de hoy (${fecha}) con porciones de muestra`);
  console.log("(Nada se borró: ya existente se respetó tal cual.)");
  console.log("Listo. Corre `npm run dev` y abre http://localhost:3000");
}

/** `--reset`: re-crea la base de demo desde cero.
 *  Frena si hay datos transaccionales reales (comandas, pagos, domicilios). */
async function reiniciarDeDemo(): Promise<void> {
  const [comandas, cobros, entregas] = await Promise.all([
    db.pedido.count(),
    db.pago.count(),
    db.domicilio.count(),
  ]);

  if (comandas > 0 || cobros > 0 || entregas > 0) {
    console.error(
      "⛔ Seed --reset detenido: esta base ya tiene datos de negocio " +
        `(${comandas} comandas, ${cobros} pagos, ${entregas} domicilios) y ` +
        "borrarlos con un seed es la forma más fácil de perder la caja del día.\n" +
        "   · Para practicar usa una base aparte: cambia DATABASE_URL en .env\n" +
        "     (o correr `npm run db:seed` a secas, que no borra nada).",
    );
    process.exitCode = 1;
    return;
  }

  console.warn("⚠ Reset: borrando los datos actuales (base de demo sin comandas)…");
  // Orden respetando llaves foráneas
  await db.pago.deleteMany();
  await db.domicilio.deleteMany();
  await db.pedidoItem.deleteMany();
  await db.pedido.deleteMany();
  await db.menuDiaItem.deleteMany();
  await db.menuDia.deleteMany();
  await db.usuario.deleteMany();
  await db.producto.deleteMany();
  await db.mesa.deleteMany();
}

async function main() {
  if (process.argv.includes("--reset")) {
    console.log("🌱 Sembrando El Buen Gusto (modo --reset)…");
    await reiniciarDeDemo();
    await sembrarSinBorrar();
  } else {
    console.log("🌱 Sembrando El Buen Gusto (modo seguro: no borra nada)…");
    await sembrarSinBorrar();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
