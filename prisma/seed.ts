// Semilla inicial del sistema El Buen Gusto
// Uso: npm run db:seed
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const USUARIOS = [
  { nombre: "Administrador", pin: "1234", rol: "ADMIN" },
  { nombre: "Laura", pin: "1111", rol: "MESERO" },
  { nombre: "Carlos", pin: "2222", rol: "MESERO" },
];

// Mesas del salón identificadas por nombre (cualitativo), no por número.
// "Para llevar" ilustra el uso del salón como zona de espera de domicilios.
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
  { nombre: "Ensalada", tipo: "PRINCIPIO", precio: 0 },
  { nombre: "Pasta", tipo: "PRINCIPIO", precio: 0 },
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
  SOPA: 45,
};

function claveDia(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function main() {
  console.log("🌱 Sembrando datos de El Buen Gusto…");

  // Orden respetando llaves foráneas
  await db.pago.deleteMany();
  await db.pedidoItem.deleteMany();
  await db.pedido.deleteMany();
  await db.menuDiaItem.deleteMany();
  await db.menuDia.deleteMany();
  await db.usuario.deleteMany();
  await db.producto.deleteMany();
  await db.mesa.deleteMany();

  await db.usuario.createMany({ data: USUARIOS });
  await db.producto.createMany({ data: PRODUCTOS });
  await db.mesa.createMany({
    data: MESAS.map((nombre) => ({ nombre })),
  });

  // Menú del día de HOY con porciones de demostración
  const productos = await db.producto.findMany();
  const porNombre = new Map(productos.map((p) => [p.nombre, p]));

  const menu = await db.menuDia.create({
    data: { fecha: claveDia(new Date()) },
  });

  const itemsMenu = PRODUCTOS.filter((p) =>
    ["PROTEINA", "PRINCIPIO", "SOPA"].includes(p.tipo),
  ).map((p) => ({
    menuDiaId: menu.id,
    productoId: porNombre.get(p.nombre)!.id,
    stockPorciones: STOCK_DEMO[p.tipo] ?? null,
  }));
  await db.menuDiaItem.createMany({ data: itemsMenu });

  console.log("✔ Usuarios:");
  for (const u of USUARIOS) console.log(`   ${u.rol.padEnd(7)} ${u.nombre} → PIN ${u.pin}`);
  console.log(`✔ ${PRODUCTOS.length} productos del catálogo`);
  console.log(`✔ ${MESAS.length} mesas creadas`);
  console.log(`✔ Menú de hoy (${menu.fecha}) con porciones de muestra`);
  console.log("Listo. Corre `npm run dev` y abre http://localhost:3000");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
