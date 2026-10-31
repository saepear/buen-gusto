import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatHora } from "@/lib/format";
import { inicioDeHoy, menuDeHoy } from "@/lib/pedido";
import { EncabezadoPagina } from "@/components/encabezado";
import { leerAutoRegistrar } from "./contexto";
import { BandejaWhatsapp, type EntradaVista } from "./bandeja";
import type { BorradorParseado } from "./parser";

export const metadata = { title: "WhatsApp · Bandeja de ingreso · El Buen Gusto" };

const borradorDeJSON = (crudo: string | null): BorradorParseado | null => {
  if (!crudo) return null;
  try {
    return JSON.parse(crudo) as BorradorParseado;
  } catch {
    return null;
  }
};

/**
 * Bandeja de entrada de WhatsApp: los mensajes que recibe el puente local
 * (whatsapp-bridge → /api/whatsapp/entrante) quedan acá con su borrador
 * contra el menú de HOY, listos para confirmar o ya convertidos si el
 * auto-registro está encendido.
 */
export default async function PaginaWhatsapp() {
  const [menu, auto, entradas] = await Promise.all([
    menuDeHoy(),
    leerAutoRegistrar(),
    db.entradaWhatsapp.findMany({
      where: {
        OR: [{ estado: "NUEVO" }, { recibidoAt: { gte: inicioDeHoy() } }],
      },
      orderBy: { recibidoAt: "desc" },
      take: 80,
    }),
  ]);

  const vistas: EntradaVista[] = entradas.map((e) => ({
    id: e.id,
    remitente: e.remitente,
    telefono: e.telefono,
    texto: e.texto,
    estado: e.estado,
    armable: e.armable,
    pedidoId: e.pedidoId,
    borrador: borradorDeJSON(e.borrador),
    recibidoEn: formatHora(e.recibidoAt),
  }));

  return (
    <>
      <Link
        href="/admin/domicilios"
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-texto-muted/60 transition hover:text-texto-app"
      >
        <ArrowLeft className="h-4 w-4" /> Domicilios
      </Link>

      <EncabezadoPagina
        titulo="WhatsApp · Bandeja de ingreso"
        subtitulo="Del chat del cliente a la comanda, en un toque"
      />

      <div className="mt-4 max-w-3xl pb-16">
        <BandejaWhatsapp entradas={vistas} auto={auto} menuVacio={menu.length === 0} />
      </div>
    </>
  );
}
