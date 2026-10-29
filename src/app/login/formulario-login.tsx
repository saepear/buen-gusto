"use client";

import {
  ChefHat,
  Delete,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import Image from "next/image";
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

export function FormularioLogin({ logoSrc = "/logo.svg" }: { logoSrc?: string }) {
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

  const puntos = "●".repeat(pin.length) + "○".repeat(4 - pin.length);

  return (
    <div className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-8 shadow-xl shadow-brown-800/10 ring-1 ring-cream-300">
      {/* Logo compacto en móvil */}
      {rol === null && (
        <div className="mb-6 text-center lg:hidden">
          <Image
            src={logoSrc}
            alt="El Buen Gusto"
            width={144}
            height={144}
            unoptimized
            className="mx-auto h-36 w-auto"
            priority
          />
        </div>
      )}

      {rol === null ? (
        <>
          <h2 className="font-display text-2xl text-brown-800">¿Quién entra?</h2>
          <p className="mt-1 text-sm text-brown-600">
            Selecciona tu rol y luego ingresa tu PIN.
          </p>
          <div className="mt-6 grid gap-3">
            {OPCIONES.map(({ rol: r, titulo, detalle, Icono }) => (
              <button
                key={r}
                type="button"
                onClick={() => elegirRol(OPCIONES.find((o) => o.rol === r)!)}
                className="group flex items-center gap-4 rounded-2xl bg-cream-50 p-4 text-left ring-1 ring-cream-300 transition hover:bg-brown-800 hover:ring-brown-800"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-brand/20 text-orange-brand transition group-hover:bg-amber-brand/30">
                  <Icono className="h-6 w-6" />
                </span>
                <span>
                  <span className="block font-bold text-brown-800 transition group-hover:text-cream-100">
                    {titulo}
                  </span>
                  <span className="block text-sm text-brown-500 transition group-hover:text-cream-200/80">
                    {detalle}
                  </span>
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
            className="text-sm text-brown-500 transition hover:text-orange-brand"
          >
            ← Cambiar de rol
          </button>
          <h2 className="mt-2 font-display text-2xl text-brown-800">
            {rol.titulo}
          </h2>
          <p className="mt-1 text-sm text-brown-600">
            {rol.detalle} · ingresa tu PIN de 4 dígitos
          </p>

          <div className="mt-5 flex justify-center gap-3 font-display text-3xl tracking-[0.35em] text-brown-800">
            {puntos}
            <span className="sr-only">{pin}</span>
          </div>

          {pendiente ? (
            <p className="mt-3 text-center text-sm font-medium text-brown-500">
              Verificando…
            </p>
          ) : estado.error ? (
            <p className="mt-3 text-center text-sm font-semibold text-danger">
              {estado.error}
            </p>
          ) : null}

          <div className="mt-4 select-none">
            <div className="grid grid-cols-3 gap-2.5">
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
      className="h-14 rounded-xl bg-cream-100 font-display text-xl text-brown-800 ring-1 ring-cream-300 transition enabled:hover:bg-amber-brand/25 active:scale-95"
    >
      {icono ?? (borrar ? "Limpiar" : d)}
    </button>
  );
}
