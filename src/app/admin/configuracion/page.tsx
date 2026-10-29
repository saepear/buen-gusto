import { Printer } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { PanelMesas } from "./mesas";
import { PanelUsuarios } from "./usuarios";

export const metadata = { title: "Configuración" };

const ORDEN_ROL: Record<string, number> = { ADMIN: 0, MESERO: 1, COCINA: 2 };

export default async function PaginaConfiguracion() {
  const [usuarios, mesas] = await Promise.all([
    db.usuario.findMany(),
    db.mesa.findMany({ orderBy: { numero: "asc" } }),
  ]);

  // Administrador primero, luego meseros y cocina; N° de mesa = último + 1
  usuarios.sort(
    (a, b) =>
      ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] ||
      a.nombre.localeCompare(b.nombre, "es"),
  );
  const sugerida =
    mesas.reduce((max, m) => Math.max(max, m.numero), 0) + 1;

  const tarjetaImpresora = (
    <section className="rounded-[2rem] bg-white/[0.02] p-5 ring-1 ring-white/10">
      <h2 className="flex items-center gap-2 font-display text-xl text-white">
        <Printer className="h-5 w-5 text-cream-200/70" /> Impresora de tickets
      </h2>
      <p className="mt-1 text-sm text-cream-200/70">
        Las comandas de cocina se imprimen desde la pantalla de cocina con el
        botón «Imprimir». El ticket ya viene formateado para papel de 80 mm; lo
        único que hay que hacer es dejar la impresora lista en esta computadora.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-cream-100">
        <li>
          Conecta la impresora térmica de 80&nbsp;mm por USB y enciéndela;
          Windows normalmente instala el controlador sola (si no, busca
          «driver + modelo de tu impresora»).
        </li>
        <li>
          En Windows, márquela como impresora predeterminada (Configuración →
          Bluetooth y dispositivos → Impresoras) y revise que el tamaño de
          papel sea 80&nbsp;mm.
        </li>
        <li>
          En la pantalla de cocina, abra la comanda y pulse «Imprimir»: el
          navegador muestra el diálogo de impresión, elija la impresora y
          listo. La impresión sale en la computadora donde se pulse el botón,
          por eso la impresora vive en la de cocina.
        </li>
      </ol>
    </section>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Configuración"
        subtitulo="Usuarios, PINs, mesas e impresora de cocina"
      />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <PanelUsuarios
          usuarios={usuarios.map((u) => ({
            id: u.id,
            nombre: u.nombre,
            rol: u.rol,
            pin: u.pin,
            activo: u.activo,
          }))}
        />

        <div className="space-y-4">
          <PanelMesas
            mesas={mesas.map((m) => ({
              id: m.id,
              numero: m.numero,
              estado: m.estado,
              activa: m.activa,
            }))}
            sugerida={sugerida}
          />
          {tarjetaImpresora}
        </div>
      </div>
    </>
  );
}
