"use client";

import { ChefHat, Delete, UserRound, UtensilsCrossed } from "lucide-react";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { iniciarSesion, type LoginState } from "./actions";

type OpcionRol = {
  rol: "ADMIN" | "MESERO" | "COCINA";
  titulo: string;
  detalle: string;
  Icono: typeof UserRound;
};

const OPCIONES: OpcionRol[] = [
  {
    rol: "ADMIN",
    titulo: "Administrador",
    detalle: "Panel de escritorio",
    Icono: UserRound,
  },
  {
    rol: "MESERO",
    titulo: "Mesero",
    detalle: "Tomar pedidos",
    Icono: UtensilsCrossed,
  },
  {
    rol: "COCINA",
    titulo: "Cocina",
    detalle: "Ver comandas",
    Icono: ChefHat,
  },
];

export function FormularioLogin() {
  const [rol, setRol] = useState<OpcionRol | null>(null);
  const [pin, setPin] = useState("");
  // Espejo del PIN para leer el valor real aunque React agrupe los toques
  const pinRef = useRef("");
  const [estado, dispatch, pendiente] = useActionState<LoginState, FormData>(
    iniciarSesion,
    { error: null },
  );

  function fijarPin(valor: string) {
    pinRef.current = valor;
    setPin(valor);
  }

  function elegirRol(opcion: OpcionRol) {
    setRol(opcion);
    fijarPin("");
  }

  function enviarPinValor(valor: string) {
    if (!rol || valor.length !== 4 || pendiente) return;
    const datos = new FormData();
    datos.set("rol", rol.rol);
    datos.set("pin", valor);
    startTransition(() => dispatch(datos));
  }

  // El envío es un evento, no un efecto: se dispara al marcar el 4º dígito
  function marcar(d: string) {
    if (pinRef.current.length >= 4) {
      // PIN rechazado: teclear de nuevo arranca un PIN nuevo de una vez
      if (estado.error && !pendiente) fijarPin(d);
      return;
    }
    const nuevo = pinRef.current + d;
    fijarPin(nuevo);
    if (nuevo.length === 4) enviarPinValor(nuevo);
  }

  function borrarUltimo() {
    fijarPin(pinRef.current.slice(0, -1));
  }

  function limpiar() {
    fijarPin("");
  }

  function enviarPin() {
    enviarPinValor(pinRef.current);
  }

  // Soporte de teclado físico (útil en la PC del admin y en pruebas)
  useEffect(() => {
    if (!rol) return;
    const manejarTecla = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) marcar(e.key);
      else if (e.key === "Backspace") borrarUltimo();
      else if (e.key === "Enter") enviarPin();
    };
    window.addEventListener("keydown", manejarTecla);
    return () => window.removeEventListener("keydown", manejarTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, estado, pendiente]);

  return (
    <div className="w-full rounded-[2rem] bg-brown-950/60 p-6 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl sm:p-8">
      {rol === null ? (
        <>
          <header>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-brand/70">
              Acceso
            </p>
            <h2 className="mt-2 font-display text-3xl text-white">
              ¿Quién entra?
            </h2>
            <p className="mt-2 text-sm text-cream-200/60">
              Elige tu rol e ingresa tu PIN de 4 dígitos.
            </p>
          </header>

          <div className="mt-7 grid gap-2.5">
            {OPCIONES.map(({ rol: r, titulo, detalle, Icono }) => (
              <button
                key={r}
                type="button"
                onClick={() => elegirRol(OPCIONES.find((o) => o.rol === r)!)}
                className="group flex items-center gap-4 rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:ring-amber-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-brand"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-brand/15 text-amber-brand ring-1 ring-amber-brand/20 transition group-hover:bg-amber-brand group-hover:text-brown-950">
                  <Icono className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-white">{titulo}</span>
                  <span className="block text-sm text-cream-200/50">
                    {detalle}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="text-xl text-cream-200/30 transition group-hover:translate-x-0.5 group-hover:text-amber-brand"
                >
                  ›
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setRol(null)}
            className="text-sm font-semibold text-cream-200/50 transition hover:text-amber-brand"
          >
            ← Cambiar de rol
          </button>

          <header className="mt-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl text-white">{rol.titulo}</h2>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream-200/30">
              PIN · 4 dígitos
            </span>
          </header>

          <div
            key={estado.error ?? "listo"}
            className={
              "mt-7 flex justify-center gap-3.5 " +
              (estado.error ? "animar-sacudir" : "")
            }
          >
            <span className="sr-only">PIN ingresado: {pin}</span>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={
                  "h-3.5 w-3.5 rounded-full transition-all duration-200 " +
                  (i < pin.length
                    ? "scale-110 bg-amber-brand shadow-[0_0_0_5px_rgba(242,166,61,0.12)]"
                    : "bg-white/15")
                }
              />
            ))}
          </div>

          <div className="mt-3 h-5 text-center">
            {pendiente ? (
              <p className="text-sm font-medium text-cream-200/50">
                Verificando…
              </p>
            ) : estado.error ? (
              <p className="text-sm font-semibold text-[#f0a6a3]">
                {estado.error}
              </p>
            ) : null}
          </div>

          <div className="mt-3 grid select-none grid-cols-3 gap-2.5">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <TeclaPin key={d} d={d} onClick={marcar} />
            ))}
            <TeclaPin d="x" onClick={limpiar} borrar />
            <TeclaPin d="0" onClick={marcar} />
            <TeclaPin
              d="b"
              onClick={borrarUltimo}
              borrar
              icono={<Delete className="h-6 w-6" />}
            />
          </div>
        </>
      )}
    </div>
  );
}

function TeclaPin({
  d,
  onClick,
  borrar,
  icono,
}: {
  d: string;
  onClick: (d: string) => void;
  borrar?: boolean;
  icono?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(d)}
      className="flex h-16 items-center justify-center rounded-2xl bg-white/[0.05] text-2xl font-display text-white ring-1 ring-white/10 transition hover:bg-white/[0.1] hover:ring-amber-brand/40 active:scale-[0.96]"
    >
      {icono ?? (
        borrar ? (
          <span className="text-xs font-bold uppercase tracking-[0.15em] text-cream-200/60">
            Limpiar
          </span>
        ) : (
          d
        )
      )}
    </button>
  );
}
