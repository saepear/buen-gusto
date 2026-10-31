/* Limpieza de entradas de prueba del test del endpoint WhatsApp */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
(async () => {
  const es = await db.entradaWhatsapp.findMany({
    select: { id: true, remitente: true, texto: true, estado: true, armable: true },
  });
  console.log(JSON.stringify(es, null, 1));
  const del = await db.entradaWhatsapp.deleteMany({
    where: { remitente: { in: ["Truco", "Martina"] } },
  });
  console.log("eliminadas de prueba:", del.count);
  await db.$disconnect();
})();
