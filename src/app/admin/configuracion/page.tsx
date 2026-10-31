import { Printer } from "lucide-react";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { PanelMesas } from "./mesas";
import { PanelUsuarios } from "./usuarios";
import { SelectorTema } from "./temas";
import { getTemaActual } from "@/lib/config";

export const metadata = { title: "Configuración" };

const ORDEN_ROL: Record<string, number> = { ADMIN: 0, MESERO: 1, DOMICILIARIO: 2 };

export default async function PaginaConfiguracion() {
  const [usuarios, mesas, temaActual, historial] = await Promise.all([
    db.usuario.findMany(),
    // La mesa virtual de domicilios no se administra como mesa del salón
    db.mesa.findMany({ where: { esDomicilio: false }, orderBy: { nombre: "asc" } }),
    getTemaActual(),
    // Comandas históricas por mesa: las mesas con historial solo se ocultan,
    // las vírgenes se pueden borrar del todo
    db.pedido.groupBy({ by: ["mesaId"], _count: { _all: true } }),
  ]);

  const comandasPorMesa = new Map(
    historial.map((fila) => [fila.mesaId, fila._count._all]),
  );

  // Administrador primero y luego meseros; nombre alfabético en ambos
  usuarios.sort(
    (a, b) =>
      ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] ||
      a.nombre.localeCompare(b.nombre, "es"),
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Configuración"
        subtitulo="Usuarios, PINs, mesas e impresora de órdenes"
        acciones={<SelectorTema temaActual={temaActual} />}
      />

      {/* Banda 1 · Todo el personal, de pared a pared: las fichas van en dos
          columnas y el panel deja de ser una torre interminable */}
      <PanelUsuarios
        usuarios={usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          rol: u.rol,
          pin: u.pin,
          activo: u.activo,
        }))}
      />

      {/* Banda 2 · El salón (vive y crece) junto al manual de la impresora
          (texto de referencia): columna ancha para lo interactivo, angosta
          para lo estático */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <PanelMesas
          mesas={mesas.map((m) => ({
            id: m.id,
            nombre: m.nombre,
            estado: m.estado,
            activa: m.activa,
            pedidos: comandasPorMesa.get(m.id) ?? 0,
          }))}
        />

        <section className="overflow-hidden rounded-[2rem] bg-panel-app ring-1 ring-borde-app">
          {/* Cabecera del grupo: icono del módulo + etiqueta real del papel */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde-app px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-campo-app ring-1 ring-borde-app">
                <Printer className="h-5 w-5 text-texto-muted" />
              </span>
              <h2 className="font-display text-xl text-texto-app">
                Impresora de tickets
              </h2>
            </div>
            <span className="rounded-full bg-campo-app px-2.5 py-0.5 text-[11px] font-bold text-texto-muted ring-1 ring-borde-app">
              Papel 80&nbsp;mm
            </span>
          </div>

          <div className="px-5 py-4 sm:px-6">
            <p className="text-sm text-texto-muted/85">
              Las comandas se imprimen desde la pantalla de órdenes con el botón
              «Imprimir»; el ticket ya sale formateado para papel de 80&nbsp;mm.
              Solo hay que dejar la impresora lista en esta computadora.
            </p>
            <ol className="lista-pasos mt-4 space-y-3 text-sm leading-relaxed text-texto-app">
              <li>
                Conecta la impresora térmica de 80&nbsp;mm por USB y enciéndela.
                Windows normalmente instala el controlador sola; si no, busca
                «driver» más el modelo de la impresora.
              </li>
              <li>
                Márquela como predeterminada (Configuración → Bluetooth y
                dispositivos → Impresoras) y revisa que el tamaño de papel sea
                80&nbsp;mm.
              </li>
              <li>
                Abre la comanda en órdenes y pulsa «Imprimir». La impresión sale
                desde la computadora donde pulses el botón; por eso la impresora
                vive aquí.
              </li>
            </ol>
          </div>
        </section>
      </div>
    </>
  );
}
