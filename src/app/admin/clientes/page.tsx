import { Search, UsersRound } from "lucide-react";
import Link from "next/link";
import { EncabezadoPagina } from "@/components/encabezado";
import { db } from "@/lib/db";
import { formatCOP } from "@/lib/format";
import { buscarClientesPagina } from "@/lib/clientes";
import { ESTADO_CUENTA } from "@/lib/roles";
import {
  FormularioNuevoCliente,
  FormularioVincular,
} from "./formularios";
import { TableroClientes } from "./tablero";
import "./clientes.css";

export const metadata = { title: "Clientes · El Buen Gusto" };

const POR_PAGINA = 24;

export default async function PaginaClientes(
  props: PageProps<"/admin/clientes">,
) {
  const { q, pagina } = await props.searchParams;
  const filtro = typeof q === "string" ? q.trim() : "";
  const nPagina = Math.max(
    1,
    Number.parseInt(typeof pagina === "string" ? pagina : "1", 10) || 1,
  );

  // Búsqueda EN la base (nombre sin acentos, teléfono en dígitos): sin límite
  // de fichas y sin cargar la tabla entera en memoria
  const { filas: visibles, total } = await buscarClientesPagina(
    filtro,
    nPagina,
    POR_PAGINA,
  );
  const ids = visibles.map((c) => c.id);

  const [porDomicilios, porApartados, porCuentas, sinVincular] =
    await Promise.all([
      ids.length
        ? db.domicilio.groupBy({
            by: ["clienteId"],
            where: { clienteId: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      ids.length
        ? db.apartado.groupBy({
            by: ["clienteId"],
            where: { clienteId: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      ids.length
        ? db.cuentaPorCobrar.groupBy({
            by: ["clienteId"],
            where: { clienteId: { in: ids }, estado: ESTADO_CUENTA.PENDIENTE },
            _count: { _all: true },
            _sum: { valorOriginal: true, pagado: true },
          })
        : Promise.resolve([]),
      db.domicilio.count({ where: { clienteId: null } }),
    ]);

  const domiciliosDe = new Map(
    porDomicilios.map((g) => [g.clienteId, g._count._all] as const),
  );
  const apartadosDe = new Map(
    porApartados.map((g) => [g.clienteId, g._count._all] as const),
  );
  const deudaDe = new Map(
    porCuentas.map((g) => [
      g.clienteId,
      {
        cuentas: g._count._all,
        saldo: (g._sum.valorOriginal ?? 0) - (g._sum.pagado ?? 0),
      },
    ] as const),
  );
  const saldoTotalVisibles = [...deudaDe.values()].reduce(
    (s, d) => s + Math.max(0, d.saldo),
    0,
  );
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        subtitulo="La clientela de la casa: domicilios, apartados y fiados en una sola ficha"
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <FormularioNuevoCliente />
        <FormularioVincular pendientes={sinVincular} />
      </div>

      {/* Buscador por nombre o teléfono (la misma búsqueda de domicilios) */}
      <form method="get" className="mb-5 flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2.5 rounded-2xl bg-panel-app px-3.5 py-2.5 ring-1 ring-borde-app focus-within:ring-2 focus-within:ring-amber-brand/60">
          <Search aria-hidden className="h-4 w-4 shrink-0 text-texto-muted/35" />
          <input
            type="search"
            name="q"
            defaultValue={filtro}
            placeholder="Buscar por nombre o teléfono…"
            aria-label="Buscar clientes"
            className="w-full bg-transparent text-sm text-texto-app outline-none placeholder:text-texto-muted/30"
          />
        </label>
        <button
          type="submit"
          className="rounded-2xl bg-panel-app px-4 py-2.5 text-sm font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
        >
          Buscar
        </button>
      </form>

      {saldoTotalVisibles > 0 ? (
        <p className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-warning/10 px-4 py-2.5 text-sm text-warning-text ring-1 ring-warning/25">
          <span className="font-bold">
            Saldo pendiente de cobro entre estos clientes:{" "}
            {formatCOP(saldoTotalVisibles)}
          </span>
        </p>
      ) : null}

      {visibles.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-borde-app bg-panel-app p-10 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-panel-app text-texto-muted/45">
            <UsersRound className="h-10 w-10" />
          </span>
          <p className="mt-5 font-display text-2xl text-texto-app">
            {filtro === "" ? "Aún no hay clientes" : "Nadie coincide con esa búsqueda"}
          </p>
          <p className="mt-2 max-w-md text-texto-muted/70">
            {filtro === ""
              ? "Regístralos aquí, o vuelve desde Domicilios y deja que «Vincular historial» cree las fichas solas."
              : "Prueba con otra parte del nombre (sin acentos) o los últimos dígitos del teléfono."}
          </p>
        </div>
      ) : (
        <TableroClientes clientes={visibles.map((c, indice) => ({
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          direccion: c.direccion,
          barrio: c.barrio,
          createdAt: c.createdAt.toISOString(),
          domicilios: domiciliosDe.get(c.id) ?? 0,
          apartados: apartadosDe.get(c.id) ?? 0,
          deuda: deudaDe.get(c.id) ?? null,
          ordinal: (nPagina - 1) * POR_PAGINA + indice + 1,
          fichaBuscada: /^#?\s*\d{1,7}$/.test(filtro),
        }))} />
       )}

       {total > POR_PAGINA ? (
         <nav
           aria-label="Paginación de clientes"
           className="mt-6 flex items-center justify-center gap-3 text-sm"
         >
           {nPagina > 1 ? (
             <Link
               href={`/admin/clientes?q=${encodeURIComponent(filtro)}&pagina=${nPagina - 1}`}
               className="rounded-xl bg-panel-app px-4 py-2 font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
             >
               ← Anteriores
             </Link>
           ) : null}
           <span className="text-texto-muted/60">
             {visibles.length} de {total} clientes · página {nPagina} de {totalPaginas}
           </span>
           {nPagina < totalPaginas ? (
             <Link
               href={`/admin/clientes?q=${encodeURIComponent(filtro)}&pagina=${nPagina + 1}`}
               className="rounded-xl bg-panel-app px-4 py-2 font-bold text-texto-app ring-1 ring-borde-app transition hover:bg-panel-hover"
             >
               Siguientes →
             </Link>
           ) : null}
         </nav>
       ) : null}
     </>
   );
 }
