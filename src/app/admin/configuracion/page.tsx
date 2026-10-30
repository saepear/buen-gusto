import { Printer } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { PanelMesas } from "./mesas";
import { PanelUsuarios } from "./usuarios";
import { PanelTemas } from "./temas";
import { getTemaActual } from "@/lib/config";

export const metadata = { title: "Configuración" };

const ORDEN_ROL: Record<string, number> = { ADMIN: 0, MESERO: 1 };

export default async function PaginaConfiguracion() {
  const [usuarios, mesas, temaActual] = await Promise.all([
    db.usuario.findMany(),
    db.mesa.findMany({ orderBy: { nombre: "asc" } }),
    getTemaActual(),
  ]);

  // Administrador primero y luego meseros; nombre alfabético en ambos
  usuarios.sort(
    (a, b) =>
      ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] ||
      a.nombre.localeCompare(b.nombre, "es"),
  );

  const tarjetaImpresora = (
    <section className="rounded-[2rem] bg-panel-app p-5 ring-1 ring-borde-app">
      <h2 className="flex items-center gap-2 font-display text-xl text-texto-app">
        <Printer className="h-5 w-5 text-texto-muted/70" /> Impresora de tickets
      </h2>
      <p className="mt-1 text-sm text-texto-muted/70">
        Las comandas se imprimen desde la pantalla de órdenes con el
        botón «Imprimir». El ticket ya viene formateado para papel de 80 mm; lo
        único que hay que hacer es dejar la impresora lista en esta computadora.
      </p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-texto-app">
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
          En la pantalla de órdenes, abra la comanda y pulse «Imprimir»: el
          navegador muestra el diálogo de impresión, elija la impresora y
          listo. La impresión sale en la computadora donde se pulse el botón,
          por eso la impresora vive en la de órdenes.
        </li>
      </ol>
    </section>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Configuración"
        subtitulo="Usuarios, PINs, mesas e impresora de órdenes"
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
          <PanelTemas temaActual={temaActual} />
          <PanelMesas
            mesas={mesas.map((m) => ({
              id: m.id,
              nombre: m.nombre,
              estado: m.estado,
              activa: m.activa,
            }))}
          />
          {tarjetaImpresora}
        </div>
      </div>
    </>
  );
}

