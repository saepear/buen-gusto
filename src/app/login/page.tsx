import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { rutaLogo } from "@/lib/logo";
import { destinoRol } from "@/lib/roles";
import { getSesion } from "@/lib/session";
import Image from "next/image";
import { FormularioLogin } from "./formulario-login";

export const metadata: Metadata = { title: "Iniciar sesión" };

// Ancla visual del acceso: la casa servida, a sangre completa.
const FONDO_ACCESO =
  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Cinematic%20dark%20restaurant%20interior%20at%20night%2C%20warm%20amber%20pendant%20lamps%20over%20a%20rustic%20wooden%20table%2C%20elegant%20plated%20gourmet%20dish%2C%20soft%20bokeh%2C%20deep%20shadows%2C%20moody%20premium%20food%20photography%2C%20shallow%20depth%20of%20field%2C%20no%20text%2C%20no%20people&image_size=landscape_16_9";

export default async function LoginPage() {
  const sesion = await getSesion();
  if (sesion) redirect(destinoRol(sesion.rol));
  const logo = rutaLogo();

  return (
    <div className="tema-oscuro min-h-screen">
      <main className="relative flex min-h-[100svh] flex-col overflow-hidden bg-fondo-app">
        {/* Ancla visual: fotografía a sangre completa con velo oscuro */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FONDO_ACCESO}
            alt=""
            className="animar-zoom-lento h-full w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-fondo-app/80 via-fondo-app/90 to-fondo-app" />
          <div className="absolute inset-0 bg-gradient-to-tr from-fondo-app via-fondo-app/60 to-transparent" />
        </div>

        {/* Escenario: marca a la izquierda, acceso a la derecha */}
        <div className="cabeza-seguro pie-seguro relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:py-16">
          <section className="animar-entrar max-w-xl">
            <div className="flex items-center gap-4">
              <Image
                src={logo.src}
                alt="El Buen Gusto"
                width={96}
                height={96}
                unoptimized
                priority
                className="h-20 w-20 rounded-2xl object-contain lg:h-24 lg:w-24"
              />
              <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-brand/70">
                Restaurante
              </span>
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[0.95] text-texto-app lg:text-6xl">
              El Buen Gusto
            </h1>
            <p className="mt-5 max-w-sm text-lg text-texto-muted/60">
              Comandas del salón y para llevar, en tiempo real.
            </p>
          </section>

          <section
            className="animar-entrar w-full lg:w-[26rem] lg:shrink-0"
            style={{ animationDelay: "120ms" }}
          >
            <FormularioLogin />
          </section>
        </div>

        <p className="relative z-10 hidden pb-6 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-texto-muted/20 lg:block">
          El Buen Gusto · Sistema de comandas
        </p>
      </main>
    </div>
  );
}

