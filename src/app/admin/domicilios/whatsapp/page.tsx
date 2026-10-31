import { ArrowLeft, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { menuDeHoy } from "@/lib/pedido";
import { BandejaWhatsapp } from "./bandeja";

export const metadata = { title: "WhatsApp · Pegar y armar · El Buen Gusto" };

/**
 * Fase 1 del automático de WhatsApp: el admin pega el mensaje y el sistema
 * arma el borrador del domicilio para confirmarlo con un toque.
 */
export default async function PaginaWhatsapp() {
  const menu = await menuDeHoy();

  if (menu.length === 0) {
    return (
      <>
        <Link
          href="/admin/domicilios"
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-texto-muted/60 transition hover:text-texto-app"
        >
          <ArrowLeft className="h-4 w-4" /> Domicilios
        </Link>
        <div className="mx-auto flex max-w-xl flex-col items-center gap-2.5 rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center ring-1 ring-borde-app">
          <UtensilsCrossed className="h-8 w-8 text-texto-muted/35" />
          <p className="font-display text-xl text-texto-app">
            Todavía no hay menú para hoy
          </p>
          <p className="text-sm text-texto-muted/70">
            Arma el menú del día antes de armar domicilios pegados de WhatsApp.
          </p>
          <Link
            href="/admin/menu-dia"
            className="mt-4 flex items-center gap-2 rounded-2xl bg-panel-app px-5 py-3 font-display text-md text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
          >
            <UtensilsCrossed className="h-4 w-4" /> Ir al menú del día
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        href="/admin/domicilios"
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-texto-muted/60 transition hover:text-texto-app"
      >
        <ArrowLeft className="h-4 w-4" /> Domicilios
      </Link>

      <EncabezadoPagina
        titulo="WhatsApp · Pegar y armar"
        subtitulo="Del chat del cliente al domicilio en la fila, con tu ojo en el borrador"
      />

      <div className="mt-4 max-w-3xl">
        <BandejaWhatsapp />
      </div>
    </>
  );
}
