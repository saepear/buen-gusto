import type { Prisma } from "@prisma/client";

/**
 * Reserva el número visible de una comanda o domicilio para una fecha.
 * Los IDs siguen siendo internos y globales; este contador es el que ve el
 * restaurante y se reinicia al comenzar la siguiente jornada de caja.
 */
export async function siguienteConsecutivo(
  tx: Prisma.TransactionClient,
  fecha: string,
  tipo: "PEDIDO" | "DOMICILIO",
) {
  const contador = await tx.consecutivoDiario.upsert({
    where: { fecha },
    create:
      tipo === "PEDIDO"
        ? { fecha, siguientePedido: 2 }
        : { fecha, siguienteDomicilio: 2 },
    update:
      tipo === "PEDIDO"
        ? { siguientePedido: { increment: 1 } }
        : { siguienteDomicilio: { increment: 1 } },
  });
  return tipo === "PEDIDO"
    ? contador.siguientePedido - 1
    : contador.siguienteDomicilio - 1;
}

export function numeroVisible(registro: { id: number; consecutivoDia?: number | null }) {
  return registro.consecutivoDia ?? registro.id;
}
