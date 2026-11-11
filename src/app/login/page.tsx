import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { rutaLogo } from "@/lib/logo";
import { destinoRol } from "@/lib/roles";
import { getSesion } from "@/lib/session";
import Image from "next/image";
import { FormularioLogin } from "./formulario-login";
import "./login.css";

export const metadata: Metadata = { title: "Iniciar sesión" };

// Ancla visual del acceso: fotografía del ambiente guardada en /public
// (antes era hotlink a trae.ai, que podría caer o cambiar de URL).
const FONDO_ACCESO = "/fondo-acceso.jpg";

export default async function LoginPage() {
  const sesion = await getSesion();
  if (sesion) redirect(destinoRol(sesion.rol));
  const logo = rutaLogo();

  return (
    <div className="tema-oscuro min-h-screen">
      <main className="login-page relative flex min-h-[100svh] flex-col overflow-hidden bg-fondo-app">
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
          <span className="login-orb login-orb-one" />
          <span className="login-orb login-orb-two" />
        </div>

        {/* Escenario: marca a la izquierda, acceso a la derecha */}
        <div className="cabeza-seguro pie-seguro login-layout relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center gap-10 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:gap-20 lg:py-16">
          <section className="login-brand animar-entrar max-w-xl">
            <div className="login-brand-top flex items-center gap-4">
              <Image
                src={logo.src}
                alt="El Buen Gusto"
                width={96}
                height={96}
                unoptimized
                priority
                className="login-logo h-20 w-20 rounded-2xl object-contain lg:h-24 lg:w-24"
              />
              <div><span className="login-brand-kicker">El Buen Gusto</span><span className="login-brand-system">Sistema POS</span></div>
            </div>
            <span className="login-live-pill"><i /> Restaurante conectado</span>
            <h1 className="mt-5 font-display text-5xl leading-[0.96] text-texto-app lg:text-7xl">
              El ritmo del restaurante,<br /><em>en un solo lugar.</em>
            </h1>
            <p className="mt-5 max-w-md text-lg text-texto-muted/70">
              Cocina, mesas, domicilios y caja listos para empezar el turno sin perder un detalle.
            </p>
            <div className="login-brand-features">
              <span>Comandas en tiempo real</span><span>Caja centralizada</span><span>Equipo sincronizado</span>
            </div>
          </section>

          <section
            className="login-access animar-entrar w-full lg:w-[28rem] lg:shrink-0"
            style={{ animationDelay: "120ms" }}
          >
            <div className="login-access-label"><span /> ACCESO DEL EQUIPO</div>
            <FormularioLogin />
          </section>
        </div>

        <p className="login-footer relative z-10 hidden pb-6 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-texto-muted/35 lg:block">
          El Buen Gusto · Sistema POS · Acceso protegido por PIN
        </p>
      </main>
    </div>
  );
}

