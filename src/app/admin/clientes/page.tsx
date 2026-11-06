import { MapPin, Phone, Search, UsersRound } from "lucide-react";
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((c, indice) => {
            const deuda = deudaDe.get(c.id);
            // Lo que ve el administrador: consecutivo visual de la página,
            // no el id interno de la base. Con una búsqueda «#12» se muestra
            // además el id de ficha para poder ubicarla.
            const ordinal = (nPagina - 1) * POR_PAGINA + indice + 1;
            return (
              <Link
                key={c.id}
                href={`/admin/clientes/${c.id}`}
                className="group flex flex-col rounded-2xl bg-panel-app p-4 ring-1 ring-borde-app transition hover:ring-amber-brand/50"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-brand/15 font-display text-lg text-amber-brand ring-1 ring-amber-brand/30"
                  >
                    {c.nombre.trim().charAt(0).toUpperCase() || "·"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold leading-tight text-texto-app">
                      {c.nombre}
                      <span
                        className="ml-1.5 rounded-md bg-amber-brand/12 px-1.5 py-0.5 text-[10px] font-bold text-amber-brand ring-1 ring-amber-brand/30"
                        title={`Cliente n.º ${ordinal}`}
                      >
                        N.º {ordinal}
                      </span>
                      {/^#?\s*\d{1,7}$/.test(filtro) ? (
                        <span className="ml-1 rounded-md bg-fondo-app px-1.5 py-0.5 text-[10px] font-bold text-texto-muted/60 ring-1 ring-borde-app">
                          Ficha #{c.id}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-texto-muted/50">
                      Cliente desde{" "}
                      {new Date(c.createdAt).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-xs text-texto-muted/70">
                  {c.telefono ? (
                    <p className="flex items-center gap-1.5 truncate">
                      <Phone aria-hidden className="h-3.5 w-3.5 shrink-0 text-texto-muted/40" />
                      {c.telefono}
                    </p>
                  ) : null}
                  {c.direccion ? (
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0 text-texto-muted/40" />
                      {c.direccion}
                      {c.barrio ? ` · ${c.barrio}` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-bold">
                  <span className="rounded-full bg-fondo-app px-2 py-0.5 text-success-text ring-1 ring-borde-app">
                    {domiciliosDe.get(c.id) ?? 0}{" "}
                    {(domiciliosDe.get(c.id) ?? 0) === 1 ? "domicilio" : "domicilios"}
                  </span>
                  {(apartadosDe.get(c.id) ?? 0) > 0 ? (
                    <span className="rounded-full bg-fondo-app px-2 py-0.5 text-info-text ring-1 ring-borde-app">
                      {(apartadosDe.get(c.id) ?? 0)}{" "}
                      apartados
                    </span>
                  ) : null}
                  {deuda && deuda.cuentas > 0 ? (
                    <span
                      className={
                        "rounded-full px-2 py-0.5 ring-1 " +
                        (deuda.saldo > 0
                          ? "bg-danger/10 text-danger-text ring-danger/25"
                          : "bg-fondo-app text-texto-muted/50 ring-borde-app")
                      }
                    >
                      Fiados: {formatCOP(Math.max(0, deuda.saldo))}
                    </span>
                  ) : null}
                </div>
              </Link>
             );
           })}
         </div>
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
